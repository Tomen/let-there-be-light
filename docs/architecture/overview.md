# System Overview

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     React Client (future)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Graph Editor │  │ Fixture Mgmt │  │ Live Preview │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP REST + WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Control Server                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  REST API    │  │  WS Gateway  │  │   DataStore  │       │
│  │  (Fastify)   │  │    (ws)      │  │    (YAML)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │Graph Compiler│  │Runtime Engine│  │ Art-Net      │       │
│  │  (DAG/Types) │  │   (60Hz)     │  │   Bridge     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                    ✓ Complete                                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Art-Net Core                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Protocol    │  │  Controller  │  │   Fixtures   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ UDP 6454 (Art-Net)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    GrandMA2 Console                          │
│                    (DMX Output)                              │
└─────────────────────────────────────────────────────────────┘
```

## Packages

### @let-there-be-light/shared
Shared TypeScript types used by both client and server:
- Domain types (Fixture, Group, Graph)
- API types (requests, responses, errors)
- WebSocket message types
- Node definitions for the graph system

### @let-there-be-light/server
Fastify-based control server:
- REST API for CRUD operations
- WebSocket gateway for real-time communication
- YAML-based persistence with optimistic concurrency
- Graph compiler (DAG validation, type checking, topological sort)
- Runtime engine (60Hz tick loop, 24 node evaluators, frame broadcast)

### @let-there-be-light/tools
Art-Net protocol and diagnostic tools:
- `artnet-protocol.ts` - Packet building/parsing
- `artnet-controller.ts` - DMX state management
- `fixtures.ts` - Fixture definitions and color mapping
- `diagnostics/` - CLI tools (ping, sniff, control, etc.)

### @let-there-be-light/mcp
MCP server for Claude Code integration:
- Exposes lighting control as MCP tools
- Depends on @let-there-be-light/tools

## Key Concepts

### Entities
- **Fixture**: A physical lighting unit patched at a DMX address
- **FixtureModel**: Reusable template defining channel layout
- **Group**: Named collection of fixtures
- **Graph**: Node-based effect/control flow

### Graph System
Graphs are directed acyclic graphs (DAGs) that define how inputs (time, faders, buttons) flow through processing nodes to produce output attribute values for fixtures.

### Runtime Loop
The runtime engine evaluates graphs at 60Hz:
1. Snapshot input state (faders, buttons)
2. Evaluate all enabled graph instances
3. Merge outputs by priority
4. Broadcast frame to WebSocket subscribers
5. Output to Art-Net

### Optimistic Concurrency
All entities have a `revision` field. Updates require the expected revision, and the server returns 409 Conflict if the revision doesn't match. This prevents lost updates in concurrent editing scenarios.
