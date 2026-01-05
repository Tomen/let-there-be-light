# @let-there-be-light/client

React-based web client for the lighting control system with graph editor, fixture management, and real-time preview.

## Quick Start

```bash
# Development mode
pnpm --filter @let-there-be-light/client dev

# Production build
pnpm --filter @let-there-be-light/client build

# Run tests
pnpm --filter @let-there-be-light/client test
```

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **React Router** - Client-side routing
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - UI component library
- **@xyflow/react** - Graph editor canvas
- **Vitest** - Testing framework

## Architecture

```
src/
├── api/                  # REST API client
│   ├── client.ts         # Base fetch wrapper
│   ├── fixtures.ts       # Fixture hooks
│   ├── groups.ts         # Group hooks
│   └── graphs.ts         # Graph hooks
├── ws/                   # WebSocket client
│   └── connection.ts     # WebSocketClient class
├── stores/               # Zustand stores
│   └── runtime.ts        # Runtime state (frames, faders, buttons)
├── components/           # Reusable components
│   ├── Layout.tsx        # App shell with navigation
│   └── ui/               # shadcn/ui components
├── pages/                # Route components
│   ├── Patch/            # Fixture/Group management
│   ├── Graphs/           # Graph list
│   ├── GraphEditor/      # Node-based graph editor
│   └── Runtime/          # Live control & preview
├── lib/
│   └── utils.ts          # Utility functions (cn)
├── hooks/                # Custom React hooks
├── test/
│   └── setup.ts          # Vitest setup
├── router.tsx            # Route definitions
├── App.tsx               # App root with providers
└── main.tsx              # Entry point
```

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/patch` | PatchPage | Fixture and group CRUD |
| `/graphs` | GraphsPage | Graph list and creation |
| `/graphs/:graphId` | GraphEditorPage | Node-based graph editor |
| `/runtime` | RuntimePage | Live faders, buttons, and preview |

## API Client

### Query Hooks

```typescript
// Fixtures
useFixtures()           // List all fixtures
useFixture(id)          // Get single fixture
useFixtureModels()      // List fixture models
useCreateFixture()      // Create mutation
useUpdateFixture()      // Update mutation
useDeleteFixture()      // Delete mutation

// Groups
useGroups()
useGroup(id)
useCreateGroup()
useUpdateGroup()
useDeleteGroup()

// Graphs
useGraphs()
useGraph(id)
useCreateGraph()
useUpdateGraph()
useDeleteGraph()
useCompileGraph()       // POST /api/graphs/:id/compile
```

### Error Handling

```typescript
import { ApiClientError } from '@/api'

try {
  await api.get('/fixtures')
} catch (error) {
  if (error instanceof ApiClientError) {
    console.log(error.code)    // 'NOT_FOUND', 'CONFLICT', etc.
    console.log(error.message) // Human-readable message
  }
}
```

## WebSocket Client

### Connection

```typescript
import { wsClient } from '@/ws'

// Connect (auto-reconnects on disconnect)
wsClient.connect()

// Send messages
wsClient.send({ type: 'input/fader', faderId: 'A', value: 0.5 })

// Listen for messages
const unsubscribe = wsClient.onMessage((msg) => {
  if (msg.type === 'frame/full') {
    console.log(msg.fixtures)
  }
})
```

### Runtime Store

```typescript
import { useRuntimeStore } from '@/stores'

function Component() {
  // State
  const isConnected = useRuntimeStore((s) => s.isConnected)
  const faders = useRuntimeStore((s) => s.faders)
  const fixtureValues = useRuntimeStore((s) => s.fixtureValues)

  // Actions
  const setFader = useRuntimeStore((s) => s.setFader)
  const buttonPress = useRuntimeStore((s) => s.buttonPress)
  const subscribeFrames = useRuntimeStore((s) => s.subscribeFrames)
}
```

## UI Components

Based on shadcn/ui with Tailwind CSS:

- `Button` - Primary, secondary, ghost, destructive variants
- `Input` - Text input with validation states
- `Label` - Form labels
- `Dialog` - Modal dialogs
- `Table` - Data tables with header/body/cell
- `Tabs` - Tabbed navigation
- `Select` - Dropdown selection
- `Slider` - Range input
- `Separator` - Visual dividers
- `Tooltip` - Hover tooltips

### Usage

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

<Button variant="outline" size="sm">
  Click me
</Button>

<Input placeholder="Enter name..." />
```

## Configuration

### Vite Config

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
})
```

### Path Aliases

```typescript
// @/ maps to src/
import { Button } from '@/components/ui/button'
import { useFixtures } from '@/api'
```

## Testing

```bash
# Run tests
pnpm --filter @let-there-be-light/client test

# Watch mode
pnpm --filter @let-there-be-light/client test -- --watch

# Coverage
pnpm --filter @let-there-be-light/client test:coverage
```

### Test Structure

```
src/
├── api/
│   └── __tests__/
│       └── client.test.ts
├── stores/
│   └── __tests__/
│       └── runtime.test.ts
├── components/
│   └── __tests__/
│       └── Layout.test.tsx
└── pages/
    └── __tests__/
        └── Patch.test.tsx
```

## Development

### Adding a New Page

1. Create component in `src/pages/NewPage/index.tsx`
2. Add route in `src/router.tsx`
3. Add navigation link in `src/components/Layout.tsx`

### Adding a UI Component

1. Create in `src/components/ui/component-name.tsx`
2. Export from component file
3. Use with `import { Component } from '@/components/ui/component-name'`

### Adding an API Hook

1. Add to appropriate file in `src/api/`
2. Export from `src/api/index.ts`
3. Use query keys pattern for cache invalidation

## Graph Editor

The graph editor at `/graphs/:graphId` provides a visual node-based interface for building lighting control graphs.

### Components

| Component | Description |
|-----------|-------------|
| `NodePalette` | Categorized list of draggable node types |
| `GraphCanvas` | ReactFlow canvas with custom node rendering |
| `NodeInspector` | Parameter editor for selected nodes |
| `CompileErrorPanel` | Compile error display with node focus |

### Features

- **Drag & Drop**: Drag nodes from palette to canvas, or click to add
- **Type-safe Connections**: Only allows compatible port types to connect
- **Auto-save**: Changes auto-save after 1.5s of inactivity
- **Compile Validation**: Compile button validates graph and shows errors
- **Node Inspector**: Edit parameters of selected nodes with sliders/inputs

### Node Types

Organized into categories:
- **Input**: Time, Fader, Button
- **Selection**: SelectGroup, SelectFixture
- **Math**: Add, Multiply, Clamp01, MapRange, Smooth
- **Effect**: SineLFO, TriangleLFO, SawLFO, Chase, Flash
- **Color**: MixColor, ScaleColor, ColorConstant
- **Position**: OffsetPosition, ScalePosition, PositionConstant
- **Bundle**: MergeBundle, ScaleBundle
- **Output**: WriteAttributes

### Port Types

Each port has a type that determines connection compatibility:
- `Scalar` - Number 0..1 or -1..1
- `Bool` - true/false
- `Color` - RGB color object
- `Position` - Pan/Tilt object
- `Bundle` - Attribute bundle
- `Selection` - Fixture selection
- `Trigger` - Edge-triggered event

## Runtime View

The Runtime page (`/runtime`) provides a live monitoring dashboard for the lighting system.

### Components

| Component | Description |
|-----------|-------------|
| `RuntimeStatus` | Connection status and tick rate indicator |
| `ActiveGraphsList` | List of loaded graphs with WriteAttributes outputs |
| `PreviewPanel` | Real-time fixture value preview |

### Active Graphs List

Shows each loaded graph with its current state:
- **Enabled graphs**: Green indicator, shows WriteAttributes outputs
- **Disabled graphs**: Muted indicator

For each enabled graph, WriteAttributes outputs are displayed showing:
- Fixture count being affected
- Attributes being written (intensity, color, pan, tilt, zoom)
- Priority value (if non-zero)

Example display:
```
● Rainbow Effect
  └ 4 fixtures, color
  └ 2 fixtures, intensity, color (priority: 10)
○ Chase Pattern (disabled)
```

## Future Work

- **Undo/Redo**: Graph editing history
- **Keyboard Shortcuts**: Power-user shortcuts
- **Node Pan**: Click error to pan canvas to node
- **Offline Support**: Local caching and sync
