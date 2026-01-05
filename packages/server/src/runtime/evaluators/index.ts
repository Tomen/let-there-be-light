import type { NodeType } from '@let-there-be-light/shared';
import type { NodeEvaluator } from './types.js';

// Re-export types
export * from './types.js';

// Import evaluators
import { evaluateTime, evaluateFader, evaluateButton } from './inputs.js';
import { evaluateScalar, evaluateBool } from './constants.js';
import { evaluateSelectGroup, evaluateSelectFixture } from './selection.js';
import { evaluateAdd, evaluateMultiply, evaluateClamp01, evaluateMapRange, evaluateSmooth } from './math.js';
import { evaluateSineLFO, evaluateTriangleLFO, evaluateSawLFO, evaluateChase, evaluateFlash } from './effects.js';
import { evaluateMixColor, evaluateScaleColor, evaluateColorConstant, evaluateColorToBundle } from './color.js';
import { evaluateOffsetPosition, evaluateScalePosition, evaluatePositionConstant } from './position.js';
import { evaluateMergeBundle, evaluateScaleBundle } from './bundle.js';
import { evaluateWriteAttributes, getWriteOutput } from './output.js';

export { getWriteOutput } from './output.js';

/**
 * Map of node types to their evaluator functions
 */
export const NODE_EVALUATORS: Record<NodeType, NodeEvaluator> = {
  // Inputs
  Time: evaluateTime,
  Fader: evaluateFader,
  Button: evaluateButton,

  // Constants
  Scalar: evaluateScalar,
  Bool: evaluateBool,
  ColorConstant: evaluateColorConstant,
  PositionConstant: evaluatePositionConstant,

  // Selection
  SelectGroup: evaluateSelectGroup,
  SelectFixture: evaluateSelectFixture,

  // Math/Shaping
  Add: evaluateAdd,
  Multiply: evaluateMultiply,
  Clamp01: evaluateClamp01,
  MapRange: evaluateMapRange,
  Smooth: evaluateSmooth,

  // Effects
  SineLFO: evaluateSineLFO,
  TriangleLFO: evaluateTriangleLFO,
  SawLFO: evaluateSawLFO,
  Chase: evaluateChase,
  Flash: evaluateFlash,

  // Color
  MixColor: evaluateMixColor,
  ScaleColor: evaluateScaleColor,
  ColorToBundle: evaluateColorToBundle,

  // Position
  OffsetPosition: evaluateOffsetPosition,
  ScalePosition: evaluateScalePosition,

  // Bundle
  MergeBundle: evaluateMergeBundle,
  ScaleBundle: evaluateScaleBundle,

  // Output
  WriteAttributes: evaluateWriteAttributes,
};
