import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, ApiClientError } from '../client'

describe('api client', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
  })

  describe('api.get', () => {
    it('makes GET request and returns data', async () => {
      const mockData = { id: '1', name: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      })

      const result = await api.get<typeof mockData>('/test')

      expect(mockFetch).toHaveBeenCalledWith('/api/test')
      expect(result).toEqual(mockData)
    })

    it('throws ApiClientError on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found', code: 'NOT_FOUND' }),
      })

      await expect(api.get('/test')).rejects.toThrow(ApiClientError)
      await expect(api.get('/test')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Not found',
      })
    })

    it('handles non-JSON error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON') },
      })

      await expect(api.get('/test')).rejects.toThrow(ApiClientError)
      await expect(api.get('/test')).rejects.toMatchObject({
        code: 'UNKNOWN_ERROR',
        message: 'HTTP 500',
      })
    })
  })

  describe('api.post', () => {
    it('makes POST request with body', async () => {
      const mockData = { id: '1', name: 'created' }
      const body = { name: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      })

      const result = await api.post<typeof mockData>('/test', body)

      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      expect(result).toEqual(mockData)
    })
  })

  describe('api.put', () => {
    it('makes PUT request with body', async () => {
      const mockData = { id: '1', name: 'updated' }
      const body = { data: { name: 'updated' }, revision: 1 }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      })

      const result = await api.put<typeof mockData>('/test/1', body)

      expect(mockFetch).toHaveBeenCalledWith('/api/test/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      expect(result).toEqual(mockData)
    })

    it('throws on revision conflict', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Revision mismatch', code: 'CONFLICT' }),
      })

      await expect(api.put('/test/1', {})).rejects.toMatchObject({
        code: 'CONFLICT',
      })
    })
  })

  describe('api.delete', () => {
    it('makes DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      })

      await api.delete('/test/1')

      expect(mockFetch).toHaveBeenCalledWith('/api/test/1', {
        method: 'DELETE',
      })
    })
  })
})

describe('ApiClientError', () => {
  it('has correct properties', () => {
    const error = new ApiClientError('TEST_CODE', 'Test message', { extra: 'data' })

    expect(error.name).toBe('ApiClientError')
    expect(error.code).toBe('TEST_CODE')
    expect(error.message).toBe('Test message')
    expect(error.details).toEqual({ extra: 'data' })
  })

  it('is instanceof Error', () => {
    const error = new ApiClientError('CODE', 'message')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ApiClientError)
  })
})
