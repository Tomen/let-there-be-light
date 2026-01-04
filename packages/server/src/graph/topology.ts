import type { GraphNode, GraphEdge, NodeId } from '@let-there-be-light/shared';

/**
 * Build adjacency list from edges (for forward traversal)
 */
export function buildAdjacencyList(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<NodeId, NodeId[]> {
  const adj = new Map<NodeId, NodeId[]>();

  // Initialize with empty arrays for all nodes
  for (const node of nodes) {
    adj.set(node.id, []);
  }

  // Add edges (from -> to)
  for (const edge of edges) {
    const fromList = adj.get(edge.from.nodeId);
    if (fromList) {
      fromList.push(edge.to.nodeId);
    }
  }

  return adj;
}

/**
 * Build reverse adjacency list (for finding inputs to a node)
 */
export function buildReverseAdjacencyList(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<NodeId, NodeId[]> {
  const adj = new Map<NodeId, NodeId[]>();

  // Initialize with empty arrays for all nodes
  for (const node of nodes) {
    adj.set(node.id, []);
  }

  // Add edges (to -> from, reversed)
  for (const edge of edges) {
    const toList = adj.get(edge.to.nodeId);
    if (toList) {
      toList.push(edge.from.nodeId);
    }
  }

  return adj;
}

/**
 * Detect cycle using DFS with coloring
 * Returns the cycle path if found, null otherwise
 */
export function detectCycle(
  nodes: GraphNode[],
  adj: Map<NodeId, NodeId[]>
): NodeId[] | null {
  const WHITE = 0; // Not visited
  const GRAY = 1;  // In current DFS path
  const BLACK = 2; // Fully processed

  const color = new Map<NodeId, number>();
  const parent = new Map<NodeId, NodeId | null>();

  // Initialize all nodes as white
  for (const node of nodes) {
    color.set(node.id, WHITE);
    parent.set(node.id, null);
  }

  // DFS from each unvisited node
  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      const cycle = dfs(node.id, adj, color, parent);
      if (cycle) {
        return cycle;
      }
    }
  }

  return null;
}

function dfs(
  nodeId: NodeId,
  adj: Map<NodeId, NodeId[]>,
  color: Map<NodeId, number>,
  parent: Map<NodeId, NodeId | null>
): NodeId[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;

  color.set(nodeId, GRAY);

  for (const neighbor of adj.get(nodeId) || []) {
    if (color.get(neighbor) === GRAY) {
      // Found cycle - reconstruct path
      const cycle: NodeId[] = [neighbor];
      let current = nodeId;
      while (current !== neighbor) {
        cycle.unshift(current);
        current = parent.get(current)!;
      }
      cycle.unshift(neighbor);
      return cycle;
    }

    if (color.get(neighbor) === WHITE) {
      parent.set(neighbor, nodeId);
      const cycle = dfs(neighbor, adj, color, parent);
      if (cycle) {
        return cycle;
      }
    }
  }

  color.set(nodeId, BLACK);
  return null;
}

/**
 * Topological sort using Kahn's algorithm
 * Returns nodes in evaluation order (sources first)
 */
export function topologicalSort(
  nodes: GraphNode[],
  adj: Map<NodeId, NodeId[]>
): NodeId[] {
  // Calculate in-degrees
  const inDegree = new Map<NodeId, number>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
  }

  for (const [, neighbors] of adj) {
    for (const neighbor of neighbors) {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
    }
  }

  // Start with nodes that have no incoming edges
  const queue: NodeId[] = [];
  for (const node of nodes) {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  }

  const result: NodeId[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);

    for (const neighbor of adj.get(nodeId) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If result doesn't contain all nodes, there's a cycle
  // (though we should have detected it before calling this)
  return result;
}

/**
 * Get all edges entering a specific port on a node
 */
export function getEdgesToPort(
  edges: GraphEdge[],
  nodeId: NodeId,
  port: string
): GraphEdge[] {
  return edges.filter(
    (e) => e.to.nodeId === nodeId && e.to.port === port
  );
}

/**
 * Get all edges leaving a specific port on a node
 */
export function getEdgesFromPort(
  edges: GraphEdge[],
  nodeId: NodeId,
  port: string
): GraphEdge[] {
  return edges.filter(
    (e) => e.from.nodeId === nodeId && e.from.port === port
  );
}

/**
 * Check if an input port has a connection
 */
export function hasConnection(
  edges: GraphEdge[],
  nodeId: NodeId,
  inputPort: string
): boolean {
  return edges.some(
    (e) => e.to.nodeId === nodeId && e.to.port === inputPort
  );
}
