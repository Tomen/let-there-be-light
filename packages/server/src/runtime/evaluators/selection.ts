import type { GraphNode } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { selection } from './types.js';
import { getStores } from '../../datastore/index.js';

/**
 * SelectGroup node - outputs fixture selection from multiple groups
 */
export const evaluateSelectGroup: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  // Support both new array format and old string format for backward compatibility
  const groupIds = Array.isArray(node.params.groupIds)
    ? (node.params.groupIds as string[])
    : node.params.groupId
      ? [node.params.groupId as string]
      : [];

  const { groups } = getStores();

  // Merge all fixture IDs from all selected groups
  const allFixtureIds = new Set<string>();
  for (const groupId of groupIds) {
    const group = groups.getById(groupId);
    if (group) {
      group.fixtureIds.forEach((id) => allFixtureIds.add(id));
    }
  }

  return { selection: selection(allFixtureIds) };
};

/**
 * SelectFixture node - outputs fixture selection from multiple fixtures
 */
export const evaluateSelectFixture: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  // Support both new array format and old string format for backward compatibility
  const fixtureIds = Array.isArray(node.params.fixtureIds)
    ? (node.params.fixtureIds as string[])
    : node.params.fixtureId
      ? [node.params.fixtureId as string]
      : [];

  return { selection: selection(fixtureIds) };
};
