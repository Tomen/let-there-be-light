# @let-there-be-light/server

Fastify-based control server for the lighting system.

## Purpose

HTTP REST API and WebSocket server for:
- CRUD operations on fixtures, groups, presets, graphs
- Real-time frame streaming to clients
- Graph compilation and validation
- Runtime graph evaluation at 60Hz
- Art-Net DMX output via UDP 6454

## Key Directories

| Directory | Description |
|-----------|-------------|
| `src/datastore/` | YAML persistence layer |
| `src/routes/` | REST API route handlers |
| `src/ws/` | WebSocket gateway |
| `src/graph/` | Graph compiler (validation, DAG, type checking) |
| `src/runtime/` | Runtime engine (tick loop, evaluators) |

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | Fastify app entry point |
| `src/datastore/base.ts` | Generic YamlDataStore class |
| `src/graph/compiler.ts` | Graph validation and compilation |
| `src/graph/topology.ts` | Cycle detection, topological sort |
| `src/graph/types.ts` | Port type checking |
| `src/runtime/engine.ts` | 60Hz RuntimeEngine class |
| `src/runtime/input-state.ts` | Fader/button state management |
| `src/runtime/evaluators/` | Node evaluators (24 types) |
| `src/runtime/artnet-bridge.ts` | Art-Net DMX output bridge |
| `src/ws/gateway.ts` | WebSocket message handling + frame broadcast |

## Architecture

### DataStore Layer
- `YamlDataStore<T>` - Generic YAML persistence
- Lazy loading on first access
- Atomic writes (temp file + rename)
- Optimistic concurrency via `revision` field

### Graph Compiler (`src/graph/`)
- **compiler.ts**: Main `compileGraph()` function with 7-step validation
- **topology.ts**: DAG utilities (cycle detection, topological sort)
- **types.ts**: Port type compatibility checking

Validation steps:
1. Validate all node types are known
2. Detect cycles (DFS with coloring)
3. Topological sort for evaluation order
4. Type-check all port connections
5. Validate required inputs are connected
6. Validate node parameters
7. Extract external dependencies (faders, buttons, presets, groups, fixtures)

### Runtime Engine (`src/runtime/`)
- **engine.ts**: `RuntimeEngine` class with 60Hz tick loop
- **input-state.ts**: `InputState` for faders and buttons with per-frame trigger detection
- **evaluators/**: 24 node evaluators organized by category:
  - `inputs.ts` - Time, Fader, Button
  - `selection.ts` - SelectGroup, SelectFixture, PresetBundle
  - `math.ts` - Add, Multiply, Clamp01, MapRange, Smooth
  - `effects.ts` - SineLFO, TriangleLFO, SawLFO, Chase, Flash
  - `color.ts` - MixColor, ScaleColor, ColorConstant
  - `position.ts` - OffsetPosition, ScalePosition, PositionConstant
  - `bundle.ts` - MergeBundle, ScaleBundle
  - `output.ts` - WriteAttributes

### Art-Net Bridge (`src/runtime/artnet-bridge.ts`)
- Converts AttributeBundle values to DMX channel values
- Broadcasts Art-Net packets on UDP 6454
- Per-universe DMX buffers (512 channels each)
- Sequence counter per universe (1-255, wraps)
- Graceful shutdown with blackout

Configuration via environment variables:
- `ARTNET_BROADCAST` - Broadcast address (default: 2.255.255.255)
- `ARTNET_ENABLED` - Set to "false" to disable DMX output

### WebSocket Layer
- Client tracking with Set
- Frame subscriptions (full or delta mode)
- Input routing (faders, buttons) to runtime
- Frame broadcast to subscribed clients

## Data Files

Location: `data/` directory
- `fixtures.yaml` - Patched fixtures
- `fixture-models.yaml` - Fixture model templates
- `groups.yaml` - Fixture groups
- `presets.yaml` - Color/position/beam presets
- `graphs.yaml` - Effect graphs

Auto-seeded with defaults on first run.

## Commands

```bash
# Development (auto-reload)
pnpm dev

# Build
pnpm build

# Production
pnpm start

# Tests
pnpm test
```

## Error Handling

Custom errors map to HTTP status codes:
- `NotFoundError` → 404
- `ConflictError` → 409 (revision mismatch)
- `ValidationError` → 400

## Test Coverage

167 tests covering:
- DataStore (base, fixtures, groups, presets, graphs)
- Graph compiler (topology, types, compiler)
- Art-Net bridge (packet structure, value conversions)

Run: `pnpm test`

## Future Work

- **Hot Reload**: Watch YAML files for changes
- **Zod Middleware**: Request body validation
