import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Fixture, FixtureModel, CreateRequest, UpdateRequest } from '@let-there-be-light/shared'
import { api } from './client'

export const fixtureKeys = {
  all: ['fixtures'] as const,
  lists: () => [...fixtureKeys.all, 'list'] as const,
  list: () => [...fixtureKeys.lists()] as const,
  details: () => [...fixtureKeys.all, 'detail'] as const,
  detail: (id: string) => [...fixtureKeys.details(), id] as const,
  models: () => [...fixtureKeys.all, 'models'] as const,
}

// Queries
export function useFixtures() {
  return useQuery({
    queryKey: fixtureKeys.list(),
    queryFn: () => api.get<Fixture[]>('/fixtures'),
  })
}

export function useFixture(id: string) {
  return useQuery({
    queryKey: fixtureKeys.detail(id),
    queryFn: () => api.get<Fixture>(`/fixtures/${id}`),
    enabled: !!id,
  })
}

export function useFixtureModels() {
  return useQuery({
    queryKey: fixtureKeys.models(),
    queryFn: () => api.get<FixtureModel[]>('/fixtures/models'),
  })
}

// Mutations
export function useCreateFixture() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRequest<Fixture>) =>
      api.post<Fixture>('/fixtures', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fixtureKeys.lists() })
    },
  })
}

export function useUpdateFixture() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...update }: { id: string } & UpdateRequest<Fixture>) =>
      api.put<Fixture>(`/fixtures/${id}`, update),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: fixtureKeys.lists() })
      queryClient.setQueryData(fixtureKeys.detail(data.id), data)
    },
  })
}

export function useDeleteFixture() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/fixtures/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fixtureKeys.lists() })
    },
  })
}
