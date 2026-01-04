import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startTestServer, stopTestServer, api, ApiTestError } from '../setup'
import type { Fixture, FixtureModel } from '@let-there-be-light/shared'

describe('Fixtures API', () => {
  beforeAll(async () => {
    await startTestServer()
  })

  afterAll(async () => {
    await stopTestServer()
  })

  describe('GET /fixtures', () => {
    it('returns array of fixtures', async () => {
      const fixtures = await api.get<Fixture[]>('/fixtures')

      expect(Array.isArray(fixtures)).toBe(true)
      expect(fixtures.length).toBeGreaterThan(0)
    })

    it('fixtures have correct shape', async () => {
      const fixtures = await api.get<Fixture[]>('/fixtures')
      const fixture = fixtures[0]

      expect(fixture).toHaveProperty('id')
      expect(fixture).toHaveProperty('revision')
      expect(fixture).toHaveProperty('name')
      expect(fixture).toHaveProperty('modelId')
      expect(fixture).toHaveProperty('universe')
      expect(fixture).toHaveProperty('startChannel')
    })
  })

  describe('GET /fixtures/:id', () => {
    it('returns single fixture', async () => {
      const fixtures = await api.get<Fixture[]>('/fixtures')
      const fixture = await api.get<Fixture>(`/fixtures/${fixtures[0].id}`)

      expect(fixture.id).toBe(fixtures[0].id)
      expect(fixture.name).toBe(fixtures[0].name)
    })

    it('returns 404 for unknown fixture', async () => {
      try {
        await api.get('/fixtures/unknown-fixture-id')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiTestError)
        expect((error as ApiTestError).status).toBe(404)
        expect((error as ApiTestError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('POST /fixtures', () => {
    it('creates a new fixture', async () => {
      const newFixture = {
        name: 'test-fixture',
        modelId: 'generic-rgbw',
        universe: 0,
        startChannel: 100,
      }

      const created = await api.post<Fixture>('/fixtures', newFixture)

      expect(created.id).toBeDefined()
      expect(created.revision).toBe(1)
      expect(created.name).toBe('test-fixture')
      expect(created.modelId).toBe('generic-rgbw')
      expect(created.universe).toBe(0)
      expect(created.startChannel).toBe(100)
    })

    it('created fixture appears in list', async () => {
      const newFixture = {
        name: 'test-fixture-list',
        modelId: 'generic-rgbw',
        universe: 0,
        startChannel: 200,
      }

      const created = await api.post<Fixture>('/fixtures', newFixture)
      const fixtures = await api.get<Fixture[]>('/fixtures')

      const found = fixtures.find((f) => f.id === created.id)
      expect(found).toBeDefined()
      expect(found?.name).toBe('test-fixture-list')
    })
  })

  describe('PUT /fixtures/:id', () => {
    it('updates fixture with correct revision', async () => {
      const created = await api.post<Fixture>('/fixtures', {
        name: 'update-test',
        modelId: 'generic-rgbw',
        universe: 0,
        startChannel: 300,
      })

      const updated = await api.put<Fixture>(`/fixtures/${created.id}`, {
        data: { name: 'updated-name' },
        revision: created.revision,
      })

      expect(updated.name).toBe('updated-name')
      expect(updated.revision).toBe(created.revision + 1)
    })

    it('returns 409 for wrong revision', async () => {
      const created = await api.post<Fixture>('/fixtures', {
        name: 'conflict-test',
        modelId: 'generic-rgbw',
        universe: 0,
        startChannel: 400,
      })

      try {
        await api.put(`/fixtures/${created.id}`, {
          data: { name: 'will-fail' },
          revision: 999, // Wrong revision
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiTestError)
        expect((error as ApiTestError).status).toBe(409)
        expect((error as ApiTestError).code).toBe('CONFLICT')
      }
    })

    it('returns 404 for unknown fixture', async () => {
      try {
        await api.put('/fixtures/unknown-id', {
          data: { name: 'will-fail' },
          revision: 1,
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiTestError)
        expect((error as ApiTestError).status).toBe(404)
      }
    })
  })

  describe('DELETE /fixtures/:id', () => {
    it('deletes fixture', async () => {
      const created = await api.post<Fixture>('/fixtures', {
        name: 'delete-test',
        modelId: 'generic-rgbw',
        universe: 0,
        startChannel: 500,
      })

      await api.delete(`/fixtures/${created.id}`)

      try {
        await api.get(`/fixtures/${created.id}`)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(404)
      }
    })

    it('returns 404 for unknown fixture', async () => {
      try {
        await api.delete('/fixtures/unknown-id')
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(404)
      }
    })
  })

  describe('GET /fixtures/models', () => {
    it('returns array of fixture models', async () => {
      const models = await api.get<FixtureModel[]>('/fixtures/models')

      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBeGreaterThan(0)
    })

    it('models have correct shape', async () => {
      const models = await api.get<FixtureModel[]>('/fixtures/models')
      const model = models[0]

      expect(model).toHaveProperty('id')
      expect(model).toHaveProperty('brand')
      expect(model).toHaveProperty('model')
      expect(model).toHaveProperty('channels')
      expect(typeof model.channels).toBe('object')
    })

    it('contains known models', async () => {
      const models = await api.get<FixtureModel[]>('/fixtures/models')
      const modelIds = models.map((m) => m.id)

      expect(modelIds).toContain('generic-rgbw')
      expect(modelIds).toContain('generic-rgb')
    })
  })
})
