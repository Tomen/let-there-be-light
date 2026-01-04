import type { ApiResponse, ApiError } from '@let-there-be-light/shared'

const API_BASE = '/api'

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiError | null
    throw new ApiClientError(
      errorBody?.code ?? 'UNKNOWN_ERROR',
      errorBody?.error ?? `HTTP ${response.status}`,
      errorBody?.details
    )
  }
  const data = (await response.json()) as ApiResponse<T>
  return data.data
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`)
    return handleResponse<T>(response)
  },

  async post<T, B = unknown>(path: string, body: B): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return handleResponse<T>(response)
  },

  async put<T, B = unknown>(path: string, body: B): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return handleResponse<T>(response)
  },

  async delete<T = void>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
    })
    return handleResponse<T>(response)
  },
}
