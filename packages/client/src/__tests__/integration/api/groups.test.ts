import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startTestServer, stopTestServer, api, ApiTestError } from '../setup'
import type { Group, Fixture } from '@let-there-be-light/shared'

describe('Groups API', () => {
  beforeAll(async () => {
    await startTestServer()
  })

  afterAll(async () => {
    await stopTestServer()
  })

  describe('GET /groups', () => {
    it('returns array of groups', async () => {
      const groups = await api.get<Group[]>('/groups')

      expect(Array.isArray(groups)).toBe(true)
      expect(groups.length).toBeGreaterThan(0)
    })

    it('groups have correct shape', async () => {
      const groups = await api.get<Group[]>('/groups')
      const group = groups[0]

      expect(group).toHaveProperty('id')
      expect(group).toHaveProperty('revision')
      expect(group).toHaveProperty('name')
      expect(group).toHaveProperty('fixtureIds')
      expect(Array.isArray(group.fixtureIds)).toBe(true)
    })
  })

  describe('GET /groups/:id', () => {
    it('returns single group', async () => {
      const groups = await api.get<Group[]>('/groups')
      const group = await api.get<Group>(`/groups/${groups[0].id}`)

      expect(group.id).toBe(groups[0].id)
      expect(group.name).toBe(groups[0].name)
    })

    it('returns 404 for unknown group', async () => {
      try {
        await api.get('/groups/unknown-group-id')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiTestError)
        expect((error as ApiTestError).status).toBe(404)
      }
    })
  })

  describe('POST /groups', () => {
    it('creates a new group', async () => {
      const fixtures = await api.get<Fixture[]>('/fixtures')
      const fixtureIds = fixtures.slice(0, 2).map((f) => f.id)

      const created = await api.post<Group>('/groups', {
        name: 'test-group',
        fixtureIds,
      })

      expect(created.id).toBeDefined()
      expect(created.revision).toBe(1)
      expect(created.name).toBe('test-group')
      expect(created.fixtureIds).toEqual(fixtureIds)
    })

    it('creates group with empty fixture list', async () => {
      const created = await api.post<Group>('/groups', {
        name: 'empty-group',
        fixtureIds: [],
      })

      expect(created.fixtureIds).toEqual([])
    })
  })

  describe('PUT /groups/:id', () => {
    it('updates group with correct revision', async () => {
      const created = await api.post<Group>('/groups', {
        name: 'update-group-test',
        fixtureIds: [],
      })

      const updated = await api.put<Group>(`/groups/${created.id}`, {
        data: { name: 'updated-group-name' },
        revision: created.revision,
      })

      expect(updated.name).toBe('updated-group-name')
      expect(updated.revision).toBe(created.revision + 1)
    })

    it('updates fixture IDs', async () => {
      const fixtures = await api.get<Fixture[]>('/fixtures')
      const created = await api.post<Group>('/groups', {
        name: 'fixture-update-test',
        fixtureIds: [],
      })

      const updated = await api.put<Group>(`/groups/${created.id}`, {
        data: { fixtureIds: [fixtures[0].id] },
        revision: created.revision,
      })

      expect(updated.fixtureIds).toContain(fixtures[0].id)
    })

    it('returns 409 for wrong revision', async () => {
      const created = await api.post<Group>('/groups', {
        name: 'conflict-group-test',
        fixtureIds: [],
      })

      try {
        await api.put(`/groups/${created.id}`, {
          data: { name: 'will-fail' },
          revision: 999,
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(409)
      }
    })
  })

  describe('DELETE /groups/:id', () => {
    it('deletes group', async () => {
      const created = await api.post<Group>('/groups', {
        name: 'delete-group-test',
        fixtureIds: [],
      })

      await api.delete(`/groups/${created.id}`)

      try {
        await api.get(`/groups/${created.id}`)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as ApiTestError).status).toBe(404)
      }
    })
  })
})
