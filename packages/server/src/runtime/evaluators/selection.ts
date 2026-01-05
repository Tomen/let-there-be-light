import type { GraphNode } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { selection } from './types.js';
import { getStores } from '../../datastore/index.js';

/**
 * SelectGroup node - outputs fixture selection from a group
 */
export const evaluateSelectGroup: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const groupId = node.params.groupId as string;
  const { groups } = getStores();
  const group = groups.getById(groupId);

  if (!group) {
    return { selection: selection([]) };
  }

  return { selection: selection(group.fixtureIds) };
};

/**
 * SelectFixture node - outputs single fixture selection
 */
export const evaluateSelectFixture: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const fixtureId = node.params.fixtureId as string;
  return { selection: selection([fixtureId]) };
};
