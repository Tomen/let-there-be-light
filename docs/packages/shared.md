# @let-there-be-light/shared

Shared TypeScript types for client and server.

## Installation

This is a workspace package. Reference it in other packages:

```json
{
  "dependencies": {
    "@let-there-be-light/shared": "workspace:*"
  }
}
```

## Usage

```typescript
import type {
  Fixture,
  Graph,
  ClientMessage,
  ServerMessage
} from '@let-there-be-light/shared';

import { NODE_DEFINITIONS, getNodeDefinition } from '@let-there-be-light/shared';
```

## Exports

### Domain Types (`types/domain.ts`)
- `Fixture`, `FixtureModel`, `Group`, `Graph`
- `GraphNode`, `GraphEdge`
- `AttributeBundle`, `RGBColor`, `Position`
- `InputState`, `Frame`, `FrameDelta`

### API Types (`types/api.ts`)
- `ApiResponse<T>`, `ApiError`
- `CompileResult`, `CompileError`
- `CreateRequest<T>`, `UpdateRequest<T>`

### WebSocket Types (`types/ws.ts`)
- `ClientMessage` - Union of all client messages
- `ServerMessage` - Union of all server messages
- Individual message types for each direction

### Node Types (`types/nodes.ts`)
- `NodeType` - Union of all node type names
- `NodeDefinition` - Node schema with inputs/outputs/params
- `PortType` - Scalar, Bool, Color, Position, Bundle, Selection, Trigger
- `NODE_DEFINITIONS` - Map of all node definitions
- `getNodeDefinition(type)` - Get definition by type
- `getNodesByCategory(category)` - Get types by category
- `getCategories()` - List all categories

## Building

```bash
# Build the package
pnpm --filter @let-there-be-light/shared build

# Watch mode
pnpm --filter @let-there-be-light/shared dev
```

## Type Safety

All types use strict TypeScript:
- Discriminated unions for messages
- Readonly where appropriate
- Explicit optionals
