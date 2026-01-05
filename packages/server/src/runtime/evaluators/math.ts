import type { GraphNode } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { scalar, getScalarInput } from './types.js';

/**
 * Add node - adds two scalar values
 */
export const evaluateAdd: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const a = getScalarInput(node, ctx, 'a', 0);
  const b = getScalarInput(node, ctx, 'b', 0);
  return { result: scalar(a + b) };
};

/**
 * Multiply node - multiplies two scalar values
 */
export const evaluateMultiply: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const a = getScalarInput(node, ctx, 'a', 1);
  const b = getScalarInput(node, ctx, 'b', 1);
  return { result: scalar(a * b) };
};

/**
 * Clamp01 node - clamps value to 0-1 range
 */
export const evaluateClamp01: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const value = getScalarInput(node, ctx, 'value', 0);
  return { result: scalar(Math.max(0, Math.min(1, value))) };
};

/**
 * MapRange node - maps value from one range to another
 */
export const evaluateMapRange: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const value = getScalarInput(node, ctx, 'value', 0);
  const inMin = getScalarInput(node, ctx, 'inMin', 0);
  const inMax = getScalarInput(node, ctx, 'inMax', 1);
  const outMin = getScalarInput(node, ctx, 'outMin', 0);
  const outMax = getScalarInput(node, ctx, 'outMax', 1);

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
  const value = getScalarInput(node, ctx, 'value', 0);
  const smoothing = getScalarInput(node, ctx, 'smoothing', 0.9);

  // Get previous state
  const state = ctx.getNodeState<SmoothState>(node.id) ?? { previousValue: value };

  // Exponential moving average
  // Higher smoothing = slower response
  const smoothed = state.previousValue + (1 - smoothing) * (value - state.previousValue);

  // Store for next frame
  ctx.setNodeState<SmoothState>(node.id, { previousValue: smoothed });

  return { result: scalar(smoothed) };
};
