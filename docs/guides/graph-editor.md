# Graph Editor Guide

The Graph Editor is a visual node-based interface for creating lighting effects. This guide covers the UI components and interactions.

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back    Graph Name    [Save] [Compile]                        │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│  Node    │            Canvas (ReactFlow)                         │
│ Palette  │                                                       │
│          │    ┌─────────┐     ┌─────────┐     ┌─────────┐       │
│ Inputs   │    │ SineLFO │────>│ Scale   │────>│ Write   │       │
│ Constants│    └─────────┘     │ Color   │     │ Attrs   │       │
│ Selection│                    └─────────┘     └─────────┘       │
│ Math     │                                                       │
│ Effects  │                                                       │
│ Color    ├───────────────────────────────────────────────────────┤
│ Position │  Compile Errors (if any)                              │
│ Bundle   │                                                       │
│ Output   │                                                       │
└──────────┴───────────────────────────────────────────────────────┘
```

---

## Node Palette

The left sidebar contains all available node types, organized by category:

| Category | Nodes | Purpose |
|----------|-------|---------|
| Inputs | Time, Fader, Button | External data sources |
| Constants | ScalarConstant, BoolConstant, ColorConstant, PositionConstant | Fixed values |
| Selection | SelectGroup, SelectFixture | Target fixture selection |
| Math | Add, Multiply, Clamp01, MapRange, Smooth | Value transformations |
| Effects | SineLFO, TriangleLFO, SawLFO, Chase, Flash | Time-based animations |
| Color | MixColor, ScaleColor | Color manipulation |
| Position | OffsetPosition, ScalePosition | Position manipulation |
| Bundle | MergeBundle, ScaleBundle | Attribute bundling |
| Output | WriteAttributes | DMX output |

### Adding Nodes

**Drag & Drop:**
1. Click and drag a node from the palette
2. Drop onto the canvas at desired position

**Click to Add:**
1. Click a node in the palette
2. Node appears at default position (top-left area)

---

## Canvas

The main work area uses [ReactFlow](https://reactflow.dev/) for the node graph.

### Navigation

| Action | Control |
|--------|---------|
| Pan | Click and drag on empty space |
| Zoom | Mouse wheel / trackpad pinch |
| Fit View | Double-click empty space |

### Grid Snapping

Nodes snap to a 15x15 pixel grid for alignment.

### Selection

| Action | Control |
|--------|---------|
| Select node | Click on node |
| Multi-select | Shift+click or drag selection box |
| Deselect | Click empty space |

### Deleting

| Action | Control |
|--------|---------|
| Delete node | Select node, press Delete or Backspace |
| Delete edge | Select edge, press Delete or Backspace |

---

## Node Components

Each node displays:

```
┌─────────────────────────────┐
│ Node Label          (header)│  ← Color-coded by category
├─────────────────────────────┤
│ ● input1    output1 ●       │  ← Ports with type-colored handles
│ ● input2    output2 ●       │
├─────────────────────────────┤
│ [param1 dropdown]           │  ← Inline parameter editors
│ [param2 chips]              │
└─────────────────────────────┘
```

### Header Colors

| Category | Color |
|----------|-------|
| Input | Green |
| Constant | Teal |
| Selection | Cyan |
| Math | Blue |
| Effect | Purple |
| Color | Red-Orange gradient |
| Position | Indigo |
| Bundle | Amber |
| Output | Red |

### Port Colors

| Type | Color |
|------|-------|
| Scalar | Blue |
| Bool | Yellow |
| Color | RGB gradient |
| Position | Purple |
| Bundle | Orange |
| Selection | Cyan |
| Trigger | Pink |

---

## Inline Editing

All node parameters are editable directly on the node.

### Scalar Values

Click the value to edit:
```
┌─────────────┐
│ Speed  0.50 │  ← Click to edit
└─────────────┘
     ↓
┌─────────────┐
│ Speed [___] │  ← Type new value, Enter to commit
└─────────────┘
```

- **Enter**: Commit value
- **Escape**: Cancel edit
- **Click outside**: Commit value
- Values are clamped to min/max if defined

### Boolean Values

Click the checkbox to toggle:
```
│ Invert  [✓] │  ← Click to toggle
```

### Color Values

Click the swatch to open picker:
```
│ Color  [■] │  ← Click swatch
      ↓
┌─────────────────────┐
│ [color picker]      │
│ R ━━━━━━━━━━━ 255   │
│ G ━━━━━━━━━━━ 128   │
│ B ━━━━━━━━━━━  64   │
└─────────────────────┘
```

### Position Values

Click the coordinates to open editor:
```
│ Pos  0.50,0.25 │  ← Click to edit
        ↓
┌─────────────────────┐
│ Pan  ━━━━━━━━ 0.50  │
│ Tilt ━━━━━━━━ 0.25  │
└─────────────────────┘
```

### Single-Select Dropdowns

For Fader and Button nodes:
```
┌───────────────────────┐
│ [Master Fader ▼]      │  ← Click to open dropdown
└───────────────────────┘
        ↓
┌───────────────────────┐
│ Master Fader          │
│ Intensity             │
│ Color Wheel           │
└───────────────────────┘
```

### Multi-Select (Groups/Fixtures)

For SelectGroup and SelectFixture nodes:
```
┌───────────────────────┐
│ [Front Wash    ×]     │  ← Selected items as chips
│ [Back Wash     ×]     │
│ [+ Add]               │  ← Click to add more
└───────────────────────┘
        ↓
┌───────────────────────┐
│ [✓] Front Wash        │
│ [✓] Back Wash         │
│ [ ] Stage Left        │
│ [ ] Stage Right       │
└───────────────────────┘
```

- Click × to remove item
- Click "+ Add" to open multi-select popover
- Check/uncheck items to toggle selection

---

## Connections

### Creating Connections

1. Click and drag from an output port (right side)
2. Drop on a compatible input port (left side)

**Type Safety**: Only compatible types can connect:
- Same type connects (Scalar → Scalar)
- Color/Position → Bundle (auto-wraps)
- Incompatible types show warning and reject

### Edge Styling

- Edges use "smoothstep" routing
- Connected inputs hide their default value editors

---

## Auto-Save

Changes auto-save after 1.5 seconds of inactivity:

```
│ Graph Name                    │
│ 5 nodes, 4 edges • Unsaved    │  ← Indicates pending changes
```

Manual save: Click **Save** button.

---

## Compilation

Click **Compile** to validate the graph:

### Success

```
┌──────────────────────────────────┐
│ ✓ Graph compiled successfully    │
└──────────────────────────────────┘
```

### Errors

Errors appear in the bottom panel:

```
┌─────────────────────────────────────────────────┐
│ ⚠ Compilation failed with 2 errors              │
├─────────────────────────────────────────────────┤
│ ● scale1: Required input not connected: scale   │  ← Click to select node
│ ● output1: Type mismatch: Scalar → Color        │
└─────────────────────────────────────────────────┘
```

Click an error to select and focus the problematic node.

### Error Codes

| Code | Meaning |
|------|---------|
| `UNKNOWN_NODE_TYPE` | Invalid node type |
| `CYCLE_DETECTED` | Graph contains a loop |
| `TYPE_MISMATCH` | Incompatible port types |
| `MISSING_CONNECTION` | Required input not connected |
| `INVALID_PARAM` | Parameter validation failed |

---

## Best Practices

### Layout Tips

1. **Flow left-to-right**: Inputs on left, outputs on right
2. **Group related nodes**: Keep effect chains together
3. **Use spacing**: Leave room for labels and connections
4. **Align vertically**: Stack similar nodes for clarity

### Graph Organization

```
Inputs          Processing        Output
─────────────────────────────────────────
Time ─┐
      ├─> SineLFO ─┐
Fader ┘            │
                   ├─> ScaleColor ─┐
ColorConst ────────┘               │
                                   ├─> WriteAttrs
SelectGroup ───────────────────────┘
```

### Common Patterns

**Basic Intensity Control:**
```
Fader ──> ScaleColor ──> WriteAttributes
             ↑
ColorConstant
```

**LFO Animation:**
```
SineLFO ──> ScaleColor ──> WriteAttributes
                ↑
ColorConstant
```

**Button Flash:**
```
Button ──> Flash ──> ScaleColor ──> WriteAttributes
                         ↑
           ColorConstant
```

**Multi-Group Effect:**
```
                    ┌──> WriteAttributes (priority: 0)
SelectGroup(Front) ─┤
                    └──┐
                       ├──> MergeBundle ──> WriteAttributes (priority: 10)
SelectGroup(Back) ─────┘
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Delete / Backspace | Delete selected node(s) |
| Escape | Deselect all / Cancel edit |
| Enter | Commit inline edit |

---

## Files Reference

| File | Purpose |
|------|---------|
| `pages/GraphEditor/index.tsx` | Main page component |
| `pages/GraphEditor/GraphCanvas.tsx` | ReactFlow canvas wrapper |
| `pages/GraphEditor/NodePalette.tsx` | Node category sidebar |
| `pages/GraphEditor/CompileErrorPanel.tsx` | Error display panel |
| `pages/GraphEditor/GraphContext.tsx` | Shared editing context |
| `pages/GraphEditor/nodes/GraphNodeComponent.tsx` | Node rendering |
| `pages/GraphEditor/nodes/EditableValue.tsx` | Inline value editors |
| `pages/GraphEditor/nodes/InlineParamEditor.tsx` | Param dropdowns |

---

## Related Documentation

- [Creating Graphs](./creating-graphs.md) - Graph concepts and examples
- [Graph Compiler](./graph-compiler.md) - Compilation and runtime details
- [Node Types Reference](../reference/nodes.md) - All available nodes
