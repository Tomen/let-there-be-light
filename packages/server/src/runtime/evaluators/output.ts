import type { GraphNode } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { asSelection, asBundle } from './types.js';

/**
 * Output from WriteAttributes node
 * Contains the selection and bundle to write
 */
export interface WriteOutput {
  selection: Set<string>;
  bundle: ReturnType<typeof asBundle>;
  priority: number;
}

/**
 * WriteAttributes node - marks output for fixture writing
 *
 * This node doesn't actually produce output values,
 * instead it's used by the runtime to collect write commands.
 * The runtime checks for WriteAttributes nodes and collects their inputs.
 */
export const evaluateWriteAttributes: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  // WriteAttributes has no outputs (it's a sink)
  // The runtime will read the inputs directly
  return {};
};

/**
 * Get the write output from a WriteAttributes node
 * Called by the runtime after evaluation to collect writes
 */
export function getWriteOutput(
  node: GraphNode,
  ctx: EvaluatorContext
): WriteOutput {
  const selection = asSelection(ctx.getInput(node.id, 'selection'));
  const bundle = asBundle(ctx.getInput(node.id, 'bundle'), {});
  const priority = (node.params.priority as number) ?? 0;

  return { selection, bundle, priority };
}
