import type { GraphNode, AttributeBundle, PortType } from '@let-there-be-light/shared';
import type { InputState } from '../input-state.js';

/**
 * Runtime values that can flow through the graph
 */
export type RuntimeValue =
  | { type: 'Scalar'; value: number }
  | { type: 'Bool'; value: boolean }
  | { type: 'Trigger'; value: boolean } // true = triggered this frame
  | { type: 'Color'; value: { r: number; g: number; b: number } }
  | { type: 'Position'; value: { pan: number; tilt: number } }
  | { type: 'Bundle'; value: Partial<AttributeBundle> }
  | { type: 'Selection'; value: Set<string> }; // Set of fixture IDs

/**
 * Context available to evaluators during execution
 */
export interface EvaluatorContext {
  /** Current time in seconds since engine start */
  time: number;
  /** Delta time since last frame in seconds */
  deltaTime: number;
  /** Input state (faders, buttons) */
  inputs: InputState;
  /** Get output value from another node (already evaluated) */
  getInput: (nodeId: string, port: string) => RuntimeValue | null;
  /** Node-specific persistent state (for LFOs, smoothing, etc.) */
  getNodeState: <T>(nodeId: string) => T | undefined;
  /** Update node-specific persistent state */
  setNodeState: <T>(nodeId: string, state: T) => void;
}

/**
 * Node evaluator function signature
 */
export type NodeEvaluator = (
  node: GraphNode,
  ctx: EvaluatorContext
) => Record<string, RuntimeValue>;

/**
 * Helper to create a scalar value
 */
export function scalar(value: number): RuntimeValue {
  return { type: 'Scalar', value };
}

/**
 * Helper to create a bool value
 */
export function bool(value: boolean): RuntimeValue {
  return { type: 'Bool', value };
}

/**
 * Helper to create a trigger value
 */
export function trigger(value: boolean): RuntimeValue {
  return { type: 'Trigger', value };
}

/**
 * Helper to create a color value
 */
export function color(r: number, g: number, b: number): RuntimeValue {
  return { type: 'Color', value: { r, g, b } };
}

/**
 * Helper to create a position value
 */
export function position(pan: number, tilt: number): RuntimeValue {
  return { type: 'Position', value: { pan, tilt } };
}

/**
 * Helper to create a bundle value
 */
export function bundle(attrs: Partial<AttributeBundle>): RuntimeValue {
  return { type: 'Bundle', value: attrs };
}

/**
 * Helper to create a selection value
 */
export function selection(fixtureIds: string[] | Set<string>): RuntimeValue {
  return { type: 'Selection', value: new Set(fixtureIds) };
}

/**
 * Extract scalar value from RuntimeValue (with default)
 */
export function asScalar(rv: RuntimeValue | null, defaultValue = 0): number {
  if (!rv) return defaultValue;
  if (rv.type === 'Scalar') return rv.value;
  if (rv.type === 'Bool' || rv.type === 'Trigger') return rv.value ? 1 : 0;
  return defaultValue;
}

/**
 * Extract bool value from RuntimeValue (with default)
 */
export function asBool(rv: RuntimeValue | null, defaultValue = false): boolean {
  if (!rv) return defaultValue;
  if (rv.type === 'Bool' || rv.type === 'Trigger') return rv.value;
  if (rv.type === 'Scalar') return rv.value > 0.5;
  return defaultValue;
}

/**
 * Extract trigger value from RuntimeValue
 */
export function asTrigger(rv: RuntimeValue | null): boolean {
  if (!rv) return false;
  if (rv.type === 'Trigger') return rv.value;
  return false;
}

/**
 * Extract color value from RuntimeValue (with default)
 */
export function asColor(
  rv: RuntimeValue | null,
  defaultValue = { r: 0, g: 0, b: 0 }
): { r: number; g: number; b: number } {
  if (!rv) return defaultValue;
  if (rv.type === 'Color') return rv.value;
  return defaultValue;
}

/**
 * Extract position value from RuntimeValue (with default)
 */
export function asPosition(
  rv: RuntimeValue | null,
  defaultValue = { pan: 0, tilt: 0 }
): { pan: number; tilt: number } {
  if (!rv) return defaultValue;
  if (rv.type === 'Position') return rv.value;
  return defaultValue;
}

/**
 * Extract bundle value from RuntimeValue (with default)
 */
export function asBundle(
  rv: RuntimeValue | null,
  defaultValue: Partial<AttributeBundle> = {}
): Partial<AttributeBundle> {
  if (!rv) return defaultValue;
  if (rv.type === 'Bundle') return rv.value;
  // Color can be converted to bundle
  if (rv.type === 'Color') {
    return { color: rv.value };
  }
  // Position can be converted to bundle
  if (rv.type === 'Position') {
    return { pan: rv.value.pan, tilt: rv.value.tilt };
  }
  // Scalar can be intensity
  if (rv.type === 'Scalar') {
    return { intensity: rv.value };
  }
  return defaultValue;
}

/**
 * Extract selection value from RuntimeValue (with default)
 */
export function asSelection(rv: RuntimeValue | null): Set<string> {
  if (!rv) return new Set();
  if (rv.type === 'Selection') return rv.value;
  return new Set();
}
