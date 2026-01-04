import type { GraphNode } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { scalar, trigger, bool } from './types.js';

/**
 * Time node - outputs current time and delta time
 */
export const evaluateTime: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  return {
    t: scalar(ctx.time),
    dt: scalar(ctx.deltaTime),
  };
};

/**
 * Fader node - outputs fader value from input state
 */
export const evaluateFader: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const faderId = node.params.faderId as string;
  const value = ctx.inputs.getFader(faderId);
  return {
    value: scalar(value),
  };
};

/**
 * Button node - outputs trigger and held state
 */
export const evaluateButton: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const buttonId = node.params.buttonId as string;
  const pressed = ctx.inputs.wasButtonPressed(buttonId);
  const down = ctx.inputs.isButtonDown(buttonId);
  return {
    pressed: trigger(pressed),
    down: bool(down),
  };
};
