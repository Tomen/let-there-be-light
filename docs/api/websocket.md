# WebSocket Protocol

Endpoint: `ws://localhost:3001/ws`

## Connection

On connect, the server sends a `runtime/status` message with the current state.

## Message Format

All messages are JSON with a `type` field for routing.

---

## Client → Server Messages

### input/fader
Set a fader value.

```json
{
  "type": "input/fader",
  "faderId": "master",
  "value": 0.75
}
```
- `value`: 0.0 to 1.0

### input/buttonDown
Button pressed down.

```json
{
  "type": "input/buttonDown",
  "buttonId": "flash"
}
```

### input/buttonUp
Button released.

```json
{
  "type": "input/buttonUp",
  "buttonId": "flash"
}
```

### input/buttonPress
Convenience message for momentary press (triggers edge event).

```json
{
  "type": "input/buttonPress",
  "buttonId": "flash"
}
```

### runtime/subscribeFrames
Subscribe to frame updates.

```json
{
  "type": "runtime/subscribeFrames",
  "mode": "full",
  "fixtureIds": ["front-left", "front-right"]
}
```
- `mode`: `"full"` (complete frame) or `"delta"` (changes only)
- `fixtureIds`: Optional filter. Omit for all fixtures.

### runtime/unsubscribeFrames
Stop receiving frame updates.

```json
{
  "type": "runtime/unsubscribeFrames"
}
```

### runtime/setTickRate
Change the runtime tick rate (development only).

```json
{
  "type": "runtime/setTickRate",
  "hz": 30
}
```

### instance/setEnabled
Enable or disable a graph instance.

```json
{
  "type": "instance/setEnabled",
  "instanceId": "simple-pulse",
  "enabled": true
}
```

---

## Server → Client Messages

### runtime/status
Current runtime state. Sent on connect and when status changes.

```json
{
  "type": "runtime/status",
  "tickHz": 60,
  "t": 123.456,
  "instances": [
    {
      "id": "simple-pulse",
      "graphId": "simple-pulse",
      "enabled": true,
      "lastError": null,
      "errorCount": 0,
      "writes": [
        {
          "nodeId": "write-1",
          "selection": ["front-left", "front-right"],
          "bundle": {
            "color": { "r": 1, "g": 0, "b": 0 }
          },
          "priority": 0
        }
      ]
    }
  ]
}
```

#### InstanceStatus Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Instance identifier |
| `graphId` | string | Graph ID this instance is running |
| `enabled` | boolean | Whether the graph is active |
| `lastError` | string? | Last error message if any |
| `errorCount` | number? | Number of evaluation errors |
| `writes` | WriteOutputInfo[]? | Current WriteAttributes outputs |

#### WriteOutputInfo Fields

| Field | Type | Description |
|-------|------|-------------|
| `nodeId` | string | ID of the WriteAttributes node |
| `selection` | string[] | Fixture IDs being written to |
| `bundle` | AttributeBundle | Attributes being written (intensity, color, pan, tilt, zoom) |
| `priority` | number | Write priority (higher wins when merged) |

### compile/result
Graph compilation result. Sent when a graph is updated.

```json
{
  "type": "compile/result",
  "graphId": "simple-pulse",
  "ok": true,
  "errors": []
}
```

### frame/full
Complete frame data for all subscribed fixtures.

```json
{
  "type": "frame/full",
  "t": 123.456,
  "fixtures": {
    "front-left": {
      "intensity": 1,
      "color": { "r": 1, "g": 0.5, "b": 0 }
    },
    "front-right": {
      "intensity": 0.8,
      "color": { "r": 1, "g": 0.5, "b": 0 }
    }
  }
}
```

### frame/delta
Only changed values since last frame.

```json
{
  "type": "frame/delta",
  "t": 123.472,
  "changes": {
    "front-left": {
      "intensity": 0.95
    }
  }
}
```

### error
Error response for invalid client messages.

```json
{
  "type": "error",
  "message": "Unknown message type",
  "code": "UNKNOWN_TYPE"
}
```

### show/changed
Broadcast when the active show is switched via REST API.

```json
{
  "type": "show/changed",
  "show": "sunday-service"
}
```

**Client Action:** Invalidate all cached data and refetch. All fixtures, groups, presets, and graphs have changed.

---

## Example Session

```
# Client connects
<-- {"type":"runtime/status","tickHz":60,"t":0,"instances":[]}

# Client subscribes to frames
--> {"type":"runtime/subscribeFrames","mode":"full"}

# Server sends frames at 60Hz
<-- {"type":"frame/full","t":0.016,"fixtures":{...}}
<-- {"type":"frame/full","t":0.033,"fixtures":{...}}

# Client adjusts fader
--> {"type":"input/fader","faderId":"master","value":0.5}

# Frames now reflect fader change
<-- {"type":"frame/full","t":0.050,"fixtures":{...}}
```
