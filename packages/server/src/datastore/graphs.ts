import { join } from 'node:path';
import type { Graph, GraphNode, GraphEdge } from '@let-there-be-light/shared';
import { NODE_DEFINITIONS } from '@let-there-be-light/shared';
import { YamlDataStore, ValidationError } from './base.js';

// Default graphs
const DEFAULT_GRAPHS: Graph[] = [
  {
    id: 'simple-pulse',
    name: 'Simple Pulse',
    revision: 1,
    nodes: [
      { id: 'time', type: 'Time', position: { x: 100, y: 150 }, params: {} },
      { id: 'lfo', type: 'SineLFO', position: { x: 300, y: 100 }, params: { frequency: 1, phase: 0 } },
      { id: 'color', type: 'ColorConstant', position: { x: 300, y: 250 }, params: { r: 1, g: 0.2, b: 0 } },
      { id: 'scale', type: 'ScaleColor', position: { x: 500, y: 175 }, params: {} },
      { id: 'group', type: 'SelectGroup', position: { x: 500, y: 350 }, params: { groupId: 'all-wash' } },
      { id: 'bundle', type: 'MergeBundle', position: { x: 700, y: 200 }, params: {} },
      { id: 'output', type: 'WriteAttributes', position: { x: 900, y: 275 }, params: { priority: 0 } },
    ],
    edges: [
      { id: 'e1', from: { nodeId: 'lfo', port: 'value' }, to: { nodeId: 'scale', port: 'scale' } },
      { id: 'e2', from: { nodeId: 'color', port: 'color' }, to: { nodeId: 'scale', port: 'color' } },
      { id: 'e3', from: { nodeId: 'group', port: 'selection' }, to: { nodeId: 'output', port: 'selection' } },
    ],
  },
];

export class GraphStore extends YamlDataStore<Graph> {
  constructor(dataDir: string) {
    super(join(dataDir, 'graphs.yaml'), 'Graph');
  }

  /**
   * Initialize with default data if empty
   */
  initialize(): void {
    this.seed(DEFAULT_GRAPHS);
  }

  /**
   * Create graph with validation
   */
  override create(data: Omit<Graph, 'id' | 'revision'>, id?: string): Graph {
    this.validateGraph(data);
    return super.create(data, id);
  }

  /**
   * Update graph with validation
   */
  override update(id: string, data: Partial<Omit<Graph, 'id' | 'revision'>>, expectedRevision: number): Graph {
    // Get existing and merge for validation
    const existing = this.getByIdOrThrow(id);
    const merged = {
      nodes: data.nodes ?? existing.nodes,
      edges: data.edges ?? existing.edges,
    };
    this.validateGraph(merged);
    return super.update(id, data, expectedRevision);
  }

  /**
   * Validate graph structure (basic validation, full compile is separate)
   */
  private validateGraph(data: { nodes: GraphNode[]; edges: GraphEdge[] }): void {
    const { nodes, edges } = data;
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Validate all nodes have valid types
    for (const node of nodes) {
      if (!(node.type in NODE_DEFINITIONS)) {
        throw new ValidationError(`Unknown node type: ${node.type}`);
      }
    }

    // Validate all edges reference existing nodes
    for (const edge of edges) {
      if (!nodeIds.has(edge.from.nodeId)) {
        throw new ValidationError(`Edge references unknown node: ${edge.from.nodeId}`);
      }
      if (!nodeIds.has(edge.to.nodeId)) {
        throw new ValidationError(`Edge references unknown node: ${edge.to.nodeId}`);
      }

      // Validate ports exist on nodes
      const fromNode = nodes.find((n) => n.id === edge.from.nodeId)!;
      const toNode = nodes.find((n) => n.id === edge.to.nodeId)!;
      const fromDef = NODE_DEFINITIONS[fromNode.type as keyof typeof NODE_DEFINITIONS];
      const toDef = NODE_DEFINITIONS[toNode.type as keyof typeof NODE_DEFINITIONS];

      if (!(edge.from.port in fromDef.outputs)) {
        throw new ValidationError(
          `Node ${edge.from.nodeId} (${fromNode.type}) has no output port: ${edge.from.port}`
        );
      }
      if (!(edge.to.port in toDef.inputs)) {
        throw new ValidationError(
          `Node ${edge.to.nodeId} (${toNode.type}) has no input port: ${edge.to.port}`
        );
      }
    }

    // Check for duplicate node IDs
    if (nodeIds.size !== nodes.length) {
      throw new ValidationError('Duplicate node IDs found');
    }

    // Check for duplicate edge IDs
    const edgeIds = new Set(edges.map((e) => e.id));
    if (edgeIds.size !== edges.length) {
      throw new ValidationError('Duplicate edge IDs found');
    }
  }
}

// Singleton instance
let instance: GraphStore | null = null;

export function getGraphStore(dataDir: string): GraphStore {
  if (!instance) {
    instance = new GraphStore(dataDir);
    instance.initialize();
  }
  return instance;
}

export function resetGraphStore(): void {
  instance = null;
}
