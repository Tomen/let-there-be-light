import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { GraphStore } from './graphs.js';
import { ValidationError } from './base.js';
import type { GraphNode, GraphEdge } from '@let-there-be-light/shared';

const TEST_DIR = join(import.meta.dirname, '../../test-data-graphs');

describe('GraphStore', () => {
  let store: GraphStore;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    store = new GraphStore(TEST_DIR);
    store.initialize();
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('initialization', () => {
    it('should seed default graphs', () => {
      const graphs = store.getAll();

      expect(graphs.length).toBeGreaterThan(0);
    });

    it('should include simple-pulse graph', () => {
      const graph = store.getById('simple-pulse');

      expect(graph).toBeDefined();
      expect(graph?.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('create', () => {
    it('should create valid graph', () => {
      const nodes: GraphNode[] = [
        { id: 'time', type: 'Time', position: { x: 0, y: 0 }, params: {} },
      ];

      const graph = store.create({
        name: 'Test Graph',
        nodes,
        edges: [],
      });

      expect(graph.id).toBeDefined();
      expect(graph.name).toBe('Test Graph');
    });

    it('should throw for unknown node type', () => {
      const nodes: GraphNode[] = [
        { id: 'invalid', type: 'UnknownNodeType' as any, position: { x: 0, y: 0 }, params: {} },
      ];

      expect(() => {
        store.create({ name: 'Invalid', nodes, edges: [] });
      }).toThrow(ValidationError);
    });

    it('should throw for edge referencing non-existent node', () => {
      const nodes: GraphNode[] = [
        { id: 'time', type: 'Time', position: { x: 0, y: 0 }, params: {} },
      ];
      const edges: GraphEdge[] = [
        { id: 'e1', from: { nodeId: 'time', port: 't' }, to: { nodeId: 'non-existent', port: 'value' } },
      ];

      expect(() => {
        store.create({ name: 'Invalid', nodes, edges });
      }).toThrow(ValidationError);
    });

    it('should throw for edge with invalid output port', () => {
      const nodes: GraphNode[] = [
        { id: 'time', type: 'Time', position: { x: 0, y: 0 }, params: {} },
        { id: 'clamp', type: 'Clamp01', position: { x: 100, y: 0 }, params: {} },
      ];
      const edges: GraphEdge[] = [
        { id: 'e1', from: { nodeId: 'time', port: 'invalid-port' }, to: { nodeId: 'clamp', port: 'value' } },
      ];

      expect(() => {
        store.create({ name: 'Invalid', nodes, edges });
      }).toThrow(ValidationError);
    });

    it('should throw for edge with invalid input port', () => {
      const nodes: GraphNode[] = [
        { id: 'time', type: 'Time', position: { x: 0, y: 0 }, params: {} },
        { id: 'clamp', type: 'Clamp01', position: { x: 100, y: 0 }, params: {} },
      ];
      const edges: GraphEdge[] = [
        { id: 'e1', from: { nodeId: 'time', port: 't' }, to: { nodeId: 'clamp', port: 'invalid-port' } },
      ];

      expect(() => {
        store.create({ name: 'Invalid', nodes, edges });
      }).toThrow(ValidationError);
    });

    it('should throw for duplicate node IDs', () => {
      const nodes: GraphNode[] = [
        { id: 'same', type: 'Time', position: { x: 0, y: 0 }, params: {} },
        { id: 'same', type: 'Clamp01', position: { x: 100, y: 0 }, params: {} },
      ];

      expect(() => {
        store.create({ name: 'Invalid', nodes, edges: [] });
      }).toThrow(ValidationError);
    });

    it('should throw for duplicate edge IDs', () => {
      const nodes: GraphNode[] = [
        { id: 'time', type: 'Time', position: { x: 0, y: 0 }, params: {} },
        { id: 'clamp', type: 'Clamp01', position: { x: 100, y: 0 }, params: {} },
      ];
      const edges: GraphEdge[] = [
        { id: 'same', from: { nodeId: 'time', port: 't' }, to: { nodeId: 'clamp', port: 'value' } },
        { id: 'same', from: { nodeId: 'time', port: 'dt' }, to: { nodeId: 'clamp', port: 'value' } },
      ];

      expect(() => {
        store.create({ name: 'Invalid', nodes, edges });
      }).toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('should validate updated graph structure', () => {
      const graph = store.create({
        name: 'Original',
        nodes: [{ id: 'time', type: 'Time', position: { x: 0, y: 0 }, params: {} }],
        edges: [],
      });

      expect(() => {
        store.update(
          graph.id,
          {
            nodes: [{ id: 'invalid', type: 'UnknownType' as any, position: { x: 0, y: 0 }, params: {} }],
          },
          graph.revision
        );
      }).toThrow(ValidationError);
    });
  });
});
