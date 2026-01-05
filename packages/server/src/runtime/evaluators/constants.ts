import type { GraphNode } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { getScalarInput, getBoolInput, scalar, bool } from './types.js';

/**
 * Scalar constant node - outputs a configurable scalar value
 */
export const evaluateScalar: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const value = getScalarInput(node, ctx, 'value', 0);
  return { value: scalar(value) };
};

/**
 * Bool constant node - outputs a configurable boolean value
 */
export const evaluateBool: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const value = getBoolInput(node, ctx, 'value', false);
  return { value: bool(value) };
};
