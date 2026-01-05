// Port types for graph validation
export type PortType =
  | 'Scalar'    // Number 0..1 or -1..1
  | 'Bool'      // true/false
  | 'Color'     // { r, g, b } each 0..1
  | 'Position'  // { pan, tilt } each -1..1
  | 'Bundle'    // Full or partial AttributeBundle
  | 'Selection' // Set of fixture IDs
  | 'Trigger';  // Edge-triggered event (button press)

// Parameter types for node configuration
export type ParamType = 'string' | 'number' | 'boolean';

// Parameter definition
export interface ParamDefinition {
  type: ParamType;
  default?: unknown;
  label?: string;
  min?: number;
  max?: number;
}

// Port definition
export interface PortDefinition {
  type: PortType;
  label?: string;
}

// Node type names
export type NodeType =
  // Inputs
  | 'Time'
  | 'Fader'
  | 'Button'
  // Selection
  | 'SelectGroup'
  | 'SelectFixture'
  // Presets
  | 'PresetBundle'
  // Math/Shaping
  | 'Add'
  | 'Multiply'
  | 'Clamp01'
  | 'MapRange'
  | 'Smooth'
  // Effects
  | 'SineLFO'
  | 'TriangleLFO'
  | 'SawLFO'
  | 'Chase'
  | 'Flash'
  // Color ops
  | 'MixColor'
  | 'ScaleColor'
  | 'ColorConstant'
  | 'ColorToBundle'
  // Position ops
  | 'OffsetPosition'
  | 'ScalePosition'
  | 'PositionConstant'
  // Bundle ops
  | 'MergeBundle'
  | 'ScaleBundle'
  // Output
  | 'WriteAttributes';

// Node definition (used by compiler and editor)
export interface NodeDefinition {
  type: NodeType;
  category: 'input' | 'selection' | 'preset' | 'math' | 'effect' | 'color' | 'position' | 'bundle' | 'output';
  label: string;
  inputs: Record<string, PortDefinition>;
  outputs: Record<string, PortDefinition>;
  params: Record<string, ParamDefinition>;
}

// All node definitions
export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  // ============================================
  // Input Nodes
  // ============================================
  Time: {
    type: 'Time',
    category: 'input',
    label: 'Time',
    inputs: {},
    outputs: {
      t: { type: 'Scalar', label: 'Time (s)' },
      dt: { type: 'Scalar', label: 'Delta Time' },
    },
    params: {},
  },
  Fader: {
    type: 'Fader',
    category: 'input',
    label: 'Fader',
    inputs: {},
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {
      faderId: { type: 'string', label: 'Fader ID' },
    },
  },
  Button: {
    type: 'Button',
    category: 'input',
    label: 'Button',
    inputs: {},
    outputs: {
      pressed: { type: 'Trigger', label: 'Pressed' },
      down: { type: 'Bool', label: 'Is Down' },
    },
    params: {
      buttonId: { type: 'string', label: 'Button ID' },
    },
  },

  // ============================================
  // Selection Nodes
  // ============================================
  SelectGroup: {
    type: 'SelectGroup',
    category: 'selection',
    label: 'Select Group',
    inputs: {},
    outputs: {
      selection: { type: 'Selection', label: 'Fixtures' },
    },
    params: {
      groupId: { type: 'string', label: 'Group ID' },
    },
  },
  SelectFixture: {
    type: 'SelectFixture',
    category: 'selection',
    label: 'Select Fixture',
    inputs: {},
    outputs: {
      selection: { type: 'Selection', label: 'Fixture' },
    },
    params: {
      fixtureId: { type: 'string', label: 'Fixture ID' },
    },
  },

  // ============================================
  // Preset Nodes
  // ============================================
  PresetBundle: {
    type: 'PresetBundle',
    category: 'preset',
    label: 'Preset',
    inputs: {},
    outputs: {
      bundle: { type: 'Bundle', label: 'Attributes' },
    },
    params: {
      presetId: { type: 'string', label: 'Preset ID' },
    },
  },

  // ============================================
  // Math/Shaping Nodes
  // ============================================
  Add: {
    type: 'Add',
    category: 'math',
    label: 'Add',
    inputs: {
      a: { type: 'Scalar', label: 'A' },
      b: { type: 'Scalar', label: 'B' },
    },
    outputs: {
      result: { type: 'Scalar', label: 'Result' },
    },
    params: {},
  },
  Multiply: {
    type: 'Multiply',
    category: 'math',
    label: 'Multiply',
    inputs: {
      a: { type: 'Scalar', label: 'A' },
      b: { type: 'Scalar', label: 'B' },
    },
    outputs: {
      result: { type: 'Scalar', label: 'Result' },
    },
    params: {},
  },
  Clamp01: {
    type: 'Clamp01',
    category: 'math',
    label: 'Clamp 0-1',
    inputs: {
      value: { type: 'Scalar', label: 'Input' },
    },
    outputs: {
      result: { type: 'Scalar', label: 'Clamped' },
    },
    params: {},
  },
  MapRange: {
    type: 'MapRange',
    category: 'math',
    label: 'Map Range',
    inputs: {
      value: { type: 'Scalar', label: 'Input' },
    },
    outputs: {
      result: { type: 'Scalar', label: 'Mapped' },
    },
    params: {
      inMin: { type: 'number', default: 0, label: 'In Min' },
      inMax: { type: 'number', default: 1, label: 'In Max' },
      outMin: { type: 'number', default: 0, label: 'Out Min' },
      outMax: { type: 'number', default: 1, label: 'Out Max' },
    },
  },
  Smooth: {
    type: 'Smooth',
    category: 'math',
    label: 'Smooth',
    inputs: {
      value: { type: 'Scalar', label: 'Input' },
    },
    outputs: {
      result: { type: 'Scalar', label: 'Smoothed' },
    },
    params: {
      smoothing: { type: 'number', default: 0.9, min: 0, max: 1, label: 'Smoothing' },
    },
  },

  // ============================================
  // Effect Nodes
  // ============================================
  SineLFO: {
    type: 'SineLFO',
    category: 'effect',
    label: 'Sine LFO',
    inputs: {
      speed: { type: 'Scalar', label: 'Speed' },
    },
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {
      frequency: { type: 'number', default: 1, min: 0.01, max: 20, label: 'Frequency (Hz)' },
      phase: { type: 'number', default: 0, min: 0, max: 1, label: 'Phase' },
    },
  },
  TriangleLFO: {
    type: 'TriangleLFO',
    category: 'effect',
    label: 'Triangle LFO',
    inputs: {
      speed: { type: 'Scalar', label: 'Speed' },
    },
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {
      frequency: { type: 'number', default: 1, min: 0.01, max: 20, label: 'Frequency (Hz)' },
      phase: { type: 'number', default: 0, min: 0, max: 1, label: 'Phase' },
    },
  },
  SawLFO: {
    type: 'SawLFO',
    category: 'effect',
    label: 'Saw LFO',
    inputs: {
      speed: { type: 'Scalar', label: 'Speed' },
    },
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {
      frequency: { type: 'number', default: 1, min: 0.01, max: 20, label: 'Frequency (Hz)' },
      phase: { type: 'number', default: 0, min: 0, max: 1, label: 'Phase' },
    },
  },
  Chase: {
    type: 'Chase',
    category: 'effect',
    label: 'Chase',
    inputs: {
      selection: { type: 'Selection', label: 'Fixtures' },
      speed: { type: 'Scalar', label: 'Speed' },
    },
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {
      width: { type: 'number', default: 1, min: 1, max: 10, label: 'Width' },
    },
  },
  Flash: {
    type: 'Flash',
    category: 'effect',
    label: 'Flash',
    inputs: {
      trigger: { type: 'Trigger', label: 'Trigger' },
    },
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {
      attack: { type: 'number', default: 0, min: 0, max: 2, label: 'Attack (s)' },
      decay: { type: 'number', default: 0.5, min: 0, max: 5, label: 'Decay (s)' },
    },
  },

  // ============================================
  // Color Nodes
  // ============================================
  MixColor: {
    type: 'MixColor',
    category: 'color',
    label: 'Mix Colors',
    inputs: {
      a: { type: 'Color', label: 'Color A' },
      b: { type: 'Color', label: 'Color B' },
      mix: { type: 'Scalar', label: 'Mix' },
    },
    outputs: {
      result: { type: 'Color', label: 'Mixed' },
    },
    params: {},
  },
  ScaleColor: {
    type: 'ScaleColor',
    category: 'color',
    label: 'Scale Color',
    inputs: {
      color: { type: 'Color', label: 'Color' },
      scale: { type: 'Scalar', label: 'Scale' },
    },
    outputs: {
      result: { type: 'Color', label: 'Scaled' },
    },
    params: {},
  },
  ColorConstant: {
    type: 'ColorConstant',
    category: 'color',
    label: 'Color',
    inputs: {},
    outputs: {
      color: { type: 'Color', label: 'Color' },
    },
    params: {
      r: { type: 'number', default: 1, min: 0, max: 1, label: 'Red' },
      g: { type: 'number', default: 1, min: 0, max: 1, label: 'Green' },
      b: { type: 'number', default: 1, min: 0, max: 1, label: 'Blue' },
    },
  },
  ColorToBundle: {
    type: 'ColorToBundle',
    category: 'color',
    label: 'Color to Bundle',
    inputs: {
      color: { type: 'Color', label: 'Color' },
    },
    outputs: {
      bundle: { type: 'Bundle', label: 'Bundle' },
    },
    params: {},
  },

  // ============================================
  // Position Nodes
  // ============================================
  OffsetPosition: {
    type: 'OffsetPosition',
    category: 'position',
    label: 'Offset Position',
    inputs: {
      position: { type: 'Position', label: 'Position' },
      deltaPan: { type: 'Scalar', label: 'Delta Pan' },
      deltaTilt: { type: 'Scalar', label: 'Delta Tilt' },
    },
    outputs: {
      result: { type: 'Position', label: 'Offset' },
    },
    params: {},
  },
  ScalePosition: {
    type: 'ScalePosition',
    category: 'position',
    label: 'Scale Position',
    inputs: {
      position: { type: 'Position', label: 'Position' },
      scale: { type: 'Scalar', label: 'Scale' },
    },
    outputs: {
      result: { type: 'Position', label: 'Scaled' },
    },
    params: {},
  },
  PositionConstant: {
    type: 'PositionConstant',
    category: 'position',
    label: 'Position',
    inputs: {},
    outputs: {
      position: { type: 'Position', label: 'Position' },
    },
    params: {
      pan: { type: 'number', default: 0, min: -1, max: 1, label: 'Pan' },
      tilt: { type: 'number', default: 0, min: -1, max: 1, label: 'Tilt' },
    },
  },

  // ============================================
  // Bundle Nodes
  // ============================================
  MergeBundle: {
    type: 'MergeBundle',
    category: 'bundle',
    label: 'Merge Bundles',
    inputs: {
      base: { type: 'Bundle', label: 'Base' },
      override: { type: 'Bundle', label: 'Override' },
    },
    outputs: {
      result: { type: 'Bundle', label: 'Merged' },
    },
    params: {},
  },
  ScaleBundle: {
    type: 'ScaleBundle',
    category: 'bundle',
    label: 'Scale Bundle',
    inputs: {
      bundle: { type: 'Bundle', label: 'Bundle' },
      scale: { type: 'Scalar', label: 'Scale' },
    },
    outputs: {
      result: { type: 'Bundle', label: 'Scaled' },
    },
    params: {},
  },

  // ============================================
  // Output Nodes
  // ============================================
  WriteAttributes: {
    type: 'WriteAttributes',
    category: 'output',
    label: 'Write Attributes',
    inputs: {
      selection: { type: 'Selection', label: 'Fixtures' },
      bundle: { type: 'Bundle', label: 'Attributes' },
    },
    outputs: {},
    params: {
      priority: { type: 'number', default: 0, min: 0, max: 100, label: 'Priority' },
    },
  },
};

// Helper to get node definition
export function getNodeDefinition(type: NodeType): NodeDefinition {
  return NODE_DEFINITIONS[type];
}

// Get all node types by category
export function getNodesByCategory(category: NodeDefinition['category']): NodeType[] {
  return Object.values(NODE_DEFINITIONS)
    .filter((def) => def.category === category)
    .map((def) => def.type);
}

// Get all categories
export function getCategories(): NodeDefinition['category'][] {
  return ['input', 'selection', 'preset', 'math', 'effect', 'color', 'position', 'bundle', 'output'];
}
