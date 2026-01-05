import { create } from 'zustand'

export type StatusType = 'info' | 'success' | 'warning' | 'error'

export interface StatusMessage {
  id: string
  type: StatusType
  message: string
  persistent?: boolean
}

export interface PendingToggle {
  graphId: string
  graphName: string
  targetEnabled: boolean
}

interface StatusState {
  currentMessage: StatusMessage | null
  pendingToggle: PendingToggle | null

  showStatus: (
    type: StatusType,
    message: string,
    options?: { persistent?: boolean }
  ) => void
  clearStatus: () => void
  setPendingToggle: (toggle: PendingToggle | null) => void
}

let messageCounter = 0

export const useStatusStore = create<StatusState>((set) => ({
  currentMessage: null,
  pendingToggle: null,

  showStatus: (type, message, options = {}) => {
    const id = `status-${++messageCounter}`
    set({
      currentMessage: {
        id,
        type,
        message,
        persistent: options.persistent ?? type === 'error',
      },
    })
  },

  clearStatus: () => {
    set({ currentMessage: null })
  },

  setPendingToggle: (toggle) => {
    set({ pendingToggle: toggle })
  },
}))

// Convenience helpers
export const showStatus = (
  type: StatusType,
  message: string,
  options?: { persistent?: boolean }
) => {
  useStatusStore.getState().showStatus(type, message, options)
}

export const showInfo = (message: string) => showStatus('info', message)
export const showSuccess = (message: string) => showStatus('success', message)
export const showWarning = (message: string) => showStatus('warning', message)
export const showError = (message: string) =>
  showStatus('error', message, { persistent: true })
export const clearStatus = () => useStatusStore.getState().clearStatus()

export const setPendingToggle = (toggle: PendingToggle | null) => {
  useStatusStore.getState().setPendingToggle(toggle)
}

export const getPendingToggle = () => useStatusStore.getState().pendingToggle
