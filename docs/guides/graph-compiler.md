# Graph Compiler & Runtime

This guide covers the server-side graph processing: compilation, validation, and runtime evaluation.

## Overview

Graphs go through two phases:

1. **Compilation** - Static analysis and validation
2. **Runtime Evaluation** - 60Hz tick loop executing node logic

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Graph YAML    │────>│    Compiler     │────>│ CompiledGraph   │
│   (nodes/edges) │     │  (validation)   │     │ (eval order)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   DMX Output    │<────│  RuntimeEngine  │<────│  Graph Instance │
│   (Art-Net)     │     │    (60Hz)       │     │   (per-tick)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Compilation Pipeline

The `compileGraph()` function performs 7 validation steps:

### Step 1: Validate Node Types

Every node must reference a known type from `NODE_DEFINITIONS`.

```typescript
// Error: UNKNOWN_NODE_TYPE
{ nodeId: "foo", message: "Unknown node type: FooBar", code: "UNKNOWN_NODE_TYPE" }
```

### Step 2: Detect Cycles (DAG Validation)

Graphs must be Directed Acyclic Graphs (DAGs). Cycles prevent evaluation order determination.

**Algorithm**: Depth-first search with 3-color marking (white/gray/black).

```typescript
// Error: CYCLE_DETECTED
{ nodeId: "a", message: "Cycle detected: a -> b -> c -> a", code: "CYCLE_DETECTED" }
```

### Step 3: Topological Sort

Nodes are sorted so dependencies evaluate before dependents.

```
SineLFO (no deps)        → evaluates first
  ↓
ScaleColor (needs LFO)   → evaluates second
  ↓
WriteAttributes          → evaluates last
```

### Step 4: Type-Check Connections

Every edge must connect compatible port types.

| Source Type | Compatible Targets |
|-------------|-------------------|
| Scalar | Scalar |
| Bool | Bool |
| Color | Color, Bundle |
| Position | Position, Bundle |
| Bundle | Bundle |
| Selection | Selection |
| Trigger | Trigger |

```typescript
// Error: TYPE_MISMATCH
{ nodeId: "scale1", port: "color", message: "Type mismatch: Scalar cannot connect to Color" }
```

### Step 5: Validate Required Inputs

Required inputs must have connections. Only **active nodes** are validated (those connected to a WriteAttributes output).

**Required inputs by type:**
- `ScaleColor`: color, scale
- `MixColor`: a, b, mix
- `WriteAttributes`: selection, bundle
- See `NODE_DEFINITIONS` for complete list

```typescript
// Error: MISSING_CONNECTION
{ nodeId: "output1", port: "selection", message: "Required input not connected: selection" }
```

### Step 6: Validate Node Parameters

Parameters must match their type definitions:

| Param Type | Validation |
|------------|------------|
| `string` | Must be a string |
| `number` | Must be a number |
| `boolean` | Must be a boolean |
| `string[]` | Must be array of strings |

```typescript
// Error: INVALID_PARAM
{ nodeId: "fader1", message: "Param faderId must be a string" }
```

### Step 7: Extract Dependencies

The compiler collects external references:

```typescript
interface GraphDependencies {
  faderIds: string[]    // Referenced faders
  buttonIds: string[]   // Referenced buttons
  groupIds: string[]    // Referenced groups
  fixtureIds: string[]  // Referenced fixtures
}
```

---

## Active Node Detection

Only nodes connected to `WriteAttributes` (directly or indirectly) are validated. Orphaned nodes are ignored.

**Algorithm**: BFS backwards from WriteAttributes nodes.

```
SineLFO ──> ScaleColor ──> WriteAttributes  ← All 3 are "active"

ColorConstant (orphaned)                    ← Not validated
```

This allows incomplete work-in-progress graphs.

---

## Compile Result

```typescript
interface CompileResult {
  ok: boolean
  errors: CompileError[]
  dependencies: GraphDependencies
}

interface CompileError {
  nodeId: string
  port?: string
  message: string
  code: 'UNKNOWN_NODE_TYPE' | 'CYCLE_DETECTED' | 'TYPE_MISMATCH'
      | 'MISSING_CONNECTION' | 'INVALID_PARAM'
}
```

---

## Runtime Engine

The `RuntimeEngine` class runs a 60Hz tick loop.

### Lifecycle

```typescript
const engine = getEngine()

// Load graphs from datastore
engine.loadGraph('my-effect')
engine.reloadAllGraphs()

// Control execution
engine.start()
engine.stop()

// Enable/disable individual graphs
engine.setGraphEnabled('my-effect', false)

// Handle inputs
engine.setFader('master', 0.75)
engine.setButtonDown('flash', true)

// Subscribe to output frames
engine.onFrame((frame) => {
  console.log(frame.fixtures)
})
```

### Tick Loop

Each tick (16.67ms at 60Hz):

1. **Calculate timing** - `time` (seconds since start) and `deltaTime`
2. **Evaluate each enabled graph** in topological order
3. **Collect WriteAttributes outputs** from all graphs
4. **Merge by priority** - higher priority wins per-fixture
5. **Emit frame** to listeners (WebSocket, Art-Net bridge)
6. **Clear per-frame input state** (button triggers)

### Evaluation Order

Nodes evaluate in topological order. Each node:

1. Reads inputs from upstream nodes via `ctx.getInput()`
2. Reads external inputs via `ctx.inputs` (faders, buttons)
3. Reads/writes persistent state via `ctx.getNodeState()`/`ctx.setNodeState()`
4. Returns outputs as `Record<string, RuntimeValue>`

```typescript
// Evaluator context
interface EvaluatorContext {
  time: number                    // Seconds since start
  deltaTime: number               // Seconds since last frame
  inputs: InputState              // Fader/button values

  getInput(nodeId, port): RuntimeValue | null
  getNodeState<T>(nodeId): T | undefined
  setNodeState<T>(nodeId, state): void
}
```

### Runtime Values

Outputs can be any of these types:

```typescript
type RuntimeValue =
  | number                                    // Scalar
  | boolean                                   // Bool
  | { r: number; g: number; b: number }      // Color
  | { pan: number; tilt: number }            // Position
  | Partial<AttributeBundle>                  // Bundle
  | Set<string>                               // Selection
```

### Priority Merging

When multiple WriteAttributes target the same fixture, priority determines the winner:

```
WriteAttributes (priority: 0, color: red)    ← Base layer
WriteAttributes (priority: 10, intensity: 1) ← Override layer
```

Result: The fixture gets red color from priority 0, intensity from priority 10.

**Merge rules:**
- Higher priority wins per-attribute
- Undefined attributes don't override
- Color attributes merge at component level

---

## Node State

Stateful nodes (LFOs, Flash, Smooth) persist state between frames:

```typescript
// Inside evaluator
interface FlashState {
  active: boolean
  startTime: number
}

const state = ctx.getNodeState<FlashState>(node.id) ?? { active: false, startTime: 0 }

// Update state
ctx.setNodeState(node.id, { active: true, startTime: ctx.time })
```

State is per-graph-instance, cleared on unload.

---

## Input State

Faders and buttons are managed by `InputState`:

```typescript
class InputState {
  setFader(faderId: string, value: number): void
  getFader(faderId: string): number  // Returns 0 if undefined

  setButtonDown(buttonId: string, down: boolean): void
  getButtonDown(buttonId: string): boolean
  getButtonPressed(buttonId: string): boolean  // True only on first frame of press

  endFrame(): void  // Clear per-frame triggers
}
```

**Button Trigger Detection:**
- `pressed` output fires only on the rising edge (false→true transition)
- `down` output reflects current held state

---

## Performance Considerations

### Evaluation Cost

- **O(V + E)** per tick (V = nodes, E = edges)
- Each node evaluator is O(1) or O(fixtures)
- Typical graph: < 0.5ms evaluation time

### Memory

- Node state: O(stateful nodes × state size)
- Frame outputs: O(fixtures × attributes)

### Optimization Tips

1. **Minimize active nodes** - Orphaned nodes don't evaluate
2. **Use Selection wisely** - Smaller selections = faster iteration
3. **Avoid excessive Flash nodes** - Each maintains envelope state
4. **Prefer ScaleBundle over separate ScaleColor + ScalePosition**

---

## Error Handling

### Compile Errors

Displayed in the UI's CompileErrorPanel with node highlighting.

### Runtime Errors

Caught per-node, logged, and skipped:

```typescript
try {
  const nodeOutputs = evaluator(node, ctx)
  outputs.set(nodeId, nodeOutputs)
} catch (err) {
  console.error(`Error evaluating node ${nodeId}:`, err)
  // Continue with other nodes
}
```

---

## API Endpoints

### Compile a Graph

```bash
POST /api/graphs/:id/compile
```

Returns `CompileResult` with errors and dependencies.

### Get Runtime Status

```bash
GET /api/runtime/status

{
  "running": true,
  "frameNumber": 12345,
  "targetHz": 60,
  "loadedGraphs": 3,
  "enabledGraphs": 2
}
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `packages/server/src/graph/compiler.ts` | Main compile function |
| `packages/server/src/graph/topology.ts` | DAG utilities |
| `packages/server/src/graph/types.ts` | Type checking |
| `packages/server/src/runtime/engine.ts` | RuntimeEngine class |
| `packages/server/src/runtime/input-state.ts` | Fader/button state |
| `packages/server/src/runtime/evaluators/` | Node evaluators |
