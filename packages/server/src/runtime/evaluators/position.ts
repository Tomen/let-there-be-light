import type { GraphNode } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { position, getPositionInput, getScalarInput } from './types.js';

/**
 * OffsetPosition node - add offset to pan/tilt
 */
export const evaluateOffsetPosition: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const pos = getPositionInput(node, ctx, 'position', { pan: 0, tilt: 0 });
  const deltaPan = getScalarInput(node, ctx, 'deltaPan', 0);
  const deltaTilt = getScalarInput(node, ctx, 'deltaTilt', 0);

  // Clamp to -1..1 range
  const result = {
    pan: Math.max(-1, Math.min(1, pos.pan + deltaPan)),
    tilt: Math.max(-1, Math.min(1, pos.tilt + deltaTilt)),
  };

  return { result: position(result.pan, result.tilt) };
};

/**
 * ScalePosition node - multiply position by a scalar
 */
export const evaluateScalePosition: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const pos = getPositionInput(node, ctx, 'position', { pan: 0, tilt: 0 });
  const scale = getScalarInput(node, ctx, 'scale', 1);

  const result = {
    pan: Math.max(-1, Math.min(1, pos.pan * scale)),
    tilt: Math.max(-1, Math.min(1, pos.tilt * scale)),
  };

  return { result: position(result.pan, result.tilt) };
};

/**
 * PositionConstant node - outputs a constant position value
 */
export const evaluatePositionConstant: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const pan = getScalarInput(node, ctx, 'pan', 0);
  const tilt = getScalarInput(node, ctx, 'tilt', 0);

  return { position: position(pan, tilt) };
};
