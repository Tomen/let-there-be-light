# Let There Be Light

A TypeScript monorepo for graph-based lighting control with Art-Net output. Build lighting effects visually, evaluate them at 60Hz, and output to DMX via Art-Net.

## Project Structure

```
let-there-be-light/
├── packages/
│   ├── shared/     # Shared TypeScript types
│   ├── server/     # Control server (REST + WebSocket + Runtime + Art-Net)
│   ├── client/     # React web client with graph editor
│   ├── tools/      # Art-Net diagnostic tools and protocol
│   └── mcp/        # MCP server for Claude Code integration
└── docs/           # Documentation
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Build shared types (required first)
pnpm --filter @let-there-be-light/shared build

# Start the control server
pnpm --filter @let-there-be-light/server dev

# Start the web client (in another terminal)
pnpm --filter @let-there-be-light/client dev
```

**Server:** http://localhost:3001/api
**Client:** http://localhost:5173

## Features

### Control Server
- **REST API** - CRUD for fixtures, groups, presets, and graphs
- **WebSocket** - Real-time frame streaming and input handling
- **Runtime Engine** - 60Hz graph evaluation with 24 node types
- **Art-Net Bridge** - Direct DMX output via UDP 6454

### Web Client
- **Patch** - Fixture and group management
- **Presets** - Color, position, and beam presets
- **Graph Editor** - Visual node-based effect builder
- **Runtime** - Fader and button controls with live preview

### Diagnostic Tools
```bash
pnpm run ping      # Test network connectivity
pnpm run sniff     # Listen for Art-Net traffic
pnpm run discover  # Find Art-Net devices
pnpm run control   # Interactive DMX control
```

## Network Configuration

| Device | IP Address |
|--------|------------|
| GrandMA2 Primary | 2.0.0.1 |
| GrandMA2 Secondary | 2.0.0.2 |
| Your Laptop | 2.0.0.10 |
| Broadcast | 2.255.255.255 |

Edit `config.yaml` to match your network.

## Documentation

See the [`docs/`](./docs/) folder for detailed documentation:

- [Getting Started](./docs/guides/getting-started.md)
- [REST API Reference](./docs/api/rest.md)
- [WebSocket Protocol](./docs/api/websocket.md)
- [Node Types Reference](./docs/reference/nodes.md)
- [Art-Net Tools & Protocol](./docs/packages/tools.md)

## Testing

```bash
pnpm --filter @let-there-be-light/shared test      # 23 tests
pnpm --filter @let-there-be-light/server test      # 167 tests
pnpm --filter @let-there-be-light/client test      # 89 unit tests
pnpm --filter @let-there-be-light/client test:integration:spawn  # 71 integration tests
```

## License

MIT
