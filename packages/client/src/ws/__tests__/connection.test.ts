import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketClient } from '../connection'

// Create a proper WebSocket mock class
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null

  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
  })

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  simulateError() {
    this.onerror?.()
  }
}

describe('WebSocketClient', () => {
  let mockWs: MockWebSocket
  let wsClient: WebSocketClient
  let WebSocketConstructor: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockWs = new MockWebSocket()

    // Create a constructor mock that returns our mockWs
    WebSocketConstructor = vi.fn(() => mockWs)
    // Copy static properties
    Object.assign(WebSocketConstructor, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    })

    vi.stubGlobal('WebSocket', WebSocketConstructor)
    wsClient = new WebSocketClient({ url: 'ws://test:3001/ws' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('connect', () => {
    it('creates WebSocket connection', () => {
      wsClient.connect()

      expect(WebSocketConstructor).toHaveBeenCalledWith('ws://test:3001/ws')
    })

    it('sets isConnected to true on open', () => {
      wsClient.connect()

      expect(wsClient.isConnected).toBe(false)
      mockWs.simulateOpen()
      expect(wsClient.isConnected).toBe(true)
    })

    it('calls onConnect handlers', () => {
      const handler = vi.fn()
      wsClient.onConnect(handler)
      wsClient.connect()
      mockWs.simulateOpen()

      expect(handler).toHaveBeenCalled()
    })

    it('does not reconnect if already connected', () => {
      wsClient.connect()
      mockWs.simulateOpen()

      wsClient.connect()

      expect(WebSocketConstructor).toHaveBeenCalledTimes(1)
    })
  })

  describe('disconnect', () => {
    it('closes WebSocket', () => {
      wsClient.connect()
      wsClient.disconnect()

      expect(mockWs.close).toHaveBeenCalled()
    })

    it('clears reconnect timeout', () => {
      wsClient.connect()
      mockWs.simulateClose()

      // Reconnect scheduled - disconnect should clear it
      wsClient.disconnect()
      vi.advanceTimersByTime(10000)

      // Should only have been called once (initial connect)
      // The reconnect should have been cancelled
      expect(WebSocketConstructor).toHaveBeenCalledTimes(1)
    })
  })

  describe('send', () => {
    it('sends message when connected', () => {
      wsClient.connect()
      mockWs.simulateOpen()

      const message = { type: 'input/fader', faderId: 'A', value: 0.5 } as const
      wsClient.send(message)

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message))
    })

    it('does not send when disconnected', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      wsClient.connect()

      wsClient.send({ type: 'input/fader', faderId: 'A', value: 0.5 })

      expect(mockWs.send).not.toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('message handling', () => {
    it('calls message handlers with parsed data', () => {
      const handler = vi.fn()
      wsClient.onMessage(handler)
      wsClient.connect()
      mockWs.simulateOpen()

      const message = { type: 'runtime/status', tickHz: 60, t: 0, instances: [] }
      mockWs.simulateMessage(message)

      expect(handler).toHaveBeenCalledWith(message)
    })

    it('unsubscribes message handler', () => {
      const handler = vi.fn()
      const unsubscribe = wsClient.onMessage(handler)
      wsClient.connect()
      mockWs.simulateOpen()

      unsubscribe()

      mockWs.simulateMessage({ type: 'runtime/status' })
      expect(handler).not.toHaveBeenCalled()
    })

    it('handles invalid JSON gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      wsClient.connect()
      mockWs.simulateOpen()

      mockWs.onmessage?.({ data: 'not json' })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('reconnection', () => {
    it('schedules reconnect on close', () => {
      wsClient.connect()
      mockWs.simulateOpen()

      // Create a new mock for the reconnect attempt
      const secondMockWs = new MockWebSocket()
      WebSocketConstructor.mockReturnValueOnce(secondMockWs)

      mockWs.simulateClose()

      expect(wsClient.isConnected).toBe(false)

      vi.advanceTimersByTime(1000)

      expect(WebSocketConstructor).toHaveBeenCalledTimes(2)
    })

    it('uses exponential backoff', () => {
      wsClient.connect()

      // First disconnect
      const secondMockWs = new MockWebSocket()
      WebSocketConstructor.mockReturnValueOnce(secondMockWs)
      mockWs.simulateClose()
      vi.advanceTimersByTime(1000)
      expect(WebSocketConstructor).toHaveBeenCalledTimes(2)

      // Second disconnect - delay should be 2000ms now
      const thirdMockWs = new MockWebSocket()
      WebSocketConstructor.mockReturnValueOnce(thirdMockWs)
      secondMockWs.simulateClose()

      vi.advanceTimersByTime(1000) // Not enough
      expect(WebSocketConstructor).toHaveBeenCalledTimes(2) // Still 2

      vi.advanceTimersByTime(1000) // Now 2000ms total
      expect(WebSocketConstructor).toHaveBeenCalledTimes(3)
    })

    it('calls onDisconnect handlers', () => {
      const handler = vi.fn()
      wsClient.onDisconnect(handler)
      wsClient.connect()
      mockWs.simulateOpen()
      mockWs.simulateClose()

      expect(handler).toHaveBeenCalled()
    })
  })
})
