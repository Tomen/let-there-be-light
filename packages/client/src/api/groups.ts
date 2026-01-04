import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Group, CreateRequest, UpdateRequest } from '@let-there-be-light/shared'
import { api } from './client'

export const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  list: () => [...groupKeys.lists()] as const,
  details: () => [...groupKeys.all, 'detail'] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
}

// Queries
export function useGroups() {
  return useQuery({
    queryKey: groupKeys.list(),
    queryFn: () => api.get<Group[]>('/groups'),
  })
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: () => api.get<Group>(`/groups/${id}`),
    enabled: !!id,
  })
}

// Mutations
export function useCreateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRequest<Group>) =>
      api.post<Group>('/groups', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() })
    },
  })
}

export function useUpdateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...update }: { id: string } & UpdateRequest<Group>) =>
      api.put<Group>(`/groups/${id}`, update),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() })
      queryClient.setQueryData(groupKeys.detail(data.id), data)
    },
  })
}

export function useDeleteGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() })
    },
  })
}
