# REST API Reference

Base URL: `http://localhost:3001/api`

## Common Patterns

### Response Format
All successful responses wrap data in a `data` field:
```json
{
  "data": { ... }
}
```

### Error Format
```json
{
  "error": "Human readable message",
  "code": "ERROR_CODE"
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Entity does not exist |
| `CONFLICT` | 409 | Revision mismatch (optimistic concurrency) |
| `VALIDATION_ERROR` | 400 | Invalid input data |

### Optimistic Concurrency
All entities have a `revision` field (integer starting at 1).

**Update Request:**
```json
{
  "data": { "name": "New Name" },
  "revision": 1
}
```

If the current revision doesn't match, returns 409 Conflict.

---

## Health Check

### GET /api/health
```json
{
  "status": "ok",
  "timestamp": 1704412800000,
  "version": "1.0.0"
}
```

---

## Fixtures

### GET /api/fixtures
List all fixtures.

**Response:**
```json
{
  "data": [
    {
      "id": "front-left",
      "name": "Front Left",
      "modelId": "generic-rgbw",
      "universe": 0,
      "startChannel": 1,
      "revision": 1
    }
  ]
}
```

### GET /api/fixtures/models
List all fixture models.

**Response:**
```json
{
  "data": [
    {
      "id": "generic-rgbw",
      "brand": "Generic",
      "model": "RGBW Par",
      "channels": { "red": 1, "green": 2, "blue": 3, "white": 4 }
    }
  ]
}
```

### POST /api/fixtures
Create a fixture.

**Request:**
```json
{
  "name": "Stage Left",
  "modelId": "generic-rgbw",
  "universe": 0,
  "startChannel": 17
}
```

**Response:** 201 Created
```json
{
  "data": {
    "id": "abc123",
    "name": "Stage Left",
    "modelId": "generic-rgbw",
    "universe": 0,
    "startChannel": 17,
    "revision": 1
  }
}
```

### GET /api/fixtures/:id
Get a single fixture.

### PUT /api/fixtures/:id
Update a fixture.

**Request:**
```json
{
  "data": { "name": "New Name" },
  "revision": 1
}
```

### DELETE /api/fixtures/:id
Delete a fixture. Also removes it from all groups.

---

## Groups

### GET /api/groups
List all groups.

**Response:**
```json
{
  "data": [
    {
      "id": "front",
      "name": "Front",
      "fixtureIds": ["front-left", "front-right"],
      "revision": 1
    }
  ]
}
```

### POST /api/groups
Create a group.

**Request:**
```json
{
  "name": "Stage",
  "fixtureIds": ["front-left", "front-right", "back-left"]
}
```

### GET /api/groups/:id
Get a single group.

### PUT /api/groups/:id
Update a group.

### DELETE /api/groups/:id
Delete a group (does not delete fixtures).

---

## Presets

### GET /api/presets
List all presets.

**Response:**
```json
{
  "data": [
    {
      "id": "red",
      "name": "Red",
      "type": "color",
      "attributes": { "color": { "r": 1, "g": 0, "b": 0 } },
      "revision": 1
    }
  ]
}
```

### GET /api/presets/by-type/:type
List presets by type. Types: `color`, `position`, `beam`, `full`

### POST /api/presets
Create a preset.

**Request:**
```json
{
  "name": "Purple",
  "type": "color",
  "attributes": { "color": { "r": 0.5, "g": 0, "b": 1 } }
}
```

### GET /api/presets/:id
Get a single preset.

### PUT /api/presets/:id
Update a preset.

### DELETE /api/presets/:id
Delete a preset.

---

## Graphs

### GET /api/graphs
List all graphs.

**Response:**
```json
{
  "data": [
    {
      "id": "simple-pulse",
      "name": "Simple Pulse",
      "nodes": [...],
      "edges": [...],
      "revision": 1
    }
  ]
}
```

### POST /api/graphs
Create a graph.

**Request:**
```json
{
  "name": "My Effect",
  "nodes": [
    { "id": "time", "type": "Time", "position": { "x": 100, "y": 100 }, "params": {} }
  ],
  "edges": []
}
```

### GET /api/graphs/:id
Get a single graph.

### PUT /api/graphs/:id
Update a graph.

### DELETE /api/graphs/:id
Delete a graph.

### POST /api/graphs/:id/compile
Compile and validate a graph.

**Response:**
```json
{
  "ok": true,
  "errors": [],
  "dependencies": {
    "faderIds": ["master"],
    "buttonIds": ["flash"],
    "presetIds": ["red"],
    "groupIds": ["front"],
    "fixtureIds": []
  }
}
```

**Error Response:**
```json
{
  "ok": false,
  "errors": [
    {
      "nodeId": "lfo",
      "port": "speed",
      "message": "Required input not connected",
      "code": "MISSING_CONNECTION"
    }
  ],
  "dependencies": {}
}
```

---

## Inputs

Inputs are configurable faders and buttons that can be referenced by Fader and Button nodes in graphs.

### GET /api/inputs
List all inputs.

**Response:**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Master",
      "type": "fader",
      "revision": 1
    },
    {
      "id": "b2c3d4e5-f6g7-8901-bcde-f12345678901",
      "name": "Flash",
      "type": "button",
      "revision": 1
    }
  ]
}
```

### GET /api/inputs/faders
List faders only.

### GET /api/inputs/buttons
List buttons only.

### POST /api/inputs
Create an input.

**Request:**
```json
{
  "name": "Speed",
  "type": "fader"
}
```

**Response:** 201 Created
```json
{
  "data": {
    "id": "c3d4e5f6-g7h8-9012-cdef-123456789012",
    "name": "Speed",
    "type": "fader",
    "revision": 1
  }
}
```

### GET /api/inputs/:id
Get a single input.

### PUT /api/inputs/:id
Update an input (rename).

**Request:**
```json
{
  "data": { "name": "Master Fader" },
  "revision": 1
}
```

### GET /api/inputs/:id/usage
Check which graphs use this input.

**Response:**
```json
{
  "data": {
    "inputId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "usedBy": [
      { "graphId": "simple-pulse", "graphName": "Simple Pulse" },
      { "graphId": "color-wash", "graphName": "Color Wash" }
    ]
  }
}
```

### DELETE /api/inputs/:id
Delete an input.

**Note:** Deletion is blocked if the input is used by any graph. Returns 400 with details:

```json
{
  "error": "Cannot delete input: used by 2 graph(s): Simple Pulse, Color Wash",
  "code": "VALIDATION_ERROR"
}
```

---

## Shows

Shows are subdirectories in the data folder containing fixtures, groups, presets, and graphs.

### GET /api/shows
List all available shows.

**Response:**
```json
{
  "data": [
    {
      "id": "default",
      "name": "default",
      "isActive": true
    },
    {
      "id": "sunday-service",
      "name": "sunday-service",
      "isActive": false
    }
  ]
}
```

### GET /api/shows/current
Get the currently active show.

**Response:**
```json
{
  "data": {
    "show": "default",
    "dataDir": "/path/to/data/default"
  }
}
```

### POST /api/shows/:name/activate
Switch to a different show at runtime.

**Request:** No body required.

**Response:**
```json
{
  "data": {
    "show": "sunday-service"
  }
}
```

**Side Effects:**
- Unloads all graph instances from runtime
- Resets all datastores
- Reloads graphs from new show
- Broadcasts `show/changed` to all WebSocket clients

**Errors:**
- 404 if show directory doesn't exist
