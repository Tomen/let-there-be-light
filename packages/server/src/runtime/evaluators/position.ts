import type { GraphNode } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { position, asPosition, asScalar } from './types.js';

/**
 * OffsetPosition node - add offset to pan/tilt
 */
export const evaluateOffsetPosition: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const pos = asPosition(ctx.getInput(node.id, 'position'), { pan: 0, tilt: 0 });
  const deltaPan = asScalar(ctx.getInput(node.id, 'deltaPan'), 0);
  const deltaTilt = asScalar(ctx.getInput(node.id, 'deltaTilt'), 0);

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
  const pos = asPosition(ctx.getInput(node.id, 'position'), { pan: 0, tilt: 0 });
  const scale = asScalar(ctx.getInput(node.id, 'scale'), 1);

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
  const pan = (node.params.pan as number) ?? 0;
  const tilt = (node.params.tilt as number) ?? 0;

  return { position: position(pan, tilt) };
};
