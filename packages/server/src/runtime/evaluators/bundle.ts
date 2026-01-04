import type { GraphNode, AttributeBundle } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { bundle, asBundle, asScalar } from './types.js';

/**
 * MergeBundle node - merge two bundles (override takes precedence)
 */
export const evaluateMergeBundle: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const base = asBundle(ctx.getInput(node.id, 'base'), {});
  const override = asBundle(ctx.getInput(node.id, 'override'), {});

  // Deep merge with override taking precedence
  const result: Partial<AttributeBundle> = { ...base };

  if (override.intensity !== undefined) {
    result.intensity = override.intensity;
  }
  if (override.color !== undefined) {
    result.color = { ...base.color, ...override.color };
  }
  if (override.pan !== undefined) {
    result.pan = override.pan;
  }
  if (override.tilt !== undefined) {
    result.tilt = override.tilt;
  }
  if (override.zoom !== undefined) {
    result.zoom = override.zoom;
  }

  return { result: bundle(result) };
};

/**
 * ScaleBundle node - scale all values in a bundle by a factor
 */
export const evaluateScaleBundle: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const input = asBundle(ctx.getInput(node.id, 'bundle'), {});
  const scale = asScalar(ctx.getInput(node.id, 'scale'), 1);

  const result: Partial<AttributeBundle> = {};

  if (input.intensity !== undefined) {
    result.intensity = Math.max(0, Math.min(1, input.intensity * scale));
  }
  if (input.color !== undefined) {
    result.color = {
      r: Math.max(0, Math.min(1, input.color.r * scale)),
      g: Math.max(0, Math.min(1, input.color.g * scale)),
      b: Math.max(0, Math.min(1, input.color.b * scale)),
    };
  }
  if (input.pan !== undefined) {
    result.pan = Math.max(-1, Math.min(1, input.pan * scale));
  }
  if (input.tilt !== undefined) {
    result.tilt = Math.max(-1, Math.min(1, input.tilt * scale));
  }
  if (input.zoom !== undefined) {
    result.zoom = Math.max(0, Math.min(1, input.zoom * scale));
  }

  return { result: bundle(result) };
};
