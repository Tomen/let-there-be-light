# Show File Specification

This document defines the complete structure and format of show files for Let There Be Light.

## Overview

A **show** is a complete lighting configuration containing fixtures, groups, presets, and effect graphs. Shows are stored as YAML files in the data directory.

## Directory Structure

```
data/
  fixture-models.yaml     # Shared across all shows
  default/                # Show: "default"
    fixtures.yaml
    groups.yaml
    presets.yaml
    inputs.yaml
    graphs.yaml
  sunday-service/         # Show: "sunday-service"
    fixtures.yaml
    groups.yaml
    presets.yaml
    inputs.yaml
    graphs.yaml
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `<project>/data` | Root data directory |
| `SHOW` | `default` | Active show subfolder |

### Switching Shows

```bash
# Use default show
pnpm --filter @let-there-be-light/server dev

# Use specific show
SHOW=sunday-service pnpm --filter @let-there-be-light/server dev
```

---

## Shared Files

### fixture-models.yaml

Fixture models are shared across all shows. They define the channel layout for each fixture type.

**Location:** `data/fixture-models.yaml`

**Schema:** [fixture-model.schema.json](../schemas/fixture-model.schema.json)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (lowercase, hyphens) |
| `brand` | string | Yes | Manufacturer name |
| `model` | string | Yes | Model name |
| `channels` | object | Yes | Channel name → offset mapping (1-based) |
| `revision` | integer | Yes | Version for concurrency |

#### Example

```yaml
- id: generic-rgbw
  brand: Generic
  model: RGBW Par
  channels:
    red: 1
    green: 2
    blue: 3
    white: 4
  revision: 1

- id: moving-head-spot
  brand: Generic
  model: Moving Head Spot
  channels:
    pan: 1
    panFine: 2
    tilt: 3
    tiltFine: 4
    dimmer: 5
    shutter: 6
    red: 7
    green: 8
    blue: 9
    white: 10
    zoom: 11
  revision: 1
```

#### Standard Channel Names

| Channel | Description |
|---------|-------------|
| `red`, `green`, `blue`, `white` | Color channels |
| `dimmer` | Master intensity |
| `pan`, `panFine` | Pan position (coarse/fine) |
| `tilt`, `tiltFine` | Tilt position (coarse/fine) |
| `zoom` | Beam width |
| `shutter` | Strobe/shutter |

---

## Per-Show Files

### fixtures.yaml

Patched fixture instances at specific DMX addresses.

**Schema:** [fixture.schema.json](../schemas/fixture.schema.json)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `modelId` | string | Yes | Reference to fixture model |
| `universe` | integer | Yes | Art-Net universe (0-32767) |
| `startChannel` | integer | Yes | First DMX channel (1-512) |
| `revision` | integer | Yes | Version for concurrency |

#### Example

```yaml
- id: front-left
  name: Front Left
  modelId: generic-rgbw
  universe: 0
  startChannel: 1
  revision: 1

- id: front-right
  name: Front Right
  modelId: generic-rgbw
  universe: 0
  startChannel: 5
  revision: 1
```

#### Validation Rules

- `modelId` must reference an existing fixture model
- `universe` must be >= 0
- `startChannel` must be 1-512
- Fixtures should not overlap channels (not enforced, but recommended)

---

### groups.yaml

Named collections of fixtures for batch control.

**Schema:** [group.schema.json](../schemas/group.schema.json)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `fixtureIds` | string[] | Yes | List of fixture IDs |
| `revision` | integer | Yes | Version for concurrency |

#### Example

```yaml
- id: front
  name: Front Wash
  fixtureIds:
    - front-left
    - front-right
  revision: 1

- id: all-wash
  name: All Wash
  fixtureIds:
    - front-left
    - front-right
    - back-left
    - back-right
  revision: 1
```

#### Validation Rules

- All `fixtureIds` must reference existing fixtures
- `fixtureIds` should be unique within a group

---

### presets.yaml

Saved attribute values for quick recall.

**Schema:** [preset.schema.json](../schemas/preset.schema.json)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `type` | string | Yes | One of: `color`, `position`, `beam`, `full` |
| `attributes` | object | Yes | Attribute values |
| `revision` | integer | Yes | Version for concurrency |

#### Preset Types

| Type | Typical Attributes |
|------|-------------------|
| `color` | `color` (RGB) |
| `position` | `pan`, `tilt` |
| `beam` | `intensity`, `zoom` |
| `full` | Any combination |

#### Attribute Values

| Attribute | Type | Range | Description |
|-----------|------|-------|-------------|
| `intensity` | number | 0-1 | Dimmer level |
| `color` | object | - | RGB color |
| `color.r` | number | 0-1 | Red |
| `color.g` | number | 0-1 | Green |
| `color.b` | number | 0-1 | Blue |
| `pan` | number | -1 to 1 | Horizontal position |
| `tilt` | number | -1 to 1 | Vertical position |
| `zoom` | number | 0-1 | Beam width |

#### Example

```yaml
# Color presets
- id: red
  name: Red
  type: color
  attributes:
    color: { r: 1, g: 0, b: 0 }
  revision: 1

- id: warm-white
  name: Warm White
  type: color
  attributes:
    color: { r: 1, g: 0.8, b: 0.6 }
  revision: 1

# Position presets
- id: center
  name: Center Stage
  type: position
  attributes:
    pan: 0
    tilt: -0.2
  revision: 1

# Beam presets
- id: full-open
  name: Full Open
  type: beam
  attributes:
    intensity: 1
    zoom: 0.5
  revision: 1

# Full presets
- id: warm-wash
  name: Warm Wash
  type: full
  attributes:
    intensity: 0.8
    color: { r: 1, g: 0.8, b: 0.6 }
  revision: 1
```

---

### inputs.yaml

Configurable faders and buttons for runtime control.

**Schema:** [inputs.schema.json](../schemas/inputs.schema.json)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (auto-generated UUID) |
| `name` | string | Yes | Display name |
| `type` | string | Yes | One of: `fader`, `button` |
| `revision` | integer | Yes | Version for concurrency |

#### Input Types

| Type | Description | Usage |
|------|-------------|-------|
| `fader` | Continuous 0-1 slider | Volume, intensity, speed controls |
| `button` | Momentary trigger | Flash effects, scene triggers |

#### Example

```yaml
# Faders
- id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
  name: Master
  type: fader
  revision: 1

- id: b2c3d4e5-f6g7-8901-bcde-f12345678901
  name: Effect Speed
  type: fader
  revision: 1

# Buttons
- id: c3d4e5f6-g7h8-9012-cdef-123456789012
  name: Flash
  type: button
  revision: 1

- id: d4e5f6g7-h8i9-0123-defg-234567890123
  name: Blackout
  type: button
  revision: 1
```

#### Default Inputs

When a show is first initialized, default inputs are created:

**Faders:** A, B, C, D, E, F, G, H
**Buttons:** X, Y, Z, P

#### Validation Rules

- `name` must be non-empty
- `type` must be `fader` or `button`
- Deletion is blocked if input is referenced by any graph

---

### graphs.yaml

Node-based effect definitions evaluated at 60Hz.

**Schema:** [graph.schema.json](../schemas/graph.schema.json)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `enabled` | boolean | No | Run at startup (default: true) |
| `nodes` | array | Yes | Processing nodes |
| `edges` | array | Yes | Connections between nodes |
| `revision` | integer | Yes | Version for concurrency |

#### Node Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique within graph |
| `type` | string | Yes | Node type (see below) |
| `position` | object | Yes | Editor position `{x, y}` |
| `params` | object | Yes | Node-specific parameters |

#### Edge Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique within graph |
| `from` | object | Yes | Source `{nodeId, port}` |
| `to` | object | Yes | Target `{nodeId, port}` |

#### Node Types

| Category | Nodes |
|----------|-------|
| Input | `Time`, `Fader`, `Button` |
| Selection | `SelectGroup`, `SelectFixture`, `PresetBundle` |
| Math | `Add`, `Multiply`, `Clamp01`, `MapRange`, `Smooth` |
| Effect | `SineLFO`, `TriangleLFO`, `SawLFO`, `Chase`, `Flash` |
| Color | `MixColor`, `ScaleColor`, `ColorConstant` |
| Position | `OffsetPosition`, `ScalePosition`, `PositionConstant` |
| Bundle | `MergeBundle`, `ScaleBundle` |
| Output | `WriteAttributes` |

See [Node Types Reference](./nodes.md) for complete documentation.

#### Example

```yaml
- id: simple-pulse
  name: Simple Pulse
  enabled: true
  nodes:
    - id: time
      type: Time
      position: { x: 100, y: 100 }
      params: {}

    - id: lfo
      type: SineLFO
      position: { x: 300, y: 100 }
      params:
        frequency: 0.5

    - id: group
      type: SelectGroup
      position: { x: 100, y: 200 }
      params:
        groupId: front

    - id: preset
      type: PresetBundle
      position: { x: 300, y: 200 }
      params:
        presetId: red

    - id: scale
      type: ScaleBundle
      position: { x: 500, y: 150 }
      params: {}

    - id: output
      type: WriteAttributes
      position: { x: 700, y: 150 }
      params:
        priority: 0

  edges:
    - id: e1
      from: { nodeId: time, port: t }
      to: { nodeId: lfo, port: speed }

    - id: e2
      from: { nodeId: lfo, port: value }
      to: { nodeId: scale, port: scale }

    - id: e3
      from: { nodeId: preset, port: bundle }
      to: { nodeId: scale, port: bundle }

    - id: e4
      from: { nodeId: group, port: selection }
      to: { nodeId: output, port: selection }

    - id: e5
      from: { nodeId: scale, port: result }
      to: { nodeId: output, port: bundle }

  revision: 1
```

---

## Entity Relationships

```
fixture-models.yaml (shared)
        │
        ▼
fixtures.yaml ─────────────► groups.yaml
        │                          │
        │                          ▼
        │                    graphs.yaml ◄──── inputs.yaml
        ▼                          │
                                   ▼
                             presets.yaml
```

**Dependencies:**
- Fixtures reference fixture models
- Groups reference fixtures
- Graphs reference groups, fixtures, presets, and inputs (via node params)
- Inputs are referenced by Fader and Button nodes in graphs

---

## Validation Rules

### General

- All IDs must be unique within their file
- `revision` starts at 1 and increments on each update
- YAML files must be valid YAML arrays

### Referential Integrity

| Entity | References | Enforcement |
|--------|------------|-------------|
| Fixture | FixtureModel | Validated on create/update |
| Group | Fixture | Fixtures removed from group if deleted |
| Graph | Group, Fixture, Preset, Input | Validated at compile time |
| Input | (none) | Deletion blocked if used by any graph |

### Value Constraints

| Value | Range | Description |
|-------|-------|-------------|
| Universe | 0-32767 | Art-Net universe |
| Channel | 1-512 | DMX channel |
| Intensity | 0-1 | Normalized dimmer |
| Color RGB | 0-1 | Per-channel |
| Pan/Tilt | -1 to 1 | Position |
| Zoom | 0-1 | Beam width |

---

## JSON Schemas

Formal JSON Schema files for validation:

- [fixture-model.schema.json](../schemas/fixture-model.schema.json)
- [fixture.schema.json](../schemas/fixture.schema.json)
- [group.schema.json](../schemas/group.schema.json)
- [preset.schema.json](../schemas/preset.schema.json)
- [inputs.schema.json](../schemas/inputs.schema.json)
- [graph.schema.json](../schemas/graph.schema.json)

Use these with any JSON Schema validator to validate YAML files.
