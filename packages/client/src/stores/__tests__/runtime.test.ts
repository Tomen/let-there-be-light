import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRuntimeStore } from '../runtime'

// Mock the wsClient
vi.mock('@/ws/connection', () => ({
  wsClient: {
    send: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
    onConnect: vi.fn(() => vi.fn()),
    onDisconnect: vi.fn(() => vi.fn()),
  },
}))

describe('useRuntimeStore', () => {
  beforeEach(() => {
    // Reset store state
    useRuntimeStore.setState({
      isConnected: false,
      tickHz: 0,
      currentTime: 0,
      instances: [],
      fixtureValues: {},
      compileResults: {},
      faders: {},
      buttonsDown: {},
    })
  })

  describe('initial state', () => {
    it('has correct initial state', () => {
      const state = useRuntimeStore.getState()

      expect(state.isConnected).toBe(false)
      expect(state.tickHz).toBe(0)
      expect(state.currentTime).toBe(0)
      expect(state.instances).toEqual([])
      expect(state.fixtureValues).toEqual({})
      expect(state.compileResults).toEqual({})
      expect(state.faders).toEqual({})
      expect(state.buttonsDown).toEqual({})
    })
  })

  describe('setFader', () => {
    it('updates fader state', async () => {
      const { wsClient } = await import('@/ws/connection')

      useRuntimeStore.getState().setFader('A', 0.5)

      expect(useRuntimeStore.getState().faders.A).toBe(0.5)
      expect(wsClient.send).toHaveBeenCalledWith({
        type: 'input/fader',
        faderId: 'A',
        value: 0.5,
      })
    })

    it('updates multiple faders independently', () => {
      useRuntimeStore.getState().setFader('A', 0.3)
      useRuntimeStore.getState().setFader('B', 0.7)

      expect(useRuntimeStore.getState().faders).toEqual({ A: 0.3, B: 0.7 })
    })
  })

  describe('buttonDown', () => {
    it('sets button down state', async () => {
      const { wsClient } = await import('@/ws/connection')

      useRuntimeStore.getState().buttonDown('X')

      expect(useRuntimeStore.getState().buttonsDown.X).toBe(true)
      expect(wsClient.send).toHaveBeenCalledWith({
        type: 'input/buttonDown',
        buttonId: 'X',
      })
    })
  })

  describe('buttonUp', () => {
    it('sets button up state', async () => {
      const { wsClient } = await import('@/ws/connection')

      useRuntimeStore.setState({ buttonsDown: { X: true } })
      useRuntimeStore.getState().buttonUp('X')

      expect(useRuntimeStore.getState().buttonsDown.X).toBe(false)
      expect(wsClient.send).toHaveBeenCalledWith({
        type: 'input/buttonUp',
        buttonId: 'X',
      })
    })
  })

  describe('buttonPress', () => {
    it('sends button press message', async () => {
      const { wsClient } = await import('@/ws/connection')

      useRuntimeStore.getState().buttonPress('Y')

      expect(wsClient.send).toHaveBeenCalledWith({
        type: 'input/buttonPress',
        buttonId: 'Y',
      })
    })
  })

  describe('subscribeFrames', () => {
    it('sends subscribe message with mode', async () => {
      const { wsClient } = await import('@/ws/connection')

      useRuntimeStore.getState().subscribeFrames('full')

      expect(wsClient.send).toHaveBeenCalledWith({
        type: 'runtime/subscribeFrames',
        mode: 'full',
        fixtureIds: undefined,
      })
    })

    it('sends subscribe message with fixture filter', async () => {
      const { wsClient } = await import('@/ws/connection')

      useRuntimeStore.getState().subscribeFrames('delta', ['f1', 'f2'])

      expect(wsClient.send).toHaveBeenCalledWith({
        type: 'runtime/subscribeFrames',
        mode: 'delta',
        fixtureIds: ['f1', 'f2'],
      })
    })
  })

  describe('unsubscribeFrames', () => {
    it('sends unsubscribe message', async () => {
      const { wsClient } = await import('@/ws/connection')

      useRuntimeStore.getState().unsubscribeFrames()

      expect(wsClient.send).toHaveBeenCalledWith({
        type: 'runtime/unsubscribeFrames',
      })
    })
  })

  describe('setInstanceEnabled', () => {
    it('sends instance enabled message', async () => {
      const { wsClient } = await import('@/ws/connection')

      useRuntimeStore.getState().setInstanceEnabled('instance-1', true)

      expect(wsClient.send).toHaveBeenCalledWith({
        type: 'instance/setEnabled',
        instanceId: 'instance-1',
        enabled: true,
      })
    })
  })
})
