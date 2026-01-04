import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startTestServer, stopTestServer, api, ApiTestError } from '../setup'
import type { Graph, CompileResult, Group } from '@let-there-be-light/shared'

describe('Graphs API', () => {
  beforeAll(async () => {
    await startTestServer()
  })

  afterAll(async () => {
    await stopTestServer()
  })

  describe('GET /graphs', () => {
    it('returns array of graphs', async () => {
      const graphs = await api.get<Graph[]>('/graphs')

      expect(Array.isArray(graphs)).toBe(true)
    })

    it('graphs have correct shape', async () => {
      // Create a graph first to ensure there's at least one
      await api.post<Graph>('/graphs', {
        name: 'shape-test',
        nodes: [],
        edges: [],
      })

      const graphs = await api.get<Graph[]>('/graphs')
      const graph = graphs[0]

      expect(graph).toHaveProperty('id')
      expect(graph).toHaveProperty('revision')
      expect(graph).toHaveProperty('name')
      expect(graph).toHaveProperty('nodes')
      expect(graph).toHaveProperty('edges')
      expect(Array.isArray(graph.nodes)).toBe(true)
      expect(Array.isArray(graph.edges)).toBe(true)
    })
  })

  describe('GET /graphs/:id', () => {
    it('returns single graph', async () => {
      const created = await api.post<Graph>('/graphs', {
        name: 'get-test',
        nodes: [],
        edges: [],
      })

      const graph = await api.get<Graph>(`/graphs/${created.id}`)

      expect(graph.id).toBe(created.id)
      expect(graph.name).toBe('get-test')
    })

    it('returns 404 for unknown graph', async () => {
      try {
        await api.get('/graphs/unknown-graph-id')
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(404)
      }
    })
  })

  describe('POST /graphs', () => {
    it('creates an empty graph', async () => {
      const created = await api.post<Graph>('/graphs', {
        name: 'empty-graph',
        nodes: [],
        edges: [],
      })

      expect(created.id).toBeDefined()
      expect(created.revision).toBe(1)
      expect(created.name).toBe('empty-graph')
      expect(created.nodes).toEqual([])
      expect(created.edges).toEqual([])
    })

    it('creates graph with nodes', async () => {
      const created = await api.post<Graph>('/graphs', {
        name: 'nodes-graph',
        nodes: [
          { id: 'time-1', type: 'Time', position: { x: 0, y: 0 }, params: {} },
          { id: 'fader-1', type: 'Fader', position: { x: 100, y: 0 }, params: { faderId: 'A' } },
        ],
        edges: [],
      })

      expect(created.nodes).toHaveLength(2)
      expect(created.nodes[0].type).toBe('Time')
      expect(created.nodes[1].params.faderId).toBe('A')
    })

    it('creates graph with nodes and edges', async () => {
      const created = await api.post<Graph>('/graphs', {
        name: 'connected-graph',
        nodes: [
          { id: 'add-1', type: 'Add', position: { x: 0, y: 0 }, params: {} },
          { id: 'add-2', type: 'Add', position: { x: 100, y: 0 }, params: {} },
        ],
        edges: [
          { id: 'edge-1', from: { nodeId: 'add-1', port: 'result' }, to: { nodeId: 'add-2', port: 'a' } },
        ],
      })

      expect(created.edges).toHaveLength(1)
      expect(created.edges[0].from.nodeId).toBe('add-1')
      expect(created.edges[0].to.nodeId).toBe('add-2')
    })
  })

  describe('PUT /graphs/:id', () => {
    it('updates graph with correct revision', async () => {
      const created = await api.post<Graph>('/graphs', {
        name: 'update-graph-test',
        nodes: [],
        edges: [],
      })

      const updated = await api.put<Graph>(`/graphs/${created.id}`, {
        data: {
          name: 'updated-graph',
          nodes: [{ id: 'time-1', type: 'Time', position: { x: 0, y: 0 }, params: {} }],
        },
        revision: created.revision,
      })

      expect(updated.name).toBe('updated-graph')
      expect(updated.nodes).toHaveLength(1)
      expect(updated.revision).toBe(created.revision + 1)
    })

    it('returns 409 for wrong revision', async () => {
      const created = await api.post<Graph>('/graphs', {
        name: 'conflict-graph-test',
        nodes: [],
        edges: [],
      })

      try {
        await api.put(`/graphs/${created.id}`, {
          data: { name: 'will-fail' },
          revision: 999,
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(409)
      }
    })
  })

  describe('DELETE /graphs/:id', () => {
    it('deletes graph', async () => {
      const created = await api.post<Graph>('/graphs', {
        name: 'delete-graph-test',
        nodes: [],
        edges: [],
      })

      await api.delete(`/graphs/${created.id}`)

      try {
        await api.get(`/graphs/${created.id}`)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(404)
      }
    })
  })

  describe('POST /graphs/:id/compile', () => {
    it('compiles empty graph successfully', async () => {
      const graph = await api.post<Graph>('/graphs', {
        name: 'compile-empty',
        nodes: [],
        edges: [],
      })

      const result = await api.post<CompileResult>(`/graphs/${graph.id}/compile`, {})

      expect(result.ok).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('compiles valid graph with nodes', async () => {
      const groups = await api.get<Group[]>('/groups')
      const groupId = groups[0]?.id ?? 'all'

      const graph = await api.post<Graph>('/graphs', {
        name: 'compile-valid',
        nodes: [
          { id: 'group-1', type: 'SelectGroup', position: { x: 0, y: 0 }, params: { groupId } },
          { id: 'color-1', type: 'ColorConstant', position: { x: 100, y: 0 }, params: { r: 1, g: 0, b: 0 } },
          { id: 'write-1', type: 'WriteAttributes', position: { x: 200, y: 0 }, params: { priority: 0 } },
        ],
        edges: [
          { id: 'e1', from: { nodeId: 'group-1', port: 'selection' }, to: { nodeId: 'write-1', port: 'selection' } },
          { id: 'e2', from: { nodeId: 'color-1', port: 'color' }, to: { nodeId: 'write-1', port: 'bundle' } },
        ],
      })

      const result = await api.post<CompileResult>(`/graphs/${graph.id}/compile`, {})

      expect(result.ok).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.dependencies).toBeDefined()
    })

    it('rejects graph with unknown node type on creation', async () => {
      try {
        await api.post<Graph>('/graphs', {
          name: 'compile-invalid-type',
          nodes: [
            { id: 'bad-1', type: 'UnknownNodeType', position: { x: 0, y: 0 }, params: {} },
          ],
          edges: [],
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(400)
      }
    })

    it('detects cycles in graph', async () => {
      const graph = await api.post<Graph>('/graphs', {
        name: 'compile-cycle',
        nodes: [
          { id: 'add-1', type: 'Add', position: { x: 0, y: 0 }, params: {} },
          { id: 'add-2', type: 'Add', position: { x: 100, y: 0 }, params: {} },
        ],
        edges: [
          { id: 'e1', from: { nodeId: 'add-1', port: 'result' }, to: { nodeId: 'add-2', port: 'a' } },
          { id: 'e2', from: { nodeId: 'add-2', port: 'result' }, to: { nodeId: 'add-1', port: 'a' } },
        ],
      })

      const result = await api.post<CompileResult>(`/graphs/${graph.id}/compile`, {})

      expect(result.ok).toBe(false)
      expect(result.errors.some((e) => e.code === 'CYCLE_DETECTED')).toBe(true)
    })

    it('detects type mismatches', async () => {
      const graph = await api.post<Graph>('/graphs', {
        name: 'compile-type-mismatch',
        nodes: [
          { id: 'time-1', type: 'Time', position: { x: 0, y: 0 }, params: {} },
          { id: 'mix-1', type: 'MixColor', position: { x: 100, y: 0 }, params: {} },
        ],
        edges: [
          // Time outputs Scalar, MixColor.a expects Color - type mismatch
          { id: 'e1', from: { nodeId: 'time-1', port: 't' }, to: { nodeId: 'mix-1', port: 'a' } },
        ],
      })

      const result = await api.post<CompileResult>(`/graphs/${graph.id}/compile`, {})

      expect(result.ok).toBe(false)
      expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true)
    })

    it('returns 404 for unknown graph', async () => {
      try {
        await api.post('/graphs/unknown-id/compile', {})
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(404)
      }
    })
  })
})
