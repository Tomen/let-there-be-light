# Getting Started

## Prerequisites

- Node.js 18+
- pnpm 8+

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd let-there-be-light

# Install dependencies
pnpm install

# Build shared types
pnpm build:shared
```

## Running the Server

```bash
# Development mode (auto-reload)
pnpm dev

# The server starts on:
# - REST API: http://localhost:3001/api
# - WebSocket: ws://localhost:3001/ws
```

## Testing the API

```bash
# List fixtures
curl http://localhost:3001/api/fixtures

# Create a fixture
curl -X POST http://localhost:3001/api/fixtures \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","modelId":"generic-rgbw","universe":0,"startChannel":100}'

# List presets
curl http://localhost:3001/api/presets

# Get a specific graph
curl http://localhost:3001/api/graphs/simple-pulse
```

## Testing WebSocket

Using [websocat](https://github.com/vi/websocat):

```bash
websocat ws://localhost:3001/ws

# You'll receive:
# {"type":"runtime/status","tickHz":60,"t":0,"instances":[]}

# Send a fader value:
{"type":"input/fader","faderId":"master","value":0.5}
```

## Project Structure

```
let-there-be-light/
├── packages/
│   ├── shared/          # TypeScript types
│   │   └── src/types/   # Domain, API, WS, Node types
│   ├── server/          # Control server
│   │   ├── src/
│   │   │   ├── datastore/   # YAML persistence
│   │   │   ├── routes/      # REST endpoints
│   │   │   └── ws/          # WebSocket gateway
│   │   └── data/        # YAML data files
│   └── artnet-core/     # Art-Net protocol
├── docs/                # Documentation
└── pnpm-workspace.yaml
```

## Default Data

The server seeds default data on first run:

**Fixture Models:**
- `generic-rgbw` - 4-channel RGBW par
- `generic-rgb` - 3-channel RGB par
- `generic-dimmer` - Single channel dimmer
- `moving-head-spot` - 11-channel moving head

**Fixtures:**
- `front-left`, `front-right`, `back-left`, `back-right`

**Groups:**
- `front` - Front fixtures
- `back` - Back fixtures
- `all-wash` - All wash fixtures

**Presets:**
- Colors: red, green, blue, white, warm, cool, amber, cyan, magenta, yellow
- Positions: center, audience, stage-left, stage-right
- Beam: wide, narrow, medium
- Full: blackout, full-on

**Graphs:**
- `simple-pulse` - Example sine wave color effect

## Next Steps

1. [Creating Graphs](./creating-graphs.md) - Build your own effects
2. [REST API Reference](../api/rest.md) - Full API documentation
3. [Node Types Reference](../reference/nodes.md) - Available graph nodes
