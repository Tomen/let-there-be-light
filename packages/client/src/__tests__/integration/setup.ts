import { spawn, type ChildProcess } from 'child_process'
import { rmSync, existsSync } from 'fs'
import { join } from 'path'
import type { ApiResponse, ApiError } from '@let-there-be-light/shared'
import WebSocket from 'ws'

// Configuration
const SPAWN_SERVER = process.env.SPAWN_SERVER === 'true'
// Use port based on process ID to avoid conflicts between consecutive test runs
const TEST_PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT) : 3090 + (process.pid % 100)
const BASE_URL = `http://localhost:${TEST_PORT}`
const WS_URL = `ws://localhost:${TEST_PORT}/ws`
const TEST_DATA_DIR = join(process.cwd(), '..', 'server', `integration-test-data-${process.pid}`)

let serverProcess: ChildProcess | null = null

/**
 * Wait for server to be healthy
 */
async function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Server did not become healthy within ${timeoutMs}ms`)
}

/**
 * Check if server is running
 */
async function checkServer(url: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Clean test data directory
 */
function cleanTestData(): void {
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true })
  }
}

/**
 * Start test server (call in beforeAll)
 */
export async function startTestServer(): Promise<void> {
  if (SPAWN_SERVER) {
    console.log('Spawning server for integration tests...')
    cleanTestData()

    serverProcess = spawn('pnpm', ['--filter', '@let-there-be-light/server', 'dev'], {
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        DATA_DIR: TEST_DATA_DIR,
      },
      shell: true,
      stdio: 'pipe',
    })

    serverProcess.stdout?.on('data', (data) => {
      if (process.env.DEBUG) {
        console.log(`[server] ${data}`)
      }
    })

    serverProcess.stderr?.on('data', (data) => {
      if (process.env.DEBUG) {
        console.error(`[server] ${data}`)
      }
    })

    await waitForServer(`${BASE_URL}/api/health`)
    // Give the server a moment to fully initialize WebSocket handler
    await new Promise((resolve) => setTimeout(resolve, 500))
    console.log('Server is ready')
  } else {
    const healthy = await checkServer(`${BASE_URL}/api/health`)
    if (!healthy) {
      throw new Error(
        `Server not running at ${BASE_URL}.\n` +
          `Start with: pnpm --filter @let-there-be-light/server dev\n` +
          `Or run with SPAWN_SERVER=true to auto-spawn.`
      )
    }
    console.log('Using existing server')
  }
}

/**
 * Stop test server (call in afterAll)
 */
export async function stopTestServer(): Promise<void> {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
    cleanTestData()
    console.log('Server stopped and test data cleaned')
  }
}

/**
 * API client for integration tests
 */
export const api = {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${BASE_URL}/api${path}`)
    return handleResponse<T>(response)
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${BASE_URL}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return handleResponse<T>(response)
  },

  async put<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${BASE_URL}/api${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return handleResponse<T>(response)
  },

  async delete(path: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/api${path}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as ApiError | null
      throw new ApiTestError(response.status, error?.code ?? 'UNKNOWN', error?.error ?? 'Request failed')
    }
  },

  async getRaw(path: string): Promise<Response> {
    return fetch(`${BASE_URL}/api${path}`)
  },
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiError | null
    throw new ApiTestError(response.status, error?.code ?? 'UNKNOWN', error?.error ?? 'Request failed')
  }
  const json = await response.json()
  // Some endpoints wrap in { data: ... }, others return directly
  if ('data' in json) {
    return (json as ApiResponse<T>).data
  }
  return json as T
}

export class ApiTestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiTestError'
  }
}

/**
 * Create a WebSocket connection for testing with retry logic
 */
export async function createWsClient(retries = 3): Promise<TestWsClient> {
  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    try {
      return await new Promise<TestWsClient>((resolve, reject) => {
        const ws = new WebSocket(WS_URL)
        const client = new TestWsClient(ws)

        const timeout = setTimeout(() => {
          ws.close()
          reject(new Error('WebSocket connection timeout'))
        }, 5000)

        ws.on('open', () => {
          clearTimeout(timeout)
          resolve(client)
        })

        ws.on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    } catch (err) {
      lastError = err as Error
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  throw lastError ?? new Error('WebSocket connection failed')
}

export class TestWsClient {
  private messageQueue: unknown[] = []
  private waitResolvers: Array<(msg: unknown) => void> = []

  constructor(private ws: WebSocket) {
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (this.waitResolvers.length > 0) {
        const resolver = this.waitResolvers.shift()!
        resolver(message)
      } else {
        this.messageQueue.push(message)
      }
    })
  }

  send(message: unknown): void {
    this.ws.send(JSON.stringify(message))
  }

  async waitForMessage<T = unknown>(timeoutMs = 5000): Promise<T> {
    if (this.messageQueue.length > 0) {
      return this.messageQueue.shift() as T
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitResolvers.indexOf(resolver)
        if (index > -1) this.waitResolvers.splice(index, 1)
        reject(new Error('Timeout waiting for WebSocket message'))
      }, timeoutMs)

      const resolver = (msg: unknown) => {
        clearTimeout(timeout)
        resolve(msg as T)
      }

      this.waitResolvers.push(resolver)
    })
  }

  async waitForMessageOfType<T = unknown>(type: string, timeoutMs = 5000): Promise<T> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const msg = await this.waitForMessage<{ type: string }>(timeoutMs - (Date.now() - start))
      if (msg.type === type) {
        return msg as T
      }
    }
    throw new Error(`Timeout waiting for message of type: ${type}`)
  }

  close(): void {
    this.ws.close()
  }

  get readyState(): number {
    return this.ws.readyState
  }
}

// Export constants for tests
export { BASE_URL, WS_URL, TEST_PORT }
