import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Graph, CreateRequest, UpdateRequest, CompileResult } from '@let-there-be-light/shared'
import { api } from './client'

export const graphKeys = {
  all: ['graphs'] as const,
  lists: () => [...graphKeys.all, 'list'] as const,
  list: () => [...graphKeys.lists()] as const,
  details: () => [...graphKeys.all, 'detail'] as const,
  detail: (id: string) => [...graphKeys.details(), id] as const,
  compile: (id: string) => [...graphKeys.all, 'compile', id] as const,
}

// Queries
export function useGraphs() {
  return useQuery({
    queryKey: graphKeys.list(),
    queryFn: () => api.get<Graph[]>('/graphs'),
  })
}

export function useGraph(id: string) {
  return useQuery({
    queryKey: graphKeys.detail(id),
    queryFn: () => api.get<Graph>(`/graphs/${id}`),
    enabled: !!id,
  })
}

// Mutations
export function useCreateGraph() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRequest<Graph>) =>
      api.post<Graph>('/graphs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: graphKeys.lists() })
    },
  })
}

export function useUpdateGraph() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...update }: { id: string } & UpdateRequest<Graph>) =>
      api.put<Graph>(`/graphs/${id}`, update),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: graphKeys.lists() })
      queryClient.setQueryData(graphKeys.detail(data.id), data)
    },
  })
}

export function useDeleteGraph() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/graphs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: graphKeys.lists() })
    },
  })
}

export function useCompileGraph() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<CompileResult>(`/graphs/${id}/compile`, {}),
  })
}
