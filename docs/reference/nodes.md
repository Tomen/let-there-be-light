# Node Types Reference

All available node types for building graphs.

## Port Types

| Type | Description | Example Values |
|------|-------------|----------------|
| Scalar | Number | 0.0 - 1.0 or -1.0 - 1.0 |
| Bool | Boolean | true, false |
| Color | RGB color | `{ r: 1, g: 0.5, b: 0 }` |
| Position | Pan/Tilt | `{ pan: 0, tilt: -0.5 }` |
| Bundle | Attribute bundle | `{ intensity: 1, color: {...} }` |
| Selection | Fixture set | Set of fixture IDs |
| Trigger | Edge event | Button press |

---

## Input Nodes

### Time
Provides current time values.

| Outputs | Type | Description |
|---------|------|-------------|
| t | Scalar | Time in seconds |
| dt | Scalar | Delta time since last frame |

### Fader
Reads a fader value.

| Params | Type | Description |
|--------|------|-------------|
| faderId | string | Fader identifier |

| Outputs | Type | Description |
|---------|------|-------------|
| value | Scalar | Fader value (0-1) |

### Button
Reads button state.

| Params | Type | Description |
|--------|------|-------------|
| buttonId | string | Button identifier |

| Outputs | Type | Description |
|---------|------|-------------|
| pressed | Trigger | Edge trigger on press |
| down | Bool | Is button held down |

---

## Selection Nodes

### SelectGroup
Selects fixtures in a group.

| Params | Type | Description |
|--------|------|-------------|
| groupId | string | Group ID |

| Outputs | Type | Description |
|---------|------|-------------|
| selection | Selection | Fixtures in group |

### SelectFixture
Selects a single fixture.

| Params | Type | Description |
|--------|------|-------------|
| fixtureId | string | Fixture ID |

| Outputs | Type | Description |
|---------|------|-------------|
| selection | Selection | Single fixture |

---

## Preset Nodes

### PresetBundle
Outputs a preset's attribute bundle.

| Params | Type | Description |
|--------|------|-------------|
| presetId | string | Preset ID |

| Outputs | Type | Description |
|---------|------|-------------|
| bundle | Bundle | Preset attributes |

---

## Math Nodes

### Add
Adds two scalars.

| Inputs | Type | Description |
|--------|------|-------------|
| a | Scalar | First operand |
| b | Scalar | Second operand |

| Outputs | Type | Description |
|---------|------|-------------|
| result | Scalar | a + b |

### Multiply
Multiplies two scalars.

| Inputs | Type | Description |
|--------|------|-------------|
| a | Scalar | First operand |
| b | Scalar | Second operand |

| Outputs | Type | Description |
|---------|------|-------------|
| result | Scalar | a * b |

### Clamp01
Clamps value to 0-1 range.

| Inputs | Type | Description |
|--------|------|-------------|
| value | Scalar | Input value |

| Outputs | Type | Description |
|---------|------|-------------|
| result | Scalar | Clamped value |

### MapRange
Maps value from one range to another.

| Params | Type | Default |
|--------|------|---------|
| inMin | number | 0 |
| inMax | number | 1 |
| outMin | number | 0 |
| outMax | number | 1 |

| Inputs | Type | Description |
|--------|------|-------------|
| value | Scalar | Input value |

| Outputs | Type | Description |
|---------|------|-------------|
| result | Scalar | Mapped value |

### Smooth
Smooths value changes over time.

| Params | Type | Default |
|--------|------|---------|
| smoothing | number | 0.9 |

| Inputs | Type | Description |
|--------|------|-------------|
| value | Scalar | Input value |

| Outputs | Type | Description |
|---------|------|-------------|
| result | Scalar | Smoothed value |

---

## Effect Nodes

### SineLFO
Sine wave oscillator.

| Params | Type | Default |
|--------|------|---------|
| frequency | number | 1 Hz |
| phase | number | 0 |

| Inputs | Type | Description |
|--------|------|-------------|
| speed | Scalar | Speed multiplier (optional) |

| Outputs | Type | Description |
|---------|------|-------------|
| value | Scalar | 0-1 sine wave |

### TriangleLFO
Triangle wave oscillator.

| Params | Type | Default |
|--------|------|---------|
| frequency | number | 1 Hz |
| phase | number | 0 |

| Outputs | Type | Description |
|---------|------|-------------|
| value | Scalar | 0-1 triangle wave |

### SawLFO
Sawtooth wave oscillator.

| Params | Type | Default |
|--------|------|---------|
| frequency | number | 1 Hz |
| phase | number | 0 |

| Outputs | Type | Description |
|---------|------|-------------|
| value | Scalar | 0-1 sawtooth wave |

### Chase
Chase effect across fixtures.

| Params | Type | Default |
|--------|------|---------|
| width | number | 1 |

| Inputs | Type | Description |
|--------|------|-------------|
| selection | Selection | Fixtures to chase |
| speed | Scalar | Chase speed |

| Outputs | Type | Description |
|---------|------|-------------|
| value | Scalar | Per-fixture chase value |

### Flash
Triggered flash effect.

| Params | Type | Default |
|--------|------|---------|
| attack | number | 0 seconds |
| decay | number | 0.5 seconds |

| Inputs | Type | Description |
|--------|------|-------------|
| trigger | Trigger | Flash trigger |

| Outputs | Type | Description |
|---------|------|-------------|
| value | Scalar | Flash envelope |

---

## Color Nodes

### MixColor
Mixes two colors.

| Inputs | Type | Description |
|--------|------|-------------|
| a | Color | First color |
| b | Color | Second color |
| mix | Scalar | Mix amount (0=a, 1=b) |

| Outputs | Type | Description |
|---------|------|-------------|
| result | Color | Mixed color |

### ScaleColor
Scales color intensity.

| Inputs | Type | Description |
|--------|------|-------------|
| color | Color | Input color |
| scale | Scalar | Scale factor |

| Outputs | Type | Description |
|---------|------|-------------|
| result | Color | Scaled color |

### ColorConstant
Constant color value.

| Params | Type | Default |
|--------|------|---------|
| r | number | 1 |
| g | number | 1 |
| b | number | 1 |

| Outputs | Type | Description |
|---------|------|-------------|
| color | Color | Constant color |

---

## Position Nodes

### OffsetPosition
Offsets a position.

| Inputs | Type | Description |
|--------|------|-------------|
| position | Position | Input position |
| deltaPan | Scalar | Pan offset |
| deltaTilt | Scalar | Tilt offset |

| Outputs | Type | Description |
|---------|------|-------------|
| result | Position | Offset position |

### ScalePosition
Scales a position.

| Inputs | Type | Description |
|--------|------|-------------|
| position | Position | Input position |
| scale | Scalar | Scale factor |

| Outputs | Type | Description |
|---------|------|-------------|
| result | Position | Scaled position |

### PositionConstant
Constant position value.

| Params | Type | Default |
|--------|------|---------|
| pan | number | 0 |
| tilt | number | 0 |

| Outputs | Type | Description |
|---------|------|-------------|
| position | Position | Constant position |

---

## Bundle Nodes

### MergeBundle
Merges two bundles (override takes precedence).

| Inputs | Type | Description |
|--------|------|-------------|
| base | Bundle | Base attributes |
| override | Bundle | Override attributes |

| Outputs | Type | Description |
|---------|------|-------------|
| result | Bundle | Merged bundle |

### ScaleBundle
Scales all values in a bundle.

| Inputs | Type | Description |
|--------|------|-------------|
| bundle | Bundle | Input bundle |
| scale | Scalar | Scale factor |

| Outputs | Type | Description |
|---------|------|-------------|
| result | Bundle | Scaled bundle |

---

## Output Nodes

### WriteAttributes
Writes attributes to fixtures.

| Params | Type | Default |
|--------|------|---------|
| priority | number | 0 |

| Inputs | Type | Description |
|--------|------|-------------|
| selection | Selection | Target fixtures |
| bundle | Bundle | Attributes to write |

Higher priority outputs override lower priority for the same fixture.
