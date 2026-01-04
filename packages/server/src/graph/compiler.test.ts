import { describe, it, expect } from 'vitest';
import type { Graph, GraphNode, GraphEdge } from '@let-there-be-light/shared';
import { compileGraph, extractDependencies, getCompiledGraph } from './compiler.js';

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
  edges: GraphEdge[]
): Graph {
  return {
    id,
    revision: 1,
    name: 'Test Graph',
    nodes,
    edges,
    enabled: true,
  };
}

describe('compileGraph', () => {
  describe('node type validation', () => {
    it('should reject unknown node types', () => {
      const graph = createGraph(
        'test',
        [createNode('a', 'NonexistentNode')],
        []
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('UNKNOWN_NODE_TYPE');
      expect(result.errors[0].nodeId).toBe('a');
    });

    it('should accept valid node types', () => {
      const graph = createGraph(
        'test',
        [createNode('time1', 'Time')],
        []
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(true);
    });
  });

  describe('cycle detection', () => {
    it('should reject graphs with cycles', () => {
      const graph = createGraph(
        'test',
        [
          createNode('a', 'Add'),
          createNode('b', 'Add'),
        ],
        [
          createEdge('a', 'result', 'b', 'a'),
          createEdge('b', 'result', 'a', 'a'),
        ]
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'CYCLE_DETECTED')).toBe(true);
    });

    it('should accept DAGs', () => {
      const graph = createGraph(
        'test',
        [
          createNode('time1', 'Time'),
          createNode('sine1', 'SineLFO'),
        ],
        [createEdge('time1', 't', 'sine1', 'speed')]
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(true);
    });
  });

  describe('type checking', () => {
    it('should reject incompatible type connections', () => {
      const graph = createGraph(
        'test',
        [
          createNode('group1', 'SelectGroup', { groupId: 'all' }),
          createNode('add1', 'Add'),
        ],
        [createEdge('group1', 'selection', 'add1', 'a')] // Selection -> Scalar is invalid
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true);
    });

    it('should accept compatible type connections', () => {
      const graph = createGraph(
        'test',
        [
          createNode('fader1', 'Fader', { faderId: 'f1' }),
          createNode('add1', 'Add'),
          createNode('add2', 'Add'),
        ],
        [
          createEdge('fader1', 'value', 'add1', 'a'),
          createEdge('fader1', 'value', 'add1', 'b'),
          createEdge('add1', 'result', 'add2', 'a'),
          createEdge('add1', 'result', 'add2', 'b'),
        ]
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(true);
    });

    it('should allow Trigger -> Bool connection', () => {
      const graph = createGraph(
        'test',
        [
          createNode('btn1', 'Button', { buttonId: 'b1' }),
          createNode('flash1', 'Flash'),
        ],
        [createEdge('btn1', 'pressed', 'flash1', 'trigger')]
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(true);
    });

    it('should allow Color -> Bundle connection', () => {
      const graph = createGraph(
        'test',
        [
          createNode('color1', 'ColorConstant'),
          createNode('scale1', 'ScaleBundle'),
        ],
        [createEdge('color1', 'color', 'scale1', 'bundle')]
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(true);
    });
  });

  describe('port validation', () => {
    it('should reject invalid output port', () => {
      const graph = createGraph(
        'test',
        [
          createNode('time1', 'Time'),
          createNode('add1', 'Add'),
        ],
        [createEdge('time1', 'nonexistent', 'add1', 'a')]
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_PARAM')).toBe(true);
    });

    it('should reject invalid input port', () => {
      const graph = createGraph(
        'test',
        [
          createNode('time1', 'Time'),
          createNode('add1', 'Add'),
        ],
        [createEdge('time1', 't', 'add1', 'nonexistent')]
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_PARAM')).toBe(true);
    });
  });

  describe('required input validation', () => {
    it('should reject WriteAttributes without selection', () => {
      const graph = createGraph(
        'test',
        [
          createNode('color1', 'ColorConstant'),
          createNode('write1', 'WriteAttributes'),
        ],
        [createEdge('color1', 'color', 'write1', 'bundle')]
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) =>
        e.code === 'MISSING_CONNECTION' && e.port === 'selection'
      )).toBe(true);
    });

    it('should reject WriteAttributes without bundle', () => {
      const graph = createGraph(
        'test',
        [
          createNode('group1', 'SelectGroup', { groupId: 'all' }),
          createNode('write1', 'WriteAttributes'),
        ],
        [createEdge('group1', 'selection', 'write1', 'selection')]
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) =>
        e.code === 'MISSING_CONNECTION' && e.port === 'bundle'
      )).toBe(true);
    });

    it('should accept WriteAttributes with both inputs', () => {
      const graph = createGraph(
        'test',
        [
          createNode('group1', 'SelectGroup', { groupId: 'all' }),
          createNode('color1', 'ColorConstant'),
          createNode('write1', 'WriteAttributes'),
        ],
        [
          createEdge('group1', 'selection', 'write1', 'selection'),
          createEdge('color1', 'color', 'write1', 'bundle'),
        ]
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(true);
    });

    it('should reject MixColor without required inputs', () => {
      const graph = createGraph(
        'test',
        [createNode('mix1', 'MixColor')],
        []
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_CONNECTION')).toBe(true);
    });
  });

  describe('parameter validation', () => {
    it('should reject Fader without faderId', () => {
      const graph = createGraph(
        'test',
        [createNode('fader1', 'Fader', {})],
        []
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_PARAM')).toBe(true);
    });

    it('should reject invalid param types', () => {
      const graph = createGraph(
        'test',
        [createNode('sine1', 'SineLFO', { frequency: 'invalid' })],
        []
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_PARAM')).toBe(true);
    });
  });

  describe('complex graphs', () => {
    it('should compile a valid effect graph', () => {
      const graph = createGraph(
        'test',
        [
          createNode('time1', 'Time'),
          createNode('fader1', 'Fader', { faderId: 'intensity' }),
          createNode('sine1', 'SineLFO'),
          createNode('color1', 'ColorConstant', { r: 1, g: 0, b: 0 }),
          createNode('scale1', 'ScaleColor'),
          createNode('group1', 'SelectGroup', { groupId: 'front' }),
          createNode('write1', 'WriteAttributes'),
        ],
        [
          createEdge('time1', 't', 'sine1', 'speed'),
          createEdge('sine1', 'value', 'scale1', 'scale'),
          createEdge('color1', 'color', 'scale1', 'color'),
          createEdge('group1', 'selection', 'write1', 'selection'),
          createEdge('scale1', 'result', 'write1', 'bundle'),
        ]
      );

      const result = compileGraph(graph);

      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('extractDependencies', () => {
  it('should extract fader dependencies', () => {
    const graph = createGraph(
      'test',
      [
        createNode('f1', 'Fader', { faderId: 'main' }),
        createNode('f2', 'Fader', { faderId: 'aux' }),
      ],
      []
    );

    const deps = extractDependencies(graph);

    expect(deps.faderIds).toContain('main');
    expect(deps.faderIds).toContain('aux');
    expect(deps.faderIds).toHaveLength(2);
  });

  it('should extract button dependencies', () => {
    const graph = createGraph(
      'test',
      [
        createNode('b1', 'Button', { buttonId: 'flash' }),
        createNode('b2', 'Button', { buttonId: 'strobe' }),
      ],
      []
    );

    const deps = extractDependencies(graph);

    expect(deps.buttonIds).toContain('flash');
    expect(deps.buttonIds).toContain('strobe');
  });

  it('should extract preset dependencies', () => {
    const graph = createGraph(
      'test',
      [
        createNode('p1', 'PresetBundle', { presetId: 'warm' }),
      ],
      []
    );

    const deps = extractDependencies(graph);

    expect(deps.presetIds).toContain('warm');
  });

  it('should extract group dependencies', () => {
    const graph = createGraph(
      'test',
      [
        createNode('g1', 'SelectGroup', { groupId: 'front' }),
        createNode('g2', 'SelectGroup', { groupId: 'back' }),
      ],
      []
    );

    const deps = extractDependencies(graph);

    expect(deps.groupIds).toContain('front');
    expect(deps.groupIds).toContain('back');
  });

  it('should extract fixture dependencies', () => {
    const graph = createGraph(
      'test',
      [
        createNode('fix1', 'SelectFixture', { fixtureId: 'spot-1' }),
      ],
      []
    );

    const deps = extractDependencies(graph);

    expect(deps.fixtureIds).toContain('spot-1');
  });

  it('should deduplicate dependencies', () => {
    const graph = createGraph(
      'test',
      [
        createNode('f1', 'Fader', { faderId: 'main' }),
        createNode('f2', 'Fader', { faderId: 'main' }), // duplicate
      ],
      []
    );

    const deps = extractDependencies(graph);

    expect(deps.faderIds).toHaveLength(1);
    expect(deps.faderIds[0]).toBe('main');
  });

  it('should return empty arrays for graph with no dependencies', () => {
    const graph = createGraph(
      'test',
      [createNode('time1', 'Time')],
      []
    );

    const deps = extractDependencies(graph);

    expect(deps.faderIds).toHaveLength(0);
    expect(deps.buttonIds).toHaveLength(0);
    expect(deps.presetIds).toHaveLength(0);
    expect(deps.groupIds).toHaveLength(0);
    expect(deps.fixtureIds).toHaveLength(0);
  });
});

describe('getCompiledGraph', () => {
  it('should return CompiledGraph for valid graph', () => {
    const graph = createGraph(
      'test-graph',
      [
        createNode('time1', 'Time'),
        createNode('sine1', 'SineLFO'),
      ],
      [createEdge('time1', 't', 'sine1', 'speed')]
    );

    const compiled = getCompiledGraph(graph);

    expect(compiled).not.toBeNull();
    expect(compiled!.graphId).toBe('test-graph');
    expect(compiled!.evaluationOrder).toContain('time1');
    expect(compiled!.evaluationOrder).toContain('sine1');
    expect(compiled!.evaluationOrder.indexOf('time1')).toBeLessThan(
      compiled!.evaluationOrder.indexOf('sine1')
    );
  });

  it('should return null for invalid graph', () => {
    const graph = createGraph(
      'test',
      [createNode('unknown', 'NonexistentNode')],
      []
    );

    const compiled = getCompiledGraph(graph);

    expect(compiled).toBeNull();
  });

  it('should include dependencies in compiled graph', () => {
    const graph = createGraph(
      'test',
      [
        createNode('f1', 'Fader', { faderId: 'main' }),
        createNode('g1', 'SelectGroup', { groupId: 'all' }),
      ],
      []
    );

    const compiled = getCompiledGraph(graph);

    expect(compiled).not.toBeNull();
    expect(compiled!.dependencies.faderIds).toContain('main');
    expect(compiled!.dependencies.groupIds).toContain('all');
  });
});
