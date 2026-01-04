# Claude.md - Let There Be Light

## Project Overview

Graph-based lighting control system with Art-Net output for church lighting via GrandMA2. Structured as a pnpm monorepo.

## Monorepo Structure

```
packages/
  shared/     # Shared TypeScript types
  server/     # Fastify REST API + WebSocket + Runtime Engine + Art-Net
  client/     # React web client with graph editor
  tools/      # Art-Net diagnostic tools and protocol
  mcp/        # MCP server for Claude Code integration
docs/         # Detailed documentation
data/         # Show data (not in git)
  fixture-models.yaml  # Shared across all shows
  default/             # Default show
  <show>/              # Additional shows
```

## Quick Start

```bash
pnpm install
pnpm --filter @let-there-be-light/shared build   # Build types first
pnpm --filter @let-there-be-light/server dev     # Start server
pnpm --filter @let-there-be-light/client dev     # Start client
```

## Running Tests

```bash
pnpm --filter @let-there-be-light/shared test
pnpm --filter @let-there-be-light/server test
pnpm --filter @let-there-be-light/client test
pnpm --filter @let-there-be-light/client test:integration:spawn
```

## URLs

- **Server REST API:** http://localhost:3001/api
- **Server WebSocket:** ws://localhost:3001/ws
- **Client:** http://localhost:5173

## Environment Variables (Server)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | HTTP server port |
| `HOST` | 0.0.0.0 | Bind address |
| `DATA_DIR` | `<project>/data` | Root data directory |
| `SHOW` | `default` | Active show subfolder |
| `ARTNET_BROADCAST` | 2.255.255.255 | Art-Net broadcast address |
| `ARTNET_ENABLED` | true | Set to "false" to disable DMX output |

**Using shows:**
```bash
SHOW=sunday-service pnpm --filter @let-there-be-light/server dev
```

## Network Configuration

- **GrandMA2 Primary:** 2.0.0.1
- **GrandMA2 Secondary:** 2.0.0.2
- **Laptop IP:** 2.0.0.10
- **Broadcast:** 2.255.255.255
- **Art-Net Port:** UDP 6454

## Diagnostic Tools

```bash
pnpm run ping      # Test network connectivity
pnpm run sniff     # Listen for Art-Net traffic
pnpm run discover  # Find Art-Net devices
pnpm run control   # Interactive DMX control
pnpm run fixture   # Fixture and group control
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React Client (packages/client)                         │
│  - Patch, Inputs, Presets, Graphs, Control Room, Runtime│
│  - Graph Editor (ReactFlow)                             │
└─────────────────────────────────────────────────────────┘
         │ HTTP REST + WebSocket
         ▼
┌─────────────────────────────────────┐
│  Control Server (packages/server)   │
│  - REST API (Fastify)               │
│  - WebSocket gateway                │
│  - YAML persistence (DataStore)     │
│  - Graph compiler (DAG validation)  │
│  - Runtime engine (60Hz tick loop)  │
│  - Art-Net bridge (DMX output)      │
└─────────────────────────────────────┘
         │ UDP 6454 (Art-Net)
         ▼
┌─────────────────────────────────────┐
│  GrandMA2 Console                   │
└─────────────────────────────────────┘
```

## Detailed Documentation

For comprehensive documentation, see the `docs/` folder:

- **API:** `docs/api/rest.md`, `docs/api/websocket.md`
- **Packages:** `docs/packages/server.md`, `docs/packages/client.md`, `docs/packages/shared.md`
- **Art-Net:** `docs/packages/tools.md` (protocol reference, troubleshooting)
- **Reference:** `docs/reference/show-specification.md` (complete show file format), `docs/reference/nodes.md` (24 node types), `docs/reference/models.md`
- **Guides:** `docs/guides/getting-started.md`, `docs/guides/creating-graphs.md`
- **Schemas:** `docs/schemas/*.schema.json` (JSON Schema for validation)

## Test Coverage

| Package | Tests |
|---------|-------|
| shared | 23 |
| server | 167 |
| client (unit) | 89 |
| client (integration) | 71 |
| **Total** | **350** |

## Development Status

**Complete:**
- Monorepo scaffolding (pnpm workspaces)
- Shared types (domain, api, ws, nodes)
- Fastify server with REST endpoints
- YAML DataStore with optimistic concurrency
- Graph compiler (DAG validation, type checking)
- Runtime engine (60Hz, 24 node evaluators)
- Art-Net bridge (DMX output)
- React client with graph editor
- Unit and integration tests

**Future:**
- Hot reload for YAML files
- Production deployment
