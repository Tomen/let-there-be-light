import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Graph, GraphNode, GraphEdge } from '@let-there-be-light/shared';
import { RuntimeEngine } from './engine.js';

// Mock getStores to provide test fixtures
vi.mock('../datastore/index.js', () => ({
  getStores: () => ({
    graphs: {
      getById: (id: string) => testGraphs.get(id),
      getAll: () => [...testGraphs.values()],
    },
    fixtures: {
      getAll: () => [
        { id: 'fix1', modelId: 'generic-dimmer', address: { universe: 0, channel: 1 } },
        { id: 'fix2', modelId: 'generic-dimmer', address: { universe: 0, channel: 2 } },
      ],
    },
    groups: {
      getById: (id: string) => {
        if (id === 'all') return { id: 'all', fixtureIds: ['fix1', 'fix2'] };
        return null;
      },
    },
    inputs: {
      getAll: () => [],
    },
  }),
}));

// Test graph storage
const testGraphs = new Map<string, Graph>();

// Helper to create test nodes
function createNode(
  id: string,
  type: string,
  params: Record<string, unknown> = {}
): GraphNode {
  return { id, type, params, position: { x: 0, y: 0 } };
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

// Helper to create test graph
function createGraph(
  id: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  enabled = true
): Graph {
  return {
    id,
    revision: 1,
    name: `Test Graph ${id}`,
    nodes,
    edges,
    enabled,
  };
}

describe('RuntimeEngine', () => {
  let engine: RuntimeEngine;

  beforeEach(() => {
    testGraphs.clear();
    engine = new RuntimeEngine(60);
  });

  afterEach(() => {
    engine.stop();
  });

  describe('getWriteOutputs', () => {
    it('returns empty array for unknown graph', () => {
      const outputs = engine.getWriteOutputs('nonexistent');
      expect(outputs).toEqual([]);
    });

    it('returns empty array for graph with no WriteAttributes', () => {
      const graph = createGraph(
        'no-writes',
        [createNode('time1', 'Time')],
        []
      );
      testGraphs.set(graph.id, graph);
      engine.loadGraph(graph.id);

      // Need to run one tick for evaluation
      engine.start();
      // Wait a bit for a tick
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const outputs = engine.getWriteOutputs('no-writes');
          expect(outputs).toEqual([]);
          resolve();
        }, 20);
      });
    });

    it('returns write info for graph with WriteAttributes', () => {
      const graph = createGraph(
        'with-writes',
        [
          createNode('group1', 'SelectGroup', { groupId: 'all' }),
          createNode('color1', 'ColorConstant', { color: { r: 1, g: 0, b: 0 } }),
          createNode('write1', 'WriteAttributes'),
        ],
        [
          createEdge('group1', 'selection', 'write1', 'selection'),
          createEdge('color1', 'color', 'write1', 'bundle'),
        ]
      );
      testGraphs.set(graph.id, graph);
      engine.loadGraph(graph.id);

      engine.start();
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const outputs = engine.getWriteOutputs('with-writes');
          expect(outputs.length).toBe(1);
          expect(outputs[0].nodeId).toBe('write1');
          expect(outputs[0].selection).toContain('fix1');
          expect(outputs[0].selection).toContain('fix2');
          expect(outputs[0].bundle.color).toBeDefined();
          expect(outputs[0].priority).toBe(0);
          resolve();
        }, 20);
      });
    });

    it('returns empty array for disabled graph', () => {
      const graph = createGraph(
        'disabled-graph',
        [
          createNode('group1', 'SelectGroup', { groupId: 'all' }),
          createNode('color1', 'ColorConstant', { color: { r: 1, g: 0, b: 0 } }),
          createNode('write1', 'WriteAttributes'),
        ],
        [
          createEdge('group1', 'selection', 'write1', 'selection'),
          createEdge('color1', 'color', 'write1', 'bundle'),
        ]
      );
      testGraphs.set(graph.id, graph);
      engine.loadGraph(graph.id);
      engine.setGraphEnabled(graph.id, false);

      engine.start();
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const outputs = engine.getWriteOutputs('disabled-graph');
          expect(outputs).toEqual([]);
          resolve();
        }, 20);
      });
    });
  });

  describe('isGraphEnabled', () => {
    it('returns false for unknown graph', () => {
      expect(engine.isGraphEnabled('nonexistent')).toBe(false);
    });

    it('returns true for enabled graph', () => {
      const graph = createGraph('enabled', [createNode('time1', 'Time')], []);
      testGraphs.set(graph.id, graph);
      engine.loadGraph(graph.id);

      expect(engine.isGraphEnabled('enabled')).toBe(true);
    });

    it('returns false after disabling graph', () => {
      const graph = createGraph('to-disable', [createNode('time1', 'Time')], []);
      testGraphs.set(graph.id, graph);
      engine.loadGraph(graph.id);
      engine.setGraphEnabled(graph.id, false);

      expect(engine.isGraphEnabled('to-disable')).toBe(false);
    });
  });

  describe('unloadGraph', () => {
    it('clears write outputs when unloading', () => {
      const graph = createGraph(
        'unload-test',
        [
          createNode('group1', 'SelectGroup', { groupId: 'all' }),
          createNode('color1', 'ColorConstant', { color: { r: 1, g: 0, b: 0 } }),
          createNode('write1', 'WriteAttributes'),
        ],
        [
          createEdge('group1', 'selection', 'write1', 'selection'),
          createEdge('color1', 'color', 'write1', 'bundle'),
        ]
      );
      testGraphs.set(graph.id, graph);
      engine.loadGraph(graph.id);

      engine.start();
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should have write outputs
          expect(engine.getWriteOutputs('unload-test').length).toBeGreaterThan(0);

          // Unload the graph
          engine.unloadGraph('unload-test');

          // Write outputs should be cleared
          expect(engine.getWriteOutputs('unload-test')).toEqual([]);
          resolve();
        }, 20);
      });
    });
  });

  describe('unloadAllGraphs', () => {
    it('clears all write outputs', () => {
      const graph1 = createGraph(
        'graph1',
        [
          createNode('group1', 'SelectGroup', { groupId: 'all' }),
          createNode('color1', 'ColorConstant', { color: { r: 1, g: 0, b: 0 } }),
          createNode('write1', 'WriteAttributes'),
        ],
        [
          createEdge('group1', 'selection', 'write1', 'selection'),
          createEdge('color1', 'color', 'write1', 'bundle'),
        ]
      );
      testGraphs.set(graph1.id, graph1);
      engine.loadGraph(graph1.id);

      engine.start();
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(engine.getWriteOutputs('graph1').length).toBeGreaterThan(0);

          engine.unloadAllGraphs();

          expect(engine.getWriteOutputs('graph1')).toEqual([]);
          expect(engine.getLoadedGraphIds()).toEqual([]);
          resolve();
        }, 20);
      });
    });
  });
});
