import type { GraphNode, GraphEdge, NodeId, PortType } from '@let-there-be-light/shared';
import { NODE_DEFINITIONS } from '@let-there-be-light/shared';

/**
 * Get the output type of a port on a node
 */
export function getOutputType(
  nodes: GraphNode[],
  nodeId: NodeId,
  port: string
): PortType | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const def = NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS];
  if (!def) return null;

  const portDef = def.outputs[port];
  return portDef?.type ?? null;
}

/**
 * Get the input type expected by a port on a node
 */
export function getInputType(
  nodes: GraphNode[],
  nodeId: NodeId,
  port: string
): PortType | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const def = NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS];
  if (!def) return null;

  const portDef = def.inputs[port];
  return portDef?.type ?? null;
}

/**
 * Check if two port types are compatible for connection
 *
 * Type compatibility rules:
 * - Same type: always compatible
 * - Trigger -> Bool: compatible (trigger can drive bool)
 * - Color -> Bundle: compatible (color is part of bundle)
 * - Position -> Bundle: compatible (position is part of bundle)
 * - Scalar -> Bundle: compatible (intensity/zoom are scalars)
 */
export function typesCompatible(
  fromType: PortType,
  toType: PortType
): boolean {
  // Same type is always compatible
  if (fromType === toType) {
    return true;
  }

  // Trigger can be used where Bool is expected
  if (fromType === 'Trigger' && toType === 'Bool') {
    return true;
  }

  // Color, Position, and Scalar can contribute to Bundle
  if (toType === 'Bundle') {
    return ['Color', 'Position', 'Scalar'].includes(fromType);
  }

  return false;
}

/**
 * Get all required inputs for a node type
 * (inputs that don't have defaults and need to be connected)
 */
export function getRequiredInputs(nodeType: string): string[] {
  const def = NODE_DEFINITIONS[nodeType as keyof typeof NODE_DEFINITIONS];
  if (!def) return [];

  // For now, consider all defined inputs as optional
  // The graph can work with default values or unconnected inputs
  // Required inputs will be those that must be connected for the node to make sense

  const required: string[] = [];

  // Output nodes require their inputs
  if (nodeType === 'WriteAttributes') {
    required.push('selection', 'bundle');
  }

  // Math nodes with two operands
  if (['Add', 'Multiply'].includes(nodeType)) {
    required.push('a', 'b');
  }

  // Mix operations need all inputs
  if (nodeType === 'MixColor') {
    required.push('a', 'b', 'mix');
  }

  // Scale operations need both inputs
  if (['ScaleColor', 'ScalePosition', 'ScaleBundle'].includes(nodeType)) {
    // Scale factor can default to 1, but the value to scale is required
    const scaledInput = nodeType === 'ScaleColor' ? 'color' :
                        nodeType === 'ScalePosition' ? 'position' : 'bundle';
    required.push(scaledInput);
  }

  return required;
}

/**
 * Validate that a node's parameters are valid
 */
export function validateNodeParams(
  node: GraphNode
): { valid: boolean; error?: string } {
  const def = NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS];
  if (!def) {
    return { valid: false, error: `Unknown node type: ${node.type}` };
  }

  // Check that required params are present
  for (const [paramName, paramDef] of Object.entries(def.params)) {
    const value = node.params[paramName];

    // If param has no default and no value, it's required
    if (paramDef.default === undefined && value === undefined) {
      // Only faderId, buttonId, groupId, fixtureId, presetId are truly required
      if (['faderId', 'buttonId', 'groupId', 'fixtureId', 'presetId'].includes(paramName)) {
        return { valid: false, error: `Missing required param: ${paramName}` };
      }
    }

    // Type check the value if present
    if (value !== undefined) {
      if (paramDef.type === 'number' && typeof value !== 'number') {
        return { valid: false, error: `Param ${paramName} must be a number` };
      }
      if (paramDef.type === 'string' && typeof value !== 'string') {
        return { valid: false, error: `Param ${paramName} must be a string` };
      }
      if (paramDef.type === 'boolean' && typeof value !== 'boolean') {
        return { valid: false, error: `Param ${paramName} must be a boolean` };
      }

      // Range check for numbers
      if (typeof value === 'number') {
        if (paramDef.min !== undefined && value < paramDef.min) {
          return { valid: false, error: `Param ${paramName} must be >= ${paramDef.min}` };
        }
        if (paramDef.max !== undefined && value > paramDef.max) {
          return { valid: false, error: `Param ${paramName} must be <= ${paramDef.max}` };
        }
      }
    }
  }

  return { valid: true };
}
