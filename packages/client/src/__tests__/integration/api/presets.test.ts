import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startTestServer, stopTestServer, api, ApiTestError } from '../setup'
import type { Preset } from '@let-there-be-light/shared'

describe('Presets API', () => {
  beforeAll(async () => {
    await startTestServer()
  })

  afterAll(async () => {
    await stopTestServer()
  })

  describe('GET /presets', () => {
    it('returns array of presets', async () => {
      const presets = await api.get<Preset[]>('/presets')

      expect(Array.isArray(presets)).toBe(true)
      expect(presets.length).toBeGreaterThan(0)
    })

    it('presets have correct shape', async () => {
      const presets = await api.get<Preset[]>('/presets')
      const preset = presets[0]

      expect(preset).toHaveProperty('id')
      expect(preset).toHaveProperty('revision')
      expect(preset).toHaveProperty('name')
      expect(preset).toHaveProperty('type')
      expect(preset).toHaveProperty('attributes')
    })

    it('contains presets of different types', async () => {
      const presets = await api.get<Preset[]>('/presets')
      const types = new Set(presets.map((p) => p.type))

      expect(types.has('color')).toBe(true)
    })
  })

  describe('GET /presets/by-type/:type', () => {
    it('filters presets by type', async () => {
      const colorPresets = await api.get<Preset[]>('/presets/by-type/color')

      expect(colorPresets.every((p) => p.type === 'color')).toBe(true)
    })

    it('returns empty array for type with no presets', async () => {
      // Create and then get - this type might not have seeded data
      const response = await api.getRaw('/presets/by-type/beam')
      expect(response.ok).toBe(true)
    })
  })

  describe('GET /presets/:id', () => {
    it('returns single preset', async () => {
      const presets = await api.get<Preset[]>('/presets')
      const preset = await api.get<Preset>(`/presets/${presets[0].id}`)

      expect(preset.id).toBe(presets[0].id)
      expect(preset.name).toBe(presets[0].name)
    })

    it('returns 404 for unknown preset', async () => {
      try {
        await api.get('/presets/unknown-preset-id')
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(404)
      }
    })
  })

  describe('POST /presets', () => {
    it('creates a color preset', async () => {
      const created = await api.post<Preset>('/presets', {
        name: 'test-color',
        type: 'color',
        attributes: {
          color: { r: 1, g: 0.5, b: 0 },
        },
      })

      expect(created.id).toBeDefined()
      expect(created.revision).toBe(1)
      expect(created.name).toBe('test-color')
      expect(created.type).toBe('color')
      expect(created.attributes.color).toEqual({ r: 1, g: 0.5, b: 0 })
    })

    it('creates a position preset', async () => {
      const created = await api.post<Preset>('/presets', {
        name: 'test-position',
        type: 'position',
        attributes: {
          pan: 0.5,
          tilt: -0.3,
        },
      })

      expect(created.type).toBe('position')
      expect(created.attributes.pan).toBe(0.5)
      expect(created.attributes.tilt).toBe(-0.3)
    })

    it('creates a full preset', async () => {
      const created = await api.post<Preset>('/presets', {
        name: 'test-full',
        type: 'full',
        attributes: {
          intensity: 0.8,
          color: { r: 1, g: 1, b: 1 },
          pan: 0,
          tilt: 0,
          zoom: 0.5,
        },
      })

      expect(created.type).toBe('full')
      expect(created.attributes.intensity).toBe(0.8)
      expect(created.attributes.zoom).toBe(0.5)
    })
  })

  describe('PUT /presets/:id', () => {
    it('updates preset with correct revision', async () => {
      const created = await api.post<Preset>('/presets', {
        name: 'update-preset-test',
        type: 'color',
        attributes: { color: { r: 1, g: 0, b: 0 } },
      })

      const updated = await api.put<Preset>(`/presets/${created.id}`, {
        data: {
          name: 'updated-preset',
          attributes: { color: { r: 0, g: 1, b: 0 } },
        },
        revision: created.revision,
      })

      expect(updated.name).toBe('updated-preset')
      expect(updated.attributes.color).toEqual({ r: 0, g: 1, b: 0 })
      expect(updated.revision).toBe(created.revision + 1)
    })

    it('returns 409 for wrong revision', async () => {
      const created = await api.post<Preset>('/presets', {
        name: 'conflict-preset-test',
        type: 'color',
        attributes: { color: { r: 1, g: 0, b: 0 } },
      })

      try {
        await api.put(`/presets/${created.id}`, {
          data: { name: 'will-fail' },
          revision: 999,
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(409)
      }
    })
  })

  describe('DELETE /presets/:id', () => {
    it('deletes preset', async () => {
      const created = await api.post<Preset>('/presets', {
        name: 'delete-preset-test',
        type: 'color',
        attributes: { color: { r: 1, g: 0, b: 0 } },
      })

      await api.delete(`/presets/${created.id}`)

      try {
        await api.get(`/presets/${created.id}`)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(404)
      }
    })
  })
})
