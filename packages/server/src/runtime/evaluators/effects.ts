import type { GraphNode } from '@let-there-be-light/shared';
import type { EvaluatorContext, RuntimeValue, NodeEvaluator } from './types.js';
import { scalar, asScalar, asTrigger, asSelection } from './types.js';

/**
 * SineLFO node - sine wave oscillator
 */
interface LFOState {
  phase: number;
}

export const evaluateSineLFO: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const frequency = (node.params.frequency as number) ?? 1;
  const phaseOffset = (node.params.phase as number) ?? 0;
  const speedInput = asScalar(ctx.getInput(node.id, 'speed'), 1);

  // Get/initialize state
  const state = ctx.getNodeState<LFOState>(node.id) ?? { phase: phaseOffset };

  // Update phase based on frequency and speed
  const newPhase = state.phase + frequency * speedInput * ctx.deltaTime;
  ctx.setNodeState<LFOState>(node.id, { phase: newPhase % 1000 }); // Wrap to prevent overflow

  // Calculate sine wave (0-1 range)
  const value = (Math.sin(newPhase * Math.PI * 2) + 1) / 2;

  return { value: scalar(value) };
};

/**
 * TriangleLFO node - triangle wave oscillator
 */
export const evaluateTriangleLFO: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const frequency = (node.params.frequency as number) ?? 1;
  const phaseOffset = (node.params.phase as number) ?? 0;
  const speedInput = asScalar(ctx.getInput(node.id, 'speed'), 1);

  const state = ctx.getNodeState<LFOState>(node.id) ?? { phase: phaseOffset };

  const newPhase = state.phase + frequency * speedInput * ctx.deltaTime;
  ctx.setNodeState<LFOState>(node.id, { phase: newPhase % 1000 });

  // Triangle wave (0-1 range)
  const t = (newPhase % 1 + 1) % 1; // Ensure positive
  const value = t < 0.5 ? t * 2 : 2 - t * 2;

  return { value: scalar(value) };
};

/**
 * SawLFO node - sawtooth wave oscillator
 */
export const evaluateSawLFO: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const frequency = (node.params.frequency as number) ?? 1;
  const phaseOffset = (node.params.phase as number) ?? 0;
  const speedInput = asScalar(ctx.getInput(node.id, 'speed'), 1);

  const state = ctx.getNodeState<LFOState>(node.id) ?? { phase: phaseOffset };

  const newPhase = state.phase + frequency * speedInput * ctx.deltaTime;
  ctx.setNodeState<LFOState>(node.id, { phase: newPhase % 1000 });

  // Sawtooth wave (0-1 range)
  const value = (newPhase % 1 + 1) % 1;

  return { value: scalar(value) };
};

/**
 * Chase node - chases through fixtures in a selection
 */
interface ChaseState {
  phase: number;
}

export const evaluateChase: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const width = (node.params.width as number) ?? 1;
  const speedInput = asScalar(ctx.getInput(node.id, 'speed'), 1);
  const selectionInput = asSelection(ctx.getInput(node.id, 'selection'));

  const state = ctx.getNodeState<ChaseState>(node.id) ?? { phase: 0 };

  const newPhase = state.phase + speedInput * ctx.deltaTime;
  ctx.setNodeState<ChaseState>(node.id, { phase: newPhase % 1000 });

  // Chase position cycles through fixtures
  const fixtureCount = selectionInput.size;
  if (fixtureCount === 0) {
    return { value: scalar(0) };
  }

  // The chase value represents brightness at current position
  // For per-fixture values, this would need to return a map
  // For now, return a simple oscillating value
  const position = (newPhase % fixtureCount + fixtureCount) % fixtureCount;
  const value = Math.max(0, 1 - Math.abs(position - Math.floor(position + 0.5)) / width);

  return { value: scalar(value) };
};

/**
 * Flash node - attack-decay envelope triggered by button
 */
interface FlashState {
  phase: number;
  triggered: boolean;
}

export const evaluateFlash: NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
): Record<string, RuntimeValue> => {
  const attack = (node.params.attack as number) ?? 0;
  const decay = (node.params.decay as number) ?? 0.5;
  const triggerInput = asTrigger(ctx.getInput(node.id, 'trigger'));

  const state = ctx.getNodeState<FlashState>(node.id) ?? { phase: -1, triggered: false };

  let phase = state.phase;
  let triggered = state.triggered;

  // On trigger, start envelope
  if (triggerInput && !triggered) {
    phase = 0;
    triggered = true;
  } else if (!triggerInput) {
    triggered = false;
  }

  // Advance envelope
  if (phase >= 0) {
    phase += ctx.deltaTime;
  }

  ctx.setNodeState<FlashState>(node.id, { phase, triggered });

  // Calculate envelope value
  let value = 0;
  if (phase >= 0) {
    if (phase < attack) {
      // Attack phase
      value = attack > 0 ? phase / attack : 1;
    } else if (phase < attack + decay) {
      // Decay phase
      value = 1 - (phase - attack) / decay;
    } else {
      // Envelope complete
      ctx.setNodeState<FlashState>(node.id, { phase: -1, triggered: false });
    }
  }

  return { value: scalar(Math.max(0, Math.min(1, value))) };
};
