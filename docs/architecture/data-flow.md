# Data Flow

## CRUD Operations

```
Client                    Server                     Storage
  │                         │                          │
  │  POST /api/fixtures     │                          │
  │ ───────────────────────>│                          │
  │                         │  validate                │
  │                         │  assign ID & revision    │
  │                         │  ──────────────────────> │ fixtures.yaml
  │                         │                          │
  │  201 { data: fixture }  │                          │
  │ <───────────────────────│                          │
```

## Optimistic Concurrency

```
Client A                  Server                    Client B
  │                         │                          │
  │  GET /api/fixtures/1    │                          │
  │ ───────────────────────>│                          │
  │  { revision: 1 }        │                          │
  │ <───────────────────────│                          │
  │                         │   GET /api/fixtures/1    │
  │                         │ <────────────────────────│
  │                         │   { revision: 1 }        │
  │                         │ ────────────────────────>│
  │                         │                          │
  │  PUT revision: 1        │                          │
  │ ───────────────────────>│                          │
  │  200 { revision: 2 }    │                          │
  │ <───────────────────────│                          │
  │                         │                          │
  │                         │   PUT revision: 1        │
  │                         │ <────────────────────────│
  │                         │   409 Conflict           │
  │                         │ ────────────────────────>│
```

## Real-time Frame Streaming (Planned)

```
                    Runtime Engine
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
       Fader Input   Time (60Hz)   Button Events
            │             │             │
            └─────────────┼─────────────┘
                          │
                          ▼
                   Graph Evaluation
                          │
                          ▼
                   Frame Output
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
      WebSocket      Art-Net       Console
      Clients        Output        Preview
```

## WebSocket Message Flow

### Client to Server
```
Client                         Server
  │                              │
  │  input/fader                 │
  │  { faderId, value }          │
  │ ────────────────────────────>│
  │                              │  Update InputState
  │                              │
  │  runtime/subscribeFrames     │
  │  { mode: "full" }            │
  │ ────────────────────────────>│
  │                              │  Add to subscribers
```

### Server to Client
```
Server                         Client
  │                              │
  │  On connect:                 │
  │  runtime/status              │
  │ ────────────────────────────>│
  │                              │
  │  Every tick (if subscribed): │
  │  frame/full                  │
  │ ────────────────────────────>│
  │                              │
  │  On graph change:            │
  │  compile/result              │
  │ ────────────────────────────>│
```
