# Data Models Reference

## Entity Base

All entities have:

```typescript
interface Entity {
  id: string;       // Unique identifier
  revision: number; // Version for optimistic concurrency
}
```

---

## Fixture

A physical lighting unit patched at a DMX address.

```typescript
interface Fixture extends Entity {
  name: string;        // Display name
  modelId: string;     // Reference to FixtureModel
  universe: number;    // Art-Net universe (0-based)
  startChannel: number; // DMX start channel (1-512)
}
```

### Validation
- `modelId` must reference an existing model
- `universe` must be >= 0
- `startChannel` must be 1-512

---

## FixtureModel

Reusable template defining channel layout.

```typescript
interface FixtureModel {
  id: string;
  brand: string;
  model: string;
  channels: Record<string, number>; // channelName -> offset (1-based)
}
```

### Channel Names
Standard channel names:
- `dimmer` - Master intensity
- `red`, `green`, `blue`, `white` - Color channels
- `amber`, `uv` - Extended color
- `pan`, `panFine`, `tilt`, `tiltFine` - Position
- `zoom` - Beam angle
- `shutter`, `strobe` - Shutter control
- `mode` - Fixture mode

---

## Group

Named collection of fixtures.

```typescript
interface Group extends Entity {
  name: string;
  fixtureIds: string[]; // Array of Fixture IDs
}
```

### Validation
- All `fixtureIds` must reference existing fixtures

---

## Preset

Saved attribute values for quick recall.

```typescript
interface Preset extends Entity {
  name: string;
  type: 'color' | 'position' | 'beam' | 'full';
  attributes: Partial<AttributeBundle>;
}
```

### Validation by Type
- `color`: Must have `color` or `intensity`
- `position`: Must have `pan` or `tilt`
- `beam`: Must have `zoom`
- `full`: Any attributes allowed

---

## AttributeBundle

Normalized fixture state values.

```typescript
interface AttributeBundle {
  intensity?: number;  // 0-1
  color?: {
    r: number;         // 0-1
    g: number;         // 0-1
    b: number;         // 0-1
  };
  pan?: number;        // -1 to 1
  tilt?: number;       // -1 to 1
  zoom?: number;       // 0-1
}
```

---

## Graph

Node-based effect definition.

```typescript
interface Graph extends Entity {
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

---

## GraphNode

A processing unit in a graph.

```typescript
interface GraphNode {
  id: string;          // Unique within graph
  type: NodeType;      // Node type (e.g., "SineLFO")
  position: {
    x: number;         // Editor X position
    y: number;         // Editor Y position
  };
  params: Record<string, unknown>; // Node parameters
}
```

### Validation
- `type` must be a valid NodeType
- `params` must match node definition

---

## GraphEdge

Connection between nodes.

```typescript
interface GraphEdge {
  id: string;          // Unique within graph
  from: {
    nodeId: string;    // Source node ID
    port: string;      // Output port name
  };
  to: {
    nodeId: string;    // Target node ID
    port: string;      // Input port name
  };
}
```

### Validation
- `from.nodeId` must exist in graph
- `to.nodeId` must exist in graph
- `from.port` must be an output of the source node
- `to.port` must be an input of the target node
- Port types must be compatible

---

## CompileResult

Result of graph compilation.

```typescript
interface CompileResult {
  ok: boolean;
  errors: CompileError[];
  dependencies: {
    faderIds: string[];
    buttonIds: string[];
    presetIds: string[];
    groupIds: string[];
    fixtureIds: string[];
  };
}
```

---

## CompileError

Graph compilation error.

```typescript
interface CompileError {
  nodeId: string;
  port?: string;
  message: string;
  code: CompileErrorCode;
}

type CompileErrorCode =
  | 'CYCLE_DETECTED'
  | 'MISSING_CONNECTION'
  | 'TYPE_MISMATCH'
  | 'INVALID_PARAM'
  | 'UNKNOWN_NODE_TYPE'
  | 'UNKNOWN_REFERENCE';
```

---

## InputState

Runtime input state.

```typescript
interface InputState {
  faders: Record<string, number>;     // faderId -> value (0-1)
  buttonsDown: Record<string, boolean>; // buttonId -> isDown
  buttonPressedQueue: Array<{
    buttonId: string;
    t: number;
  }>;
}
```

---

## Frame

Output frame with fixture attribute values.

```typescript
interface Frame {
  t: number;  // Timestamp
  fixtures: Record<string, AttributeBundle>;
}
```
