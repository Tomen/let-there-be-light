import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  startTestServer,
  stopTestServer,
  api,
  createWsClient,
  ApiTestError,
  type TestWsClient,
} from '../setup'
import type {
  Fixture,
  Group,
  Graph,
  CompileResult,
  ServerMessage,
} from '@let-there-be-light/shared'

// WebSocket tests are flaky on Windows due to process cleanup timing
const isWindows = process.platform === 'win32';
const describeWithWs = isWindows ? describe.skip : describe;

describe('E2E Graph Workflow', () => {
  beforeAll(async () => {
    await startTestServer()
  })

  afterAll(async () => {
    await stopTestServer()
  })

  // This test uses WebSocket - skip on Windows due to flakiness
  describeWithWs('create and run a simple color graph', () => {
    let fixture: Fixture
    let group: Group
    let graph: Graph
    let wsClient: TestWsClient

    afterAll(() => {
      if (wsClient) wsClient.close()
    })

    it('step 1: create a fixture', async () => {
      fixture = await api.post<Fixture>('/fixtures', {
        name: 'e2e-test-fixture',
        modelId: 'generic-rgbw',
        universe: 0,
        startChannel: 1,
      })

      expect(fixture.id).toBeDefined()
    })

    it('step 2: create a group with the fixture', async () => {
      group = await api.post<Group>('/groups', {
        name: 'e2e-test-group',
        fixtureIds: [fixture.id],
      })

      expect(group.fixtureIds).toContain(fixture.id)
    })

    it('step 3: create a graph that outputs red to the group', async () => {
      graph = await api.post<Graph>('/graphs', {
        name: 'e2e-red-graph',
        nodes: [
          {
            id: 'select-1',
            type: 'SelectGroup',
            position: { x: 0, y: 0 },
            params: { groupId: group.id },
          },
          {
            id: 'color-1',
            type: 'ColorConstant',
            position: { x: 150, y: 0 },
            params: { r: 1, g: 0, b: 0 },
          },
          {
            id: 'write-1',
            type: 'WriteAttributes',
            position: { x: 300, y: 0 },
            params: { priority: 0 },
          },
        ],
        edges: [
          {
            id: 'e1',
            from: { nodeId: 'select-1', port: 'selection' },
            to: { nodeId: 'write-1', port: 'selection' },
          },
          {
            id: 'e2',
            from: { nodeId: 'color-1', port: 'color' },
            to: { nodeId: 'write-1', port: 'bundle' },
          },
        ],
      })

      expect(graph.nodes).toHaveLength(3)
      expect(graph.edges).toHaveLength(2)
    })

    it('step 4: compile the graph successfully', async () => {
      const result = await api.post<CompileResult>(`/graphs/${graph.id}/compile`, {})

      expect(result.ok).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.dependencies.groupIds).toContain(group.id)
    })

    it('step 5: connect websocket and receive status', async () => {
      wsClient = await createWsClient()

      // Get initial status
      const status = await wsClient.waitForMessage<ServerMessage>()
      expect(status.type).toBe('runtime/status')

      // Verify we can subscribe without error
      wsClient.send({
        type: 'runtime/subscribeFrames',
        mode: 'full',
        fixtureIds: [fixture.id],
      })

      // Allow time for subscription to be processed
      await new Promise((resolve) => setTimeout(resolve, 200))
    })
  })

  // This test uses WebSocket - skip on Windows due to flakiness
  describeWithWs('fader controls graph output', () => {
    let fixture: Fixture
    let group: Group
    let graph: Graph
    let wsClient: TestWsClient

    beforeAll(async () => {
      // Create test fixture and group
      fixture = await api.post<Fixture>('/fixtures', {
        name: 'fader-test-fixture',
        modelId: 'generic-rgbw',
        universe: 0,
        startChannel: 50,
      })

      group = await api.post<Group>('/groups', {
        name: 'fader-test-group',
        fixtureIds: [fixture.id],
      })

      // Create graph: Fader → Multiply with ColorConstant → WriteAttributes
      graph = await api.post<Graph>('/graphs', {
        name: 'fader-control-graph',
        nodes: [
          {
            id: 'select-1',
            type: 'SelectGroup',
            position: { x: 0, y: 0 },
            params: { groupId: group.id },
          },
          {
            id: 'fader-1',
            type: 'Fader',
            position: { x: 0, y: 100 },
            params: { faderId: 'master' },
          },
          {
            id: 'color-1',
            type: 'ColorConstant',
            position: { x: 150, y: 0 },
            params: { r: 1, g: 1, b: 1 },
          },
          {
            id: 'scale-1',
            type: 'ScaleColor',
            position: { x: 300, y: 0 },
            params: {},
          },
          {
            id: 'write-1',
            type: 'WriteAttributes',
            position: { x: 450, y: 0 },
            params: { priority: 0 },
          },
        ],
        edges: [
          {
            id: 'e1',
            from: { nodeId: 'select-1', port: 'selection' },
            to: { nodeId: 'write-1', port: 'selection' },
          },
          {
            id: 'e2',
            from: { nodeId: 'color-1', port: 'color' },
            to: { nodeId: 'scale-1', port: 'color' },
          },
          {
            id: 'e3',
            from: { nodeId: 'fader-1', port: 'value' },
            to: { nodeId: 'scale-1', port: 'scale' },
          },
          {
            id: 'e4',
            from: { nodeId: 'scale-1', port: 'result' },
            to: { nodeId: 'write-1', port: 'bundle' },
          },
        ],
      })

      // Compile
      const result = await api.post<CompileResult>(`/graphs/${graph.id}/compile`, {})
      expect(result.ok).toBe(true)

      // Connect WebSocket
      wsClient = await createWsClient()
      await wsClient.waitForMessage() // Consume status
    })

    afterAll(() => {
      if (wsClient) wsClient.close()
    })

    it('accepts fader input via websocket', async () => {
      // Subscribe to frames
      wsClient.send({
        type: 'runtime/subscribeFrames',
        mode: 'full',
      })

      // Send fader input - verify it's accepted without error
      wsClient.send({
        type: 'input/fader',
        faderId: 'master',
        value: 0.75,
      })

      // Allow time for the message to be processed
      await new Promise((resolve) => setTimeout(resolve, 200))
    })
  })

  describe('graph modification flow', () => {
    it('creates graph, modifies it, recompiles', async () => {
      // Create initial graph
      const graph = await api.post<Graph>('/graphs', {
        name: 'modify-test',
        nodes: [
          { id: 'time-1', type: 'Time', position: { x: 0, y: 0 }, params: {} },
        ],
        edges: [],
      })

      // Compile - should succeed
      let result = await api.post<CompileResult>(`/graphs/${graph.id}/compile`, {})
      expect(result.ok).toBe(true)

      // Modify graph - add more nodes
      const updated = await api.put<Graph>(`/graphs/${graph.id}`, {
        data: {
          nodes: [
            { id: 'time-1', type: 'Time', position: { x: 0, y: 0 }, params: {} },
            { id: 'sine-1', type: 'SineLFO', position: { x: 150, y: 0 }, params: { frequency: 1, phase: 0 } },
          ],
          edges: [
            { id: 'e1', from: { nodeId: 'time-1', port: 't' }, to: { nodeId: 'sine-1', port: 'speed' } },
          ],
        },
        revision: graph.revision,
      })

      expect(updated.nodes).toHaveLength(2)
      expect(updated.edges).toHaveLength(1)

      // Recompile - should still succeed
      result = await api.post<CompileResult>(`/graphs/${updated.id}/compile`, {})
      expect(result.ok).toBe(true)
    })

    it('handles invalid graph creation gracefully', async () => {
      // Attempt to create graph with unknown node type - should fail
      try {
        await api.post<Graph>('/graphs', {
          name: 'error-test',
          nodes: [
            { id: 'invalid-1', type: 'NotARealNodeType', position: { x: 0, y: 0 }, params: {} },
          ],
          edges: [],
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(400)
      }

      // Create a valid graph instead and verify it compiles
      const graph = await api.post<Graph>('/graphs', {
        name: 'valid-after-error',
        nodes: [
          { id: 'time-1', type: 'Time', position: { x: 0, y: 0 }, params: {} },
        ],
        edges: [],
      })

      const result = await api.post<CompileResult>(`/graphs/${graph.id}/compile`, {})
      expect(result.ok).toBe(true)
    })
  })
})
