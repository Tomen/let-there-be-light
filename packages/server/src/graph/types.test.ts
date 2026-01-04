import { describe, it, expect } from 'vitest';
import type { GraphNode, PortType } from '@let-there-be-light/shared';
import {
  getOutputType,
  getInputType,
  typesCompatible,
  getRequiredInputs,
  validateNodeParams,
} from './types.js';

// Helper to create test nodes
function createNode(
  id: string,
  type: string,
  params: Record<string, unknown> = {}
): GraphNode {
  return { id, type, params, position: { x: 0, y: 0 } };
}

describe('getOutputType', () => {
  it('should return Scalar for Time.t output', () => {
    const nodes = [createNode('time1', 'Time')];

    expect(getOutputType(nodes, 'time1', 't')).toBe('Scalar');
  });

  it('should return Scalar for Time.dt output', () => {
    const nodes = [createNode('time1', 'Time')];

    expect(getOutputType(nodes, 'time1', 'dt')).toBe('Scalar');
  });

  it('should return Scalar for Fader.value output', () => {
    const nodes = [createNode('fader1', 'Fader', { faderId: 'f1' })];

    expect(getOutputType(nodes, 'fader1', 'value')).toBe('Scalar');
  });

  it('should return Trigger for Button.pressed output', () => {
    const nodes = [createNode('btn1', 'Button', { buttonId: 'b1' })];

    expect(getOutputType(nodes, 'btn1', 'pressed')).toBe('Trigger');
  });

  it('should return Bool for Button.down output', () => {
    const nodes = [createNode('btn1', 'Button', { buttonId: 'b1' })];

    expect(getOutputType(nodes, 'btn1', 'down')).toBe('Bool');
  });

  it('should return Selection for SelectGroup.selection output', () => {
    const nodes = [createNode('sel1', 'SelectGroup', { groupId: 'g1' })];

    expect(getOutputType(nodes, 'sel1', 'selection')).toBe('Selection');
  });

  it('should return Color for MixColor.result output', () => {
    const nodes = [createNode('mix1', 'MixColor')];

    expect(getOutputType(nodes, 'mix1', 'result')).toBe('Color');
  });

  it('should return null for unknown node', () => {
    const nodes = [createNode('a', 'Time')];

    expect(getOutputType(nodes, 'nonexistent', 't')).toBeNull();
  });

  it('should return null for unknown port', () => {
    const nodes = [createNode('time1', 'Time')];

    expect(getOutputType(nodes, 'time1', 'nonexistent')).toBeNull();
  });
});

describe('getInputType', () => {
  it('should return Scalar for Add.a input', () => {
    const nodes = [createNode('add1', 'Add')];

    expect(getInputType(nodes, 'add1', 'a')).toBe('Scalar');
  });

  it('should return Scalar for Add.b input', () => {
    const nodes = [createNode('add1', 'Add')];

    expect(getInputType(nodes, 'add1', 'b')).toBe('Scalar');
  });

  it('should return Color for MixColor.a input', () => {
    const nodes = [createNode('mix1', 'MixColor')];

    expect(getInputType(nodes, 'mix1', 'a')).toBe('Color');
  });

  it('should return Selection for WriteAttributes.selection input', () => {
    const nodes = [createNode('write1', 'WriteAttributes')];

    expect(getInputType(nodes, 'write1', 'selection')).toBe('Selection');
  });

  it('should return Bundle for WriteAttributes.bundle input', () => {
    const nodes = [createNode('write1', 'WriteAttributes')];

    expect(getInputType(nodes, 'write1', 'bundle')).toBe('Bundle');
  });

  it('should return null for unknown node', () => {
    const nodes = [createNode('a', 'Add')];

    expect(getInputType(nodes, 'nonexistent', 'a')).toBeNull();
  });

  it('should return null for unknown port', () => {
    const nodes = [createNode('add1', 'Add')];

    expect(getInputType(nodes, 'add1', 'nonexistent')).toBeNull();
  });
});

describe('typesCompatible', () => {
  it('should accept same type', () => {
    expect(typesCompatible('Scalar', 'Scalar')).toBe(true);
    expect(typesCompatible('Bool', 'Bool')).toBe(true);
    expect(typesCompatible('Color', 'Color')).toBe(true);
    expect(typesCompatible('Position', 'Position')).toBe(true);
    expect(typesCompatible('Bundle', 'Bundle')).toBe(true);
    expect(typesCompatible('Selection', 'Selection')).toBe(true);
    expect(typesCompatible('Trigger', 'Trigger')).toBe(true);
  });

  it('should allow Trigger -> Bool', () => {
    expect(typesCompatible('Trigger', 'Bool')).toBe(true);
  });

  it('should allow Color -> Bundle', () => {
    expect(typesCompatible('Color', 'Bundle')).toBe(true);
  });

  it('should allow Position -> Bundle', () => {
    expect(typesCompatible('Position', 'Bundle')).toBe(true);
  });

  it('should allow Scalar -> Bundle', () => {
    expect(typesCompatible('Scalar', 'Bundle')).toBe(true);
  });

  it('should reject incompatible types', () => {
    expect(typesCompatible('Scalar', 'Color')).toBe(false);
    expect(typesCompatible('Bool', 'Scalar')).toBe(false);
    expect(typesCompatible('Color', 'Position')).toBe(false);
    expect(typesCompatible('Bundle', 'Scalar')).toBe(false);
    expect(typesCompatible('Selection', 'Bundle')).toBe(false);
  });

  it('should reject Bool -> Trigger', () => {
    expect(typesCompatible('Bool', 'Trigger')).toBe(false);
  });
});

describe('getRequiredInputs', () => {
  it('should return selection and bundle for WriteAttributes', () => {
    const required = getRequiredInputs('WriteAttributes');

    expect(required).toContain('selection');
    expect(required).toContain('bundle');
  });

  it('should return a and b for Add', () => {
    const required = getRequiredInputs('Add');

    expect(required).toContain('a');
    expect(required).toContain('b');
  });

  it('should return a and b for Multiply', () => {
    const required = getRequiredInputs('Multiply');

    expect(required).toContain('a');
    expect(required).toContain('b');
  });

  it('should return a, b, mix for MixColor', () => {
    const required = getRequiredInputs('MixColor');

    expect(required).toContain('a');
    expect(required).toContain('b');
    expect(required).toContain('mix');
  });

  it('should return color for ScaleColor', () => {
    const required = getRequiredInputs('ScaleColor');

    expect(required).toContain('color');
  });

  it('should return position for ScalePosition', () => {
    const required = getRequiredInputs('ScalePosition');

    expect(required).toContain('position');
  });

  it('should return bundle for ScaleBundle', () => {
    const required = getRequiredInputs('ScaleBundle');

    expect(required).toContain('bundle');
  });

  it('should return empty array for Time (no required inputs)', () => {
    const required = getRequiredInputs('Time');

    expect(required).toHaveLength(0);
  });

  it('should return empty array for unknown node type', () => {
    const required = getRequiredInputs('NonexistentNode');

    expect(required).toHaveLength(0);
  });
});

describe('validateNodeParams', () => {
  it('should validate Time node (no required params)', () => {
    const node = createNode('time1', 'Time');

    const result = validateNodeParams(node);

    expect(result.valid).toBe(true);
  });

  it('should require faderId for Fader node', () => {
    const node = createNode('fader1', 'Fader', {});

    const result = validateNodeParams(node);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('faderId');
  });

  it('should accept Fader with faderId', () => {
    const node = createNode('fader1', 'Fader', { faderId: 'main' });

    const result = validateNodeParams(node);

    expect(result.valid).toBe(true);
  });

  it('should require buttonId for Button node', () => {
    const node = createNode('btn1', 'Button', {});

    const result = validateNodeParams(node);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('buttonId');
  });

  it('should require groupId for SelectGroup node', () => {
    const node = createNode('sel1', 'SelectGroup', {});

    const result = validateNodeParams(node);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('groupId');
  });

  it('should require fixtureId for SelectFixture node', () => {
    const node = createNode('sel1', 'SelectFixture', {});

    const result = validateNodeParams(node);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('fixtureId');
  });

  it('should require presetId for PresetBundle node', () => {
    const node = createNode('preset1', 'PresetBundle', {});

    const result = validateNodeParams(node);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('presetId');
  });

  it('should validate param type is number', () => {
    const node = createNode('sine1', 'SineLFO', { frequency: 'not-a-number' });

    const result = validateNodeParams(node);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('frequency');
    expect(result.error).toContain('number');
  });

  it('should validate param type is string', () => {
    const node = createNode('fader1', 'Fader', { faderId: 123 });

    const result = validateNodeParams(node);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('faderId');
    expect(result.error).toContain('string');
  });

  it('should validate param range (min)', () => {
    // Clamp01 has no configurable params, use MapRange which has outMin/outMax
    // Actually looking at nodes.ts, most params don't have explicit ranges
    // Let's use ColorConstant which has r, g, b with min: 0, max: 1
    const node = createNode('color1', 'ColorConstant', { r: -0.5 });

    const result = validateNodeParams(node);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('>= 0');
  });

  it('should validate param range (max)', () => {
    const node = createNode('color1', 'ColorConstant', { r: 1.5 });

    const result = validateNodeParams(node);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('<= 1');
  });

  it('should accept valid ColorConstant params', () => {
    const node = createNode('color1', 'ColorConstant', {
      r: 1.0,
      g: 0.5,
      b: 0.0,
    });

    const result = validateNodeParams(node);

    expect(result.valid).toBe(true);
  });

  it('should return error for unknown node type', () => {
    const node = createNode('unknown1', 'NonexistentNode');

    const result = validateNodeParams(node);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown node type');
  });
});
