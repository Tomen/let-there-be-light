import { create } from 'zustand'
import type {
  AttributeBundle,
  FixtureId,
  InstanceStatus,
  ServerMessage,
  CompileError,
  GraphId,
} from '@let-there-be-light/shared'
import { wsClient } from '@/ws/connection'
import { queryClient } from '@/lib/queryClient'
import {
  showSuccess,
  showError,
  getPendingToggle,
  setPendingToggle,
} from './status'

interface RuntimeState {
  // Connection status
  isConnected: boolean

  // Runtime status
  tickHz: number
  currentTime: number
  instances: InstanceStatus[]

  // Frame data
  fixtureValues: Record<FixtureId, AttributeBundle>

  // Compile results cache
  compileResults: Record<
    GraphId,
    { ok: boolean; errors: CompileError[] }
  >

  // Input state (local)
  faders: Record<string, number>
  buttonsDown: Record<string, boolean>

  // Actions
  setFader: (faderId: string, value: number) => void
  buttonDown: (buttonId: string) => void
  buttonUp: (buttonId: string) => void
  buttonPress: (buttonId: string) => void
  subscribeFrames: (mode: 'full' | 'delta', fixtureIds?: FixtureId[]) => void
  unsubscribeFrames: () => void
  setInstanceEnabled: (instanceId: string, enabled: boolean) => void
}

export const useRuntimeStore = create<RuntimeState>((set, get) => {
  // Set up WebSocket message handler
  wsClient.onMessage((message: ServerMessage) => {
    switch (message.type) {
      case 'runtime/status': {
        // Check for pending toggle confirmation
        const pendingToggle = getPendingToggle()
        if (pendingToggle) {
          const instance = message.instances.find(
            (i) => i.graphId === pendingToggle.graphId
          )
          if (instance && instance.enabled === pendingToggle.targetEnabled) {
            const action = pendingToggle.targetEnabled ? 'on' : 'off'
            showSuccess(`${pendingToggle.graphName} turned ${action}`)
            setPendingToggle(null)
          }
        }

        set({
          tickHz: message.tickHz,
          currentTime: message.t,
          instances: message.instances,
        })
        break
      }

      case 'frame/full':
        set({ fixtureValues: message.fixtures })
        break

      case 'frame/delta':
        set((state) => {
          const newValues = { ...state.fixtureValues }
          for (const [fixtureId, changes] of Object.entries(message.changes)) {
            newValues[fixtureId] = {
              ...newValues[fixtureId],
              ...changes,
            }
          }
          return { fixtureValues: newValues }
        })
        break

      case 'compile/result':
        set((state) => ({
          compileResults: {
            ...state.compileResults,
            [message.graphId]: {
              ok: message.ok,
              errors: message.errors,
            },
          },
        }))
        break

      case 'error':
        console.error('WebSocket error:', message.message, message.code)
        showError(message.message)
        break

      case 'show/changed':
        // Show was changed, invalidate all cached data
        console.log('Show changed to:', message.show)
        queryClient.invalidateQueries()
        // Clear local runtime state
        set({
          fixtureValues: {},
          compileResults: {},
          instances: [],
        })
        break
    }
  })

  wsClient.onConnect(() => set({ isConnected: true }))
  wsClient.onDisconnect(() => set({ isConnected: false }))

  return {
    // Initial state
    isConnected: false,
    tickHz: 0,
    currentTime: 0,
    instances: [],
    fixtureValues: {},
    compileResults: {},
    faders: {},
    buttonsDown: {},

    // Actions
    setFader: (faderId, value) => {
      set((state) => ({
        faders: { ...state.faders, [faderId]: value },
      }))
      wsClient.send({ type: 'input/fader', faderId, value })
    },

    buttonDown: (buttonId) => {
      set((state) => ({
        buttonsDown: { ...state.buttonsDown, [buttonId]: true },
      }))
      wsClient.send({ type: 'input/buttonDown', buttonId })
    },

    buttonUp: (buttonId) => {
      set((state) => ({
        buttonsDown: { ...state.buttonsDown, [buttonId]: false },
      }))
      wsClient.send({ type: 'input/buttonUp', buttonId })
    },

    buttonPress: (buttonId) => {
      wsClient.send({ type: 'input/buttonPress', buttonId })
    },

    subscribeFrames: (mode, fixtureIds) => {
      wsClient.send({ type: 'runtime/subscribeFrames', mode, fixtureIds })
    },

    unsubscribeFrames: () => {
      wsClient.send({ type: 'runtime/unsubscribeFrames' })
    },

    setInstanceEnabled: (instanceId, enabled) => {
      wsClient.send({ type: 'instance/setEnabled', instanceId, enabled })
    },
  }
})
