# @let-there-be-light/shared

Shared TypeScript types for the lighting control system.

## Purpose

This package defines all TypeScript types used by both the server and client:
- Domain models (Fixture, Group, Graph)
- API request/response types
- WebSocket message protocols
- Graph node definitions

## Key Files

| File | Description |
|------|-------------|
| `src/types/domain.ts` | Core entity types (Fixture, Graph, etc.) |
| `src/types/api.ts` | REST API types (responses, errors) |
| `src/types/ws.ts` | WebSocket message types |
| `src/types/nodes.ts` | Graph node definitions |
| `src/index.ts` | Re-exports all types |

## Type Conventions

### Entity Base
All entities extend:
```typescript
interface Entity {
  id: string;
  revision: number;
}
```

### Discriminated Unions
WebSocket messages use `type` field:
```typescript
type ClientMessage =
  | { type: 'input/fader'; faderId: string; value: number }
  | { type: 'input/buttonDown'; buttonId: string }
  // ...
```

### Node Definitions
Each node has inputs, outputs, and params:
```typescript
interface NodeDefinition {
  type: NodeType;
  category: 'input' | 'math' | 'effect' | ...;
  inputs: Record<string, PortDefinition>;
  outputs: Record<string, PortDefinition>;
  params: Record<string, ParamDefinition>;
}
```

## Commands

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Run tests
pnpm test
```

## Test Coverage

23 tests covering node definitions validation.

## Adding New Types

1. Add to appropriate file in `src/types/`
2. Export from `src/index.ts`
3. Rebuild with `pnpm build`

## Adding New Node Types

1. Add to `NodeType` union in `nodes.ts`
2. Add definition to `NODE_DEFINITIONS` object
3. Define inputs, outputs, and params
4. Implement evaluator in server (`src/runtime/evaluators/`)
