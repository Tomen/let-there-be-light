import type { GraphNode } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { scalar, asScalar } from './types.js';

/**
 * Add node - adds two scalar values
 */
export const evaluateAdd: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const a = asScalar(ctx.getInput(node.id, 'a'), 0);
  const b = asScalar(ctx.getInput(node.id, 'b'), 0);
  return { result: scalar(a + b) };
};

/**
 * Multiply node - multiplies two scalar values
 */
export const evaluateMultiply: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const a = asScalar(ctx.getInput(node.id, 'a'), 0);
  const b = asScalar(ctx.getInput(node.id, 'b'), 1);
  return { result: scalar(a * b) };
};

/**
 * Clamp01 node - clamps value to 0-1 range
 */
export const evaluateClamp01: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const value = asScalar(ctx.getInput(node.id, 'value'), 0);
  return { result: scalar(Math.max(0, Math.min(1, value))) };
};

/**
 * MapRange node - maps value from one range to another
 */
export const evaluateMapRange: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const value = asScalar(ctx.getInput(node.id, 'value'), 0);
  const inMin = (node.params.inMin as number) ?? 0;
  const inMax = (node.params.inMax as number) ?? 1;
  const outMin = (node.params.outMin as number) ?? 0;
  const outMax = (node.params.outMax as number) ?? 1;

  // Normalize to 0-1
  const normalized = inMax !== inMin ? (value - inMin) / (inMax - inMin) : 0;
  // Map to output range
  const mapped = outMin + normalized * (outMax - outMin);

  return { result: scalar(mapped) };
};

/**
 * Smooth node - exponential smoothing (low-pass filter)
 */
interface SmoothState {
  previousValue: number;
}

export const evaluateSmooth: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const value = asScalar(ctx.getInput(node.id, 'value'), 0);
  const smoothing = (node.params.smoothing as number) ?? 0.9;

  // Get previous state
  const state = ctx.getNodeState<SmoothState>(node.id) ?? { previousValue: value };

  // Exponential moving average
  // Higher smoothing = slower response
  const smoothed = state.previousValue + (1 - smoothing) * (value - state.previousValue);

  // Store for next frame
  ctx.setNodeState<SmoothState>(node.id, { previousValue: smoothed });

  return { result: scalar(smoothed) };
};
