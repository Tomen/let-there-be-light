# Creating Graphs

Graphs are node-based effect definitions that control fixture attributes over time.

## Concepts

### Nodes
Nodes are processing units with inputs, outputs, and parameters.

```json
{
  "id": "lfo1",
  "type": "SineLFO",
  "position": { "x": 300, "y": 100 },
  "params": {
    "frequency": 1,
    "phase": 0
  }
}
```

### Edges
Edges connect node outputs to inputs.

```json
{
  "id": "e1",
  "from": { "nodeId": "lfo1", "port": "value" },
  "to": { "nodeId": "scale1", "port": "scale" }
}
```

### Port Types
- **Scalar** - Number (0-1 or -1 to 1)
- **Bool** - true/false
- **Color** - `{ r, g, b }` (0-1)
- **Position** - `{ pan, tilt }` (-1 to 1)
- **Bundle** - Partial AttributeBundle
- **Selection** - Set of fixture IDs
- **Trigger** - Edge-triggered event

## Example: Simple Pulse

A pulsing color effect on all fixtures.

```json
{
  "name": "Simple Pulse",
  "nodes": [
    {
      "id": "lfo",
      "type": "SineLFO",
      "position": { "x": 100, "y": 100 },
      "params": { "frequency": 1 }
    },
    {
      "id": "color",
      "type": "ColorConstant",
      "position": { "x": 100, "y": 200 },
      "params": { "r": 1, "g": 0, "b": 0 }
    },
    {
      "id": "scale",
      "type": "ScaleColor",
      "position": { "x": 300, "y": 150 },
      "params": {}
    },
    {
      "id": "group",
      "type": "SelectGroup",
      "position": { "x": 300, "y": 300 },
      "params": { "groupId": "all-wash" }
    },
    {
      "id": "output",
      "type": "WriteAttributes",
      "position": { "x": 500, "y": 200 },
      "params": { "priority": 0 }
    }
  ],
  "edges": [
    { "id": "e1", "from": { "nodeId": "lfo", "port": "value" }, "to": { "nodeId": "scale", "port": "scale" } },
    { "id": "e2", "from": { "nodeId": "color", "port": "color" }, "to": { "nodeId": "scale", "port": "color" } },
    { "id": "e3", "from": { "nodeId": "scale", "port": "result" }, "to": { "nodeId": "output", "port": "bundle" } },
    { "id": "e4", "from": { "nodeId": "group", "port": "selection" }, "to": { "nodeId": "output", "port": "selection" } }
  ]
}
```

### Data Flow

```
SineLFO ──(value)──┐
                   ├──> ScaleColor ──(result)──> WriteAttributes
ColorConstant ─────┘                                    ▲
                                                        │
SelectGroup ───────────────────────────(selection)──────┘
```

## Example: Fader-Controlled Intensity

```json
{
  "name": "Master Dimmer",
  "nodes": [
    {
      "id": "fader",
      "type": "Fader",
      "params": { "faderId": "master" }
    },
    {
      "id": "color",
      "type": "ColorConstant",
      "params": { "r": 1, "g": 1, "b": 1 }
    },
    {
      "id": "scale",
      "type": "ScaleColor",
      "params": {}
    },
    {
      "id": "group",
      "type": "SelectGroup",
      "params": { "groupId": "all-wash" }
    },
    {
      "id": "output",
      "type": "WriteAttributes",
      "params": { "priority": 0 }
    }
  ],
  "edges": [
    { "id": "e1", "from": { "nodeId": "fader", "port": "value" }, "to": { "nodeId": "scale", "port": "scale" } },
    { "id": "e2", "from": { "nodeId": "color", "port": "color" }, "to": { "nodeId": "scale", "port": "color" } },
    { "id": "e3", "from": { "nodeId": "scale", "port": "result" }, "to": { "nodeId": "output", "port": "bundle" } },
    { "id": "e4", "from": { "nodeId": "group", "port": "selection" }, "to": { "nodeId": "output", "port": "selection" } }
  ]
}
```

## Example: Button Flash

```json
{
  "name": "Flash Effect",
  "nodes": [
    {
      "id": "button",
      "type": "Button",
      "params": { "buttonId": "flash" }
    },
    {
      "id": "flash",
      "type": "Flash",
      "params": { "attack": 0, "decay": 0.5 }
    },
    {
      "id": "color",
      "type": "ColorConstant",
      "params": { "r": 1, "g": 1, "b": 1 }
    },
    {
      "id": "scale",
      "type": "ScaleColor",
      "params": {}
    },
    {
      "id": "group",
      "type": "SelectGroup",
      "params": { "groupId": "all-wash" }
    },
    {
      "id": "output",
      "type": "WriteAttributes",
      "params": { "priority": 10 }
    }
  ],
  "edges": [
    { "id": "e1", "from": { "nodeId": "button", "port": "pressed" }, "to": { "nodeId": "flash", "port": "trigger" } },
    { "id": "e2", "from": { "nodeId": "flash", "port": "value" }, "to": { "nodeId": "scale", "port": "scale" } },
    { "id": "e3", "from": { "nodeId": "color", "port": "color" }, "to": { "nodeId": "scale", "port": "color" } },
    { "id": "e4", "from": { "nodeId": "scale", "port": "result" }, "to": { "nodeId": "output", "port": "bundle" } },
    { "id": "e5", "from": { "nodeId": "group", "port": "selection" }, "to": { "nodeId": "output", "port": "selection" } }
  ]
}
```

## Validation Rules

1. **No cycles** - The graph must be a DAG
2. **Type matching** - Connected ports must have compatible types
3. **Required inputs** - Required inputs must be connected
4. **Valid references** - Groups, fixtures, and inputs must exist

## Creating via API

```bash
curl -X POST http://localhost:3001/api/graphs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Effect",
    "nodes": [...],
    "edges": [...]
  }'
```

## Compiling

After creating or updating, compile to check for errors:

```bash
curl -X POST http://localhost:3001/api/graphs/my-effect/compile
```
