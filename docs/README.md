# Let There Be Light - Documentation

A graph-based lighting control system with Art-Net output.

## Documentation Index

### Architecture
- [System Overview](./architecture/overview.md) - High-level architecture and components
- [Data Flow](./architecture/data-flow.md) - How data flows through the system

### API Reference
- [REST API](./api/rest.md) - HTTP endpoints for CRUD operations
- [WebSocket Protocol](./api/websocket.md) - Real-time communication protocol

### Guides
- [Getting Started](./guides/getting-started.md) - Quick start guide
- [Creating Graphs](./guides/creating-graphs.md) - How to build effect graphs

### Packages
- [@let-there-be-light/shared](./packages/shared.md) - Shared TypeScript types
- [@let-there-be-light/server](./packages/server.md) - Control server
- [@let-there-be-light/client](./packages/client.md) - React web client
- [@let-there-be-light/tools](./packages/tools.md) - Art-Net protocol and diagnostics
- [@let-there-be-light/mcp](./packages/tools.md#mcp-server) - MCP server for Claude Code integration

### Reference
- [Show Specification](./reference/show-specification.md) - Complete show file format
- [Node Types](./reference/nodes.md) - All available graph nodes
- [Data Models](./reference/models.md) - Entity schemas and validation

### Schemas
- [JSON Schemas](./schemas/) - JSON Schema files for validation
