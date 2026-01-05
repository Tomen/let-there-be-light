import type { GraphNode } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { color, bundle, getScalarInput, getColorInput } from './types.js';

/**
 * MixColor node - linear interpolation between two colors
 */
export const evaluateMixColor: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const a = getColorInput(node, ctx, 'a', { r: 0, g: 0, b: 0 });
  const b = getColorInput(node, ctx, 'b', { r: 1, g: 1, b: 1 });
  const mix = getScalarInput(node, ctx, 'mix', 0.5);

  // Linear interpolation
  const result = {
    r: a.r + (b.r - a.r) * mix,
    g: a.g + (b.g - a.g) * mix,
    b: a.b + (b.b - a.b) * mix,
  };

  return { result: color(result.r, result.g, result.b) };
};

/**
 * ScaleColor node - multiply color by a scalar
 */
export const evaluateScaleColor: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const colorInput = getColorInput(node, ctx, 'color', { r: 1, g: 1, b: 1 });
  const scale = getScalarInput(node, ctx, 'scale', 1);

  const result = {
    r: Math.max(0, Math.min(1, colorInput.r * scale)),
    g: Math.max(0, Math.min(1, colorInput.g * scale)),
    b: Math.max(0, Math.min(1, colorInput.b * scale)),
  };

  return { result: color(result.r, result.g, result.b) };
};

/**
 * ColorConstant node - outputs a constant color value
 */
export const evaluateColorConstant: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const r = getScalarInput(node, ctx, 'r', 1);
  const g = getScalarInput(node, ctx, 'g', 1);
  const b = getScalarInput(node, ctx, 'b', 1);

  return { color: color(r, g, b) };
};

/**
 * ColorToBundle node - converts a Color to a Bundle with color attribute
 */
export const evaluateColorToBundle: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const colorInput = getColorInput(node, ctx, 'color', { r: 1, g: 1, b: 1 });

  return { bundle: bundle({ color: colorInput }) };
};
