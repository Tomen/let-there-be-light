import { describe, it, expect } from 'vitest';
import type { GraphNode, GraphEdge } from '@let-there-be-light/shared';
import {
  buildAdjacencyList,
  buildReverseAdjacencyList,
  detectCycle,
  topologicalSort,
  getEdgesToPort,
  getEdgesFromPort,
  hasConnection,
} from './topology.js';

// Helper to create test nodes
function createNode(id: string, type = 'Time'): GraphNode {
  return { id, type, params: {}, position: { x: 0, y: 0 } };
}

// Helper to create test edges
function createEdge(
  fromNodeId: string,
  fromPort: string,
  toNodeId: string,
  toPort: string
): GraphEdge {
  return {
    id: `${fromNodeId}-${toNodeId}`,
    from: { nodeId: fromNodeId, port: fromPort },
    to: { nodeId: toNodeId, port: toPort },
  };
}

describe('buildAdjacencyList', () => {
  it('should create empty adjacency list for nodes with no edges', () => {
    const nodes = [createNode('a'), createNode('b'), createNode('c')];
    const edges: GraphEdge[] = [];

    const adj = buildAdjacencyList(nodes, edges);

    expect(adj.get('a')).toEqual([]);
    expect(adj.get('b')).toEqual([]);
    expect(adj.get('c')).toEqual([]);
  });

  it('should build adjacency list from edges', () => {
    const nodes = [createNode('a'), createNode('b'), createNode('c')];
    const edges = [
      createEdge('a', 'out', 'b', 'in'),
      createEdge('a', 'out', 'c', 'in'),
      createEdge('b', 'out', 'c', 'in'),
    ];

    const adj = buildAdjacencyList(nodes, edges);

    expect(adj.get('a')).toEqual(['b', 'c']);
    expect(adj.get('b')).toEqual(['c']);
    expect(adj.get('c')).toEqual([]);
  });

  it('should handle multiple edges to same node', () => {
    const nodes = [createNode('a'), createNode('b')];
    const edges = [
      createEdge('a', 'out1', 'b', 'in1'),
      createEdge('a', 'out2', 'b', 'in2'),
    ];

    const adj = buildAdjacencyList(nodes, edges);

    expect(adj.get('a')).toEqual(['b', 'b']);
  });
});

describe('buildReverseAdjacencyList', () => {
  it('should build reverse adjacency (inputs to each node)', () => {
    const nodes = [createNode('a'), createNode('b'), createNode('c')];
    const edges = [
      createEdge('a', 'out', 'c', 'in1'),
      createEdge('b', 'out', 'c', 'in2'),
    ];

    const adj = buildReverseAdjacencyList(nodes, edges);

    expect(adj.get('a')).toEqual([]);
    expect(adj.get('b')).toEqual([]);
    expect(adj.get('c')).toEqual(['a', 'b']);
  });
});

describe('detectCycle', () => {
  it('should return null for DAG', () => {
    const nodes = [createNode('a'), createNode('b'), createNode('c')];
    const edges = [
      createEdge('a', 'out', 'b', 'in'),
      createEdge('b', 'out', 'c', 'in'),
    ];
    const adj = buildAdjacencyList(nodes, edges);

    const cycle = detectCycle(nodes, adj);

    expect(cycle).toBeNull();
  });

  it('should detect simple cycle', () => {
    const nodes = [createNode('a'), createNode('b')];
    const edges = [
      createEdge('a', 'out', 'b', 'in'),
      createEdge('b', 'out', 'a', 'in'),
    ];
    const adj = buildAdjacencyList(nodes, edges);

    const cycle = detectCycle(nodes, adj);

    expect(cycle).not.toBeNull();
    expect(cycle).toContain('a');
    expect(cycle).toContain('b');
  });

  it('should detect self-loop', () => {
    const nodes = [createNode('a')];
    const edges = [createEdge('a', 'out', 'a', 'in')];
    const adj = buildAdjacencyList(nodes, edges);

    const cycle = detectCycle(nodes, adj);

    expect(cycle).not.toBeNull();
    expect(cycle).toContain('a');
  });

  it('should detect cycle in larger graph', () => {
    const nodes = [
      createNode('a'),
      createNode('b'),
      createNode('c'),
      createNode('d'),
    ];
    const edges = [
      createEdge('a', 'out', 'b', 'in'),
      createEdge('b', 'out', 'c', 'in'),
      createEdge('c', 'out', 'd', 'in'),
      createEdge('d', 'out', 'b', 'in'), // cycle: b -> c -> d -> b
    ];
    const adj = buildAdjacencyList(nodes, edges);

    const cycle = detectCycle(nodes, adj);

    expect(cycle).not.toBeNull();
  });

  it('should return null for disconnected DAG components', () => {
    const nodes = [
      createNode('a'),
      createNode('b'),
      createNode('c'),
      createNode('d'),
    ];
    const edges = [
      createEdge('a', 'out', 'b', 'in'),
      createEdge('c', 'out', 'd', 'in'),
    ];
    const adj = buildAdjacencyList(nodes, edges);

    const cycle = detectCycle(nodes, adj);

    expect(cycle).toBeNull();
  });
});

describe('topologicalSort', () => {
  it('should sort simple chain', () => {
    const nodes = [createNode('a'), createNode('b'), createNode('c')];
    const edges = [
      createEdge('a', 'out', 'b', 'in'),
      createEdge('b', 'out', 'c', 'in'),
    ];
    const adj = buildAdjacencyList(nodes, edges);

    const sorted = topologicalSort(nodes, adj);

    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'));
  });

  it('should handle nodes with no edges', () => {
    const nodes = [createNode('a'), createNode('b'), createNode('c')];
    const edges: GraphEdge[] = [];
    const adj = buildAdjacencyList(nodes, edges);

    const sorted = topologicalSort(nodes, adj);

    expect(sorted).toHaveLength(3);
    expect(sorted).toContain('a');
    expect(sorted).toContain('b');
    expect(sorted).toContain('c');
  });

  it('should handle diamond dependency', () => {
    //     a
    //    / \
    //   b   c
    //    \ /
    //     d
    const nodes = [
      createNode('a'),
      createNode('b'),
      createNode('c'),
      createNode('d'),
    ];
    const edges = [
      createEdge('a', 'out', 'b', 'in'),
      createEdge('a', 'out', 'c', 'in'),
      createEdge('b', 'out', 'd', 'in'),
      createEdge('c', 'out', 'd', 'in'),
    ];
    const adj = buildAdjacencyList(nodes, edges);

    const sorted = topologicalSort(nodes, adj);

    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('c'));
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('d'));
    expect(sorted.indexOf('c')).toBeLessThan(sorted.indexOf('d'));
  });

  it('should return all nodes for valid DAG', () => {
    const nodes = [
      createNode('a'),
      createNode('b'),
      createNode('c'),
      createNode('d'),
      createNode('e'),
    ];
    const edges = [
      createEdge('a', 'out', 'c', 'in'),
      createEdge('b', 'out', 'c', 'in'),
      createEdge('c', 'out', 'd', 'in'),
      createEdge('c', 'out', 'e', 'in'),
    ];
    const adj = buildAdjacencyList(nodes, edges);

    const sorted = topologicalSort(nodes, adj);

    expect(sorted).toHaveLength(5);
  });
});

describe('getEdgesToPort', () => {
  it('should find edges to a specific port', () => {
    const edges = [
      createEdge('a', 'out', 'c', 'in1'),
      createEdge('b', 'out', 'c', 'in2'),
      createEdge('d', 'out', 'c', 'in1'),
    ];

    const result = getEdgesToPort(edges, 'c', 'in1');

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.from.nodeId)).toContain('a');
    expect(result.map((e) => e.from.nodeId)).toContain('d');
  });

  it('should return empty array if no edges found', () => {
    const edges = [createEdge('a', 'out', 'b', 'in')];

    const result = getEdgesToPort(edges, 'b', 'nonexistent');

    expect(result).toHaveLength(0);
  });
});

describe('getEdgesFromPort', () => {
  it('should find edges from a specific port', () => {
    const edges = [
      createEdge('a', 'out1', 'b', 'in'),
      createEdge('a', 'out2', 'c', 'in'),
      createEdge('a', 'out1', 'd', 'in'),
    ];

    const result = getEdgesFromPort(edges, 'a', 'out1');

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.to.nodeId)).toContain('b');
    expect(result.map((e) => e.to.nodeId)).toContain('d');
  });
});

describe('hasConnection', () => {
  it('should return true if port has incoming connection', () => {
    const edges = [
      createEdge('a', 'out', 'b', 'in'),
      createEdge('b', 'out', 'c', 'in'),
    ];

    expect(hasConnection(edges, 'b', 'in')).toBe(true);
    expect(hasConnection(edges, 'c', 'in')).toBe(true);
  });

  it('should return false if port has no incoming connection', () => {
    const edges = [createEdge('a', 'out', 'b', 'in')];

    expect(hasConnection(edges, 'a', 'in')).toBe(false);
    expect(hasConnection(edges, 'b', 'other')).toBe(false);
  });
});
