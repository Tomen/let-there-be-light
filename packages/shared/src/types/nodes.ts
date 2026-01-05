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
export type ParamType = 'string' | 'number' | 'boolean' | 'string[]';

// Parameter definition
export interface ParamDefinition {
  type: ParamType;
  default?: unknown;
  label?: string;
  min?: number;
  max?: number;
}

// Port definition - can have default values for connectable types (Scalar, Bool, Color, Position)
export interface PortDefinition {
  type: PortType;
  label?: string;
  default?: unknown;  // Default value when input is not connected
  min?: number;       // For Scalar type range
  max?: number;       // For Scalar type range
}

// Check if a port has a default value defined
export function hasDefault(port: PortDefinition): boolean {
  return 'default' in port && port.default !== undefined;
}

// Port types that can have configurable defaults
export const CONNECTABLE_PORT_TYPES: PortType[] = ['Scalar', 'Bool', 'Color', 'Position'];

export function isConnectableType(type: PortType): boolean {
  return CONNECTABLE_PORT_TYPES.includes(type);
}

// Node type names
export type NodeType =
  // Inputs
  | 'Time'
  | 'Fader'
  | 'Button'
  // Constants
  | 'Scalar'
  | 'Bool'
  | 'ColorConstant'
  | 'PositionConstant'
  // Selection
  | 'SelectGroup'
  | 'SelectFixture'
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
  | 'ColorToBundle'
  // Position ops
  | 'OffsetPosition'
  | 'ScalePosition'
  // Bundle ops
  | 'MergeBundle'
  | 'ScaleBundle'
  // Output
  | 'WriteAttributes';

// Node definition (used by compiler and editor)
export interface NodeDefinition {
  type: NodeType;
  category: 'input' | 'constant' | 'selection' | 'math' | 'effect' | 'color' | 'position' | 'bundle' | 'output';
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
  // Constant Nodes
  // ============================================
  Scalar: {
    type: 'Scalar',
    category: 'constant',
    label: 'Scalar',
    inputs: {
      value: { type: 'Scalar', label: 'Value', default: 0, min: 0, max: 1 },
    },
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {},
  },
  Bool: {
    type: 'Bool',
    category: 'constant',
    label: 'Bool',
    inputs: {
      value: { type: 'Bool', label: 'Value', default: false },
    },
    outputs: {
      value: { type: 'Bool', label: 'Value' },
    },
    params: {},
  },
  ColorConstant: {
    type: 'ColorConstant',
    category: 'constant',
    label: 'Color',
    inputs: {
      r: { type: 'Scalar', label: 'Red', default: 1, min: 0, max: 1 },
      g: { type: 'Scalar', label: 'Green', default: 1, min: 0, max: 1 },
      b: { type: 'Scalar', label: 'Blue', default: 1, min: 0, max: 1 },
    },
    outputs: {
      color: { type: 'Color', label: 'Color' },
    },
    params: {},
  },
  PositionConstant: {
    type: 'PositionConstant',
    category: 'constant',
    label: 'Position',
    inputs: {
      pan: { type: 'Scalar', label: 'Pan', default: 0, min: -1, max: 1 },
      tilt: { type: 'Scalar', label: 'Tilt', default: 0, min: -1, max: 1 },
    },
    outputs: {
      position: { type: 'Position', label: 'Position' },
    },
    params: {},
  },

  // ============================================
  // Selection Nodes
  // ============================================
  SelectGroup: {
    type: 'SelectGroup',
    category: 'selection',
    label: 'Select Groups',
    inputs: {},
    outputs: {
      selection: { type: 'Selection', label: 'Fixtures' },
    },
    params: {
      groupIds: { type: 'string[]', label: 'Groups' },
    },
  },
  SelectFixture: {
    type: 'SelectFixture',
    category: 'selection',
    label: 'Select Fixtures',
    inputs: {},
    outputs: {
      selection: { type: 'Selection', label: 'Fixtures' },
    },
    params: {
      fixtureIds: { type: 'string[]', label: 'Fixtures' },
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
      a: { type: 'Scalar', label: 'A', default: 0 },
      b: { type: 'Scalar', label: 'B', default: 0 },
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
      a: { type: 'Scalar', label: 'A', default: 1 },
      b: { type: 'Scalar', label: 'B', default: 1 },
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
      value: { type: 'Scalar', label: 'Input', default: 0 },
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
      value: { type: 'Scalar', label: 'Input', default: 0 },
      inMin: { type: 'Scalar', label: 'In Min', default: 0 },
      inMax: { type: 'Scalar', label: 'In Max', default: 1 },
      outMin: { type: 'Scalar', label: 'Out Min', default: 0 },
      outMax: { type: 'Scalar', label: 'Out Max', default: 1 },
    },
    outputs: {
      result: { type: 'Scalar', label: 'Mapped' },
    },
    params: {},
  },
  Smooth: {
    type: 'Smooth',
    category: 'math',
    label: 'Smooth',
    inputs: {
      value: { type: 'Scalar', label: 'Input', default: 0 },
      smoothing: { type: 'Scalar', label: 'Smoothing', default: 0.9, min: 0, max: 1 },
    },
    outputs: {
      result: { type: 'Scalar', label: 'Smoothed' },
    },
    params: {},
  },

  // ============================================
  // Effect Nodes
  // ============================================
  SineLFO: {
    type: 'SineLFO',
    category: 'effect',
    label: 'Sine LFO',
    inputs: {
      speed: { type: 'Scalar', label: 'Speed', default: 1 },
      frequency: { type: 'Scalar', label: 'Frequency (Hz)', default: 1, min: 0.01, max: 20 },
      phase: { type: 'Scalar', label: 'Phase', default: 0, min: 0, max: 1 },
    },
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {},
  },
  TriangleLFO: {
    type: 'TriangleLFO',
    category: 'effect',
    label: 'Triangle LFO',
    inputs: {
      speed: { type: 'Scalar', label: 'Speed', default: 1 },
      frequency: { type: 'Scalar', label: 'Frequency (Hz)', default: 1, min: 0.01, max: 20 },
      phase: { type: 'Scalar', label: 'Phase', default: 0, min: 0, max: 1 },
    },
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {},
  },
  SawLFO: {
    type: 'SawLFO',
    category: 'effect',
    label: 'Saw LFO',
    inputs: {
      speed: { type: 'Scalar', label: 'Speed', default: 1 },
      frequency: { type: 'Scalar', label: 'Frequency (Hz)', default: 1, min: 0.01, max: 20 },
      phase: { type: 'Scalar', label: 'Phase', default: 0, min: 0, max: 1 },
    },
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {},
  },
  Chase: {
    type: 'Chase',
    category: 'effect',
    label: 'Chase',
    inputs: {
      selection: { type: 'Selection', label: 'Fixtures' },
      speed: { type: 'Scalar', label: 'Speed', default: 1 },
      width: { type: 'Scalar', label: 'Width', default: 1, min: 1, max: 10 },
    },
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {},
  },
  Flash: {
    type: 'Flash',
    category: 'effect',
    label: 'Flash',
    inputs: {
      trigger: { type: 'Trigger', label: 'Trigger' },
      attack: { type: 'Scalar', label: 'Attack (s)', default: 0, min: 0, max: 2 },
      decay: { type: 'Scalar', label: 'Decay (s)', default: 0.5, min: 0, max: 5 },
    },
    outputs: {
      value: { type: 'Scalar', label: 'Value' },
    },
    params: {},
  },

  // ============================================
  // Color Nodes
  // ============================================
  MixColor: {
    type: 'MixColor',
    category: 'color',
    label: 'Mix Colors',
    inputs: {
      a: { type: 'Color', label: 'Color A', default: { r: 0, g: 0, b: 0 } },
      b: { type: 'Color', label: 'Color B', default: { r: 1, g: 1, b: 1 } },
      mix: { type: 'Scalar', label: 'Mix', default: 0.5, min: 0, max: 1 },
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
      color: { type: 'Color', label: 'Color', default: { r: 1, g: 1, b: 1 } },
      scale: { type: 'Scalar', label: 'Scale', default: 1, min: 0, max: 2 },
    },
    outputs: {
      result: { type: 'Color', label: 'Scaled' },
    },
    params: {},
  },
  ColorToBundle: {
    type: 'ColorToBundle',
    category: 'color',
    label: 'Color to Bundle',
    inputs: {
      color: { type: 'Color', label: 'Color', default: { r: 1, g: 1, b: 1 } },
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
      position: { type: 'Position', label: 'Position', default: { pan: 0, tilt: 0 } },
      deltaPan: { type: 'Scalar', label: 'Delta Pan', default: 0, min: -1, max: 1 },
      deltaTilt: { type: 'Scalar', label: 'Delta Tilt', default: 0, min: -1, max: 1 },
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
      position: { type: 'Position', label: 'Position', default: { pan: 0, tilt: 0 } },
      scale: { type: 'Scalar', label: 'Scale', default: 1, min: 0, max: 2 },
    },
    outputs: {
      result: { type: 'Position', label: 'Scaled' },
    },
    params: {},
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
      scale: { type: 'Scalar', label: 'Scale', default: 1, min: 0, max: 2 },
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
      priority: { type: 'Scalar', label: 'Priority', default: 0, min: 0, max: 100 },
    },
    outputs: {},
    params: {},
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
  return ['input', 'constant', 'selection', 'math', 'effect', 'color', 'position', 'bundle', 'output'];
}
