# @let-there-be-light/server

Fastify-based control server with REST API, WebSocket, YAML persistence, graph compiler, and 60Hz runtime engine.

## Quick Start

```bash
# Development mode
pnpm --filter @let-there-be-light/server dev

# Production build
pnpm --filter @let-there-be-light/server build
pnpm --filter @let-there-be-light/server start

# Run tests
pnpm --filter @let-there-be-light/server test
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | HTTP port |
| `HOST` | 0.0.0.0 | Bind address |
| `DATA_DIR` | `<project>/data` | Root data directory |
| `SHOW` | `default` | Active show subfolder |
| `ARTNET_BROADCAST` | 2.255.255.255 | Art-Net broadcast address |
| `ARTNET_ENABLED` | true | Set to "false" to disable DMX |

### Using Multiple Shows

Fixture models are shared across all shows. Per-show data is in subfolders:

```
data/
  fixture-models.yaml   # Shared across all shows
  default/              # Default show
    fixtures.yaml
    groups.yaml
    presets.yaml
    graphs.yaml
  sunday-service/       # Another show
    fixtures.yaml
    groups.yaml
    presets.yaml
    graphs.yaml
```

Switch shows with the `SHOW` environment variable:

```bash
SHOW=sunday-service pnpm --filter @let-there-be-light/server dev
```

See [Show Specification](../reference/show-specification.md) for complete YAML format documentation.

## Architecture

```
src/
├── index.ts           # Fastify app entry point
├── datastore/         # YAML persistence layer
│   ├── base.ts        # Generic YamlDataStore<T>
│   ├── fixtures.ts    # Fixture + FixtureModel store
│   ├── groups.ts      # Group store
│   ├── presets.ts     # Preset store
│   ├── graphs.ts      # Graph store
│   └── index.ts       # Store initialization
├── routes/            # REST API endpoints
│   ├── fixtures.ts
│   ├── groups.ts
│   ├── presets.ts
│   └── graphs.ts
├── graph/             # Graph compiler
│   ├── compiler.ts    # Main compileGraph() function
│   ├── topology.ts    # Cycle detection, topological sort
│   ├── types.ts       # Port type checking
│   └── index.ts       # Exports
├── runtime/           # Runtime engine
│   ├── engine.ts      # 60Hz RuntimeEngine class
│   ├── input-state.ts # Fader/button state
│   ├── evaluators/    # Node evaluators (24 types)
│   ├── artnet-bridge.ts # Art-Net DMX output bridge
│   └── index.ts       # Exports
└── ws/                # WebSocket gateway
    └── gateway.ts     # Message handling + frame broadcast
```

## DataStore

### YamlDataStore<T>

Generic YAML-backed store with:
- Lazy loading on first access
- In-memory cache for fast reads
- Atomic writes (temp file + rename)
- Optimistic concurrency via revision

```typescript
class YamlDataStore<T extends Entity> {
  getAll(): T[];
  getById(id: string): T | null;
  getByIdOrThrow(id: string): T;
  create(data: Omit<T, 'id' | 'revision'>, id?: string): T;
  update(id: string, data: Partial<T>, expectedRevision: number): T;
  delete(id: string): boolean;
  find(predicate: (entity: T) => boolean): T[];
  seed(data: T[]): void;
}
```

### Custom Errors

```typescript
class NotFoundError extends Error {
  entityType: string;
  id: string;
}

class ConflictError extends Error {
  expectedRevision: number;
  actualRevision: number;
}

class ValidationError extends Error {}
```

## Graph Compiler

The graph compiler validates and prepares graphs for runtime execution.

### Validation Steps

1. **Node Type Validation** - All node types are known
2. **Cycle Detection** - Graph is a valid DAG (DFS with coloring)
3. **Topological Sort** - Determine evaluation order (Kahn's algorithm)
4. **Type Checking** - Port connections are type-compatible
5. **Required Inputs** - Required ports are connected
6. **Parameter Validation** - Node params are valid
7. **Dependency Extraction** - Extract fader/button/preset/group/fixture IDs

### Usage

```typescript
import { compileGraph, getCompiledGraph } from './graph/index.js';

// Validate and get errors
const result = compileGraph(graph);
if (!result.ok) {
  console.log(result.errors);
}

// Get compiled graph ready for evaluation
const compiled = getCompiledGraph(graph);
```

## Runtime Engine

60Hz tick loop for real-time graph evaluation.

### Features

- **Tick Loop**: 60Hz (configurable) evaluation cycle
- **Input State**: Fader values (0-1) and button states with edge detection
- **Node Evaluators**: 24 node types across 8 categories
- **Frame Output**: Per-fixture attribute bundles
- **Priority Merging**: Higher priority writes override lower
- **Art-Net Bridge**: Real-time DMX output via UDP 6454

### Usage

```typescript
import { getEngine } from './runtime/index.js';

const engine = getEngine();
engine.reloadAllGraphs();
engine.start();

// Handle inputs
engine.setFader('main', 0.75);
engine.setButtonDown('flash', true);

// Subscribe to frames
engine.onFrame((frame) => {
  console.log(frame.fixtures);
});
```

### Node Evaluators

| Category | Nodes |
|----------|-------|
| Input | Time, Fader, Button |
| Selection | SelectGroup, SelectFixture, PresetBundle |
| Math | Add, Multiply, Clamp01, MapRange, Smooth |
| Effect | SineLFO, TriangleLFO, SawLFO, Chase, Flash |
| Color | MixColor, ScaleColor, ColorConstant |
| Position | OffsetPosition, ScalePosition, PositionConstant |
| Bundle | MergeBundle, ScaleBundle |
| Output | WriteAttributes |

## WebSocket Gateway

Real-time communication with clients:
- **Client Tracking**: Set of connected clients
- **Frame Subscriptions**: Full or delta mode
- **Input Routing**: Faders/buttons to runtime
- **Frame Broadcast**: To subscribed clients

## Data Files

Located in `<project>/data/<show>/` (default: `data/default/`):

- `fixtures.yaml` - Patched fixtures
- `fixture-models.yaml` - Fixture model definitions
- `groups.yaml` - Fixture groups
- `presets.yaml` - Color/position/beam presets
- `graphs.yaml` - Effect graphs

Seeded with defaults on first run. Data directory is gitignored.

## Testing

167 tests covering DataStore, Graph Compiler, and Art-Net Bridge:

```bash
# Run tests
pnpm --filter @let-there-be-light/server test

# Watch mode
pnpm --filter @let-there-be-light/server test:watch

# Test coverage
pnpm --filter @let-there-be-light/server test:coverage
```

## Future Work

- **Hot Reload**: Watch YAML files for changes
- **Zod Middleware**: Request body validation
