import type { ClientMessage, ServerMessage } from '@let-there-be-light/shared'

type MessageHandler = (message: ServerMessage) => void
type ConnectionHandler = () => void

interface WebSocketClientOptions {
  url?: string
  reconnectDelay?: number
  maxReconnectDelay?: number
}

export class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectDelay: number
  private maxReconnectDelay: number
  private currentDelay: number
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private messageHandlers = new Set<MessageHandler>()
  private connectHandlers = new Set<ConnectionHandler>()
  private disconnectHandlers = new Set<ConnectionHandler>()
  private _isConnected = false

  constructor(options: WebSocketClientOptions = {}) {
    // In browser, use relative URL that goes through Vite proxy
    const defaultUrl =
      typeof window !== 'undefined'
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
        : 'ws://localhost:3001/ws'
    this.url = options.url ?? defaultUrl
    this.reconnectDelay = options.reconnectDelay ?? 1000
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30000
    this.currentDelay = this.reconnectDelay
  }

  get isConnected(): boolean {
    return this._isConnected
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      this._isConnected = true
      this.currentDelay = this.reconnectDelay
      this.connectHandlers.forEach((handler) => handler())
    }

    this.ws.onclose = () => {
      this._isConnected = false
      this.disconnectHandlers.forEach((handler) => handler())
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      // Error will trigger close event, which handles reconnection
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage
        this.messageHandlers.forEach((handler) => handler(message))
      } catch {
        console.error('Failed to parse WebSocket message:', event.data)
      }
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, message not sent:', message)
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler)
    return () => this.connectHandlers.delete(handler)
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler)
    return () => this.disconnectHandlers.delete(handler)
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      this.connect()
      // Exponential backoff
      this.currentDelay = Math.min(
        this.currentDelay * 2,
        this.maxReconnectDelay
      )
    }, this.currentDelay)
  }
}

// Singleton instance
export const wsClient = new WebSocketClient()
