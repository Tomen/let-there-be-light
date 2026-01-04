import { describe, it, expect } from 'vitest';
import {
  NODE_DEFINITIONS,
  getNodeDefinition,
  getNodesByCategory,
  getCategories,
  type NodeType,
  type PortType,
} from './nodes.js';

describe('NODE_DEFINITIONS', () => {
  it('should define all expected node types', () => {
    const expectedTypes: NodeType[] = [
      // Inputs
      'Time', 'Fader', 'Button',
      // Selection
      'SelectGroup', 'SelectFixture',
      // Presets
      'PresetBundle',
      // Math
      'Add', 'Multiply', 'Clamp01', 'MapRange', 'Smooth',
      // Effects
      'SineLFO', 'TriangleLFO', 'SawLFO', 'Chase', 'Flash',
      // Color
      'MixColor', 'ScaleColor', 'ColorConstant',
      // Position
      'OffsetPosition', 'ScalePosition', 'PositionConstant',
      // Bundle
      'MergeBundle', 'ScaleBundle',
      // Output
      'WriteAttributes',
    ];

    for (const type of expectedTypes) {
      expect(NODE_DEFINITIONS[type], `Missing definition for ${type}`).toBeDefined();
    }
  });

  describe('Time node', () => {
    it('should have correct structure', () => {
      const def = NODE_DEFINITIONS.Time;

      expect(def.type).toBe('Time');
      expect(def.category).toBe('input');
      expect(Object.keys(def.inputs)).toHaveLength(0);
      expect(def.outputs.t.type).toBe('Scalar');
      expect(def.outputs.dt.type).toBe('Scalar');
    });
  });

  describe('Fader node', () => {
    it('should have faderId param', () => {
      const def = NODE_DEFINITIONS.Fader;

      expect(def.params.faderId).toBeDefined();
      expect(def.params.faderId.type).toBe('string');
    });

    it('should output Scalar', () => {
      const def = NODE_DEFINITIONS.Fader;

      expect(def.outputs.value.type).toBe('Scalar');
    });
  });

  describe('Button node', () => {
    it('should have buttonId param', () => {
      const def = NODE_DEFINITIONS.Button;

      expect(def.params.buttonId).toBeDefined();
      expect(def.params.buttonId.type).toBe('string');
    });

    it('should output Trigger and Bool', () => {
      const def = NODE_DEFINITIONS.Button;

      expect(def.outputs.pressed.type).toBe('Trigger');
      expect(def.outputs.down.type).toBe('Bool');
    });
  });

  describe('SelectGroup node', () => {
    it('should output Selection', () => {
      const def = NODE_DEFINITIONS.SelectGroup;

      expect(def.outputs.selection.type).toBe('Selection');
    });
  });

  describe('SineLFO node', () => {
    it('should have frequency and phase params', () => {
      const def = NODE_DEFINITIONS.SineLFO;

      expect(def.params.frequency).toBeDefined();
      expect(def.params.frequency.default).toBe(1);
      expect(def.params.phase).toBeDefined();
    });

    it('should have optional speed input', () => {
      const def = NODE_DEFINITIONS.SineLFO;

      expect(def.inputs.speed).toBeDefined();
      expect(def.inputs.speed.type).toBe('Scalar');
    });
  });

  describe('MixColor node', () => {
    it('should take two colors and a mix value', () => {
      const def = NODE_DEFINITIONS.MixColor;

      expect(def.inputs.a.type).toBe('Color');
      expect(def.inputs.b.type).toBe('Color');
      expect(def.inputs.mix.type).toBe('Scalar');
    });

    it('should output Color', () => {
      const def = NODE_DEFINITIONS.MixColor;

      expect(def.outputs.result.type).toBe('Color');
    });
  });

  describe('WriteAttributes node', () => {
    it('should take selection and bundle inputs', () => {
      const def = NODE_DEFINITIONS.WriteAttributes;

      expect(def.inputs.selection.type).toBe('Selection');
      expect(def.inputs.bundle.type).toBe('Bundle');
    });

    it('should have no outputs', () => {
      const def = NODE_DEFINITIONS.WriteAttributes;

      expect(Object.keys(def.outputs)).toHaveLength(0);
    });

    it('should have priority param', () => {
      const def = NODE_DEFINITIONS.WriteAttributes;

      expect(def.params.priority).toBeDefined();
      expect(def.params.priority.default).toBe(0);
    });
  });
});

describe('getNodeDefinition', () => {
  it('should return definition for valid type', () => {
    const def = getNodeDefinition('Time');

    expect(def.type).toBe('Time');
  });
});

describe('getNodesByCategory', () => {
  it('should return input nodes', () => {
    const inputNodes = getNodesByCategory('input');

    expect(inputNodes).toContain('Time');
    expect(inputNodes).toContain('Fader');
    expect(inputNodes).toContain('Button');
  });

  it('should return effect nodes', () => {
    const effectNodes = getNodesByCategory('effect');

    expect(effectNodes).toContain('SineLFO');
    expect(effectNodes).toContain('Flash');
  });

  it('should return output nodes', () => {
    const outputNodes = getNodesByCategory('output');

    expect(outputNodes).toContain('WriteAttributes');
  });
});

describe('getCategories', () => {
  it('should return all categories', () => {
    const categories = getCategories();

    expect(categories).toContain('input');
    expect(categories).toContain('selection');
    expect(categories).toContain('preset');
    expect(categories).toContain('math');
    expect(categories).toContain('effect');
    expect(categories).toContain('color');
    expect(categories).toContain('position');
    expect(categories).toContain('bundle');
    expect(categories).toContain('output');
  });
});

describe('Node definition consistency', () => {
  it('all nodes should have matching type in definition', () => {
    for (const [key, def] of Object.entries(NODE_DEFINITIONS)) {
      expect(def.type).toBe(key);
    }
  });

  it('all nodes should have a category', () => {
    for (const def of Object.values(NODE_DEFINITIONS)) {
      expect(def.category).toBeDefined();
    }
  });

  it('all nodes should have a label', () => {
    for (const def of Object.values(NODE_DEFINITIONS)) {
      expect(def.label).toBeDefined();
      expect(def.label.length).toBeGreaterThan(0);
    }
  });

  it('all port types should be valid', () => {
    const validPortTypes: PortType[] = ['Scalar', 'Bool', 'Color', 'Position', 'Bundle', 'Selection', 'Trigger'];

    for (const def of Object.values(NODE_DEFINITIONS)) {
      for (const input of Object.values(def.inputs)) {
        expect(validPortTypes).toContain(input.type);
      }
      for (const output of Object.values(def.outputs)) {
        expect(validPortTypes).toContain(output.type);
      }
    }
  });
});
