import type {
  Graph,
  GraphNode,
  GraphEdge,
  NodeId,
  CompileResult,
  CompileError,
  GraphDependencies,
} from '@let-there-be-light/shared';
import { NODE_DEFINITIONS } from '@let-there-be-light/shared';

import {
  buildAdjacencyList,
  detectCycle,
  topologicalSort,
  hasConnection,
} from './topology.js';

import {
  getOutputType,
  getInputType,
  typesCompatible,
  getRequiredInputs,
  validateNodeParams,
} from './types.js';

/**
 * Compiled graph ready for evaluation
 */
export interface CompiledGraph {
  graphId: string;
  evaluationOrder: NodeId[];
  dependencies: GraphDependencies;
}

/**
 * Compile a graph for execution
 *
 * Validation steps:
 * 1. Check all node types are valid
 * 2. Detect cycles (must be DAG)
 * 3. Topological sort for evaluation order
 * 4. Type-check all connections
 * 5. Validate required inputs are connected
 * 6. Validate node parameters
 * 7. Extract external dependencies
 */
export function compileGraph(graph: Graph): CompileResult {
  const errors: CompileError[] = [];

  // 1. Validate all node types
  for (const node of graph.nodes) {
    if (!(node.type in NODE_DEFINITIONS)) {
      errors.push({
        nodeId: node.id,
        message: `Unknown node type: ${node.type}`,
        code: 'UNKNOWN_NODE_TYPE',
      });
    }
  }

  // If we have unknown node types, stop here
  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      dependencies: emptyDependencies(),
    };
  }

  // 2. Build adjacency list and detect cycles
  const adj = buildAdjacencyList(graph.nodes, graph.edges);
  const cycle = detectCycle(graph.nodes, adj);

  if (cycle) {
    errors.push({
      nodeId: cycle[0],
      message: `Cycle detected: ${cycle.join(' -> ')}`,
      code: 'CYCLE_DETECTED',
    });
    return {
      ok: false,
      errors,
      dependencies: emptyDependencies(),
    };
  }

  // 3. Topological sort
  const evaluationOrder = topologicalSort(graph.nodes, adj);

  // 4. Type-check all connections
  for (const edge of graph.edges) {
    const fromType = getOutputType(graph.nodes, edge.from.nodeId, edge.from.port);
    const toType = getInputType(graph.nodes, edge.to.nodeId, edge.to.port);

    if (!fromType) {
      errors.push({
        nodeId: edge.from.nodeId,
        port: edge.from.port,
        message: `Unknown output port: ${edge.from.port}`,
        code: 'INVALID_PARAM',
      });
      continue;
    }

    if (!toType) {
      errors.push({
        nodeId: edge.to.nodeId,
        port: edge.to.port,
        message: `Unknown input port: ${edge.to.port}`,
        code: 'INVALID_PARAM',
      });
      continue;
    }

    if (!typesCompatible(fromType, toType)) {
      errors.push({
        nodeId: edge.to.nodeId,
        port: edge.to.port,
        message: `Type mismatch: ${fromType} cannot connect to ${toType}`,
        code: 'TYPE_MISMATCH',
      });
    }
  }

  // 5. Validate required inputs are connected
  for (const node of graph.nodes) {
    const requiredInputs = getRequiredInputs(node.type);

    for (const inputPort of requiredInputs) {
      if (!hasConnection(graph.edges, node.id, inputPort)) {
        errors.push({
          nodeId: node.id,
          port: inputPort,
          message: `Required input not connected: ${inputPort}`,
          code: 'MISSING_CONNECTION',
        });
      }
    }
  }

  // 6. Validate node parameters
  for (const node of graph.nodes) {
    const validation = validateNodeParams(node);
    if (!validation.valid) {
      errors.push({
        nodeId: node.id,
        message: validation.error!,
        code: 'INVALID_PARAM',
      });
    }
  }

  // 7. Extract dependencies
  const dependencies = extractDependencies(graph);

  return {
    ok: errors.length === 0,
    errors,
    dependencies,
  };
}

/**
 * Extract external dependencies from a graph
 */
export function extractDependencies(graph: Graph): GraphDependencies {
  const faderIds: string[] = [];
  const buttonIds: string[] = [];
  const groupIds: string[] = [];
  const fixtureIds: string[] = [];

  for (const node of graph.nodes) {
    switch (node.type) {
      case 'Fader':
        if (node.params.faderId) {
          faderIds.push(node.params.faderId as string);
        }
        break;

      case 'Button':
        if (node.params.buttonId) {
          buttonIds.push(node.params.buttonId as string);
        }
        break;

      case 'SelectGroup':
        if (node.params.groupId) {
          groupIds.push(node.params.groupId as string);
        }
        break;

      case 'SelectFixture':
        if (node.params.fixtureId) {
          fixtureIds.push(node.params.fixtureId as string);
        }
        break;
    }
  }

  return {
    faderIds: [...new Set(faderIds)],
    buttonIds: [...new Set(buttonIds)],
    groupIds: [...new Set(groupIds)],
    fixtureIds: [...new Set(fixtureIds)],
  };
}

/**
 * Create empty dependencies object
 */
function emptyDependencies(): GraphDependencies {
  return {
    faderIds: [],
    buttonIds: [],
    groupIds: [],
    fixtureIds: [],
  };
}

/**
 * Get a compiled graph ready for evaluation
 * Returns null if compilation fails
 */
export function getCompiledGraph(graph: Graph): CompiledGraph | null {
  const result = compileGraph(graph);

  if (!result.ok) {
    return null;
  }

  const adj = buildAdjacencyList(graph.nodes, graph.edges);
  const evaluationOrder = topologicalSort(graph.nodes, adj);

  return {
    graphId: graph.id,
    evaluationOrder,
    dependencies: result.dependencies,
  };
}
