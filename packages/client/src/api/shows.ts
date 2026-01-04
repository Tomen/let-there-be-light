import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Show, CurrentShow } from '@let-there-be-light/shared'
import { api } from './client'

export const showKeys = {
  all: ['shows'] as const,
  list: () => [...showKeys.all, 'list'] as const,
  current: () => [...showKeys.all, 'current'] as const,
}

// Queries
export function useShows() {
  return useQuery({
    queryKey: showKeys.list(),
    queryFn: () => api.get<Show[]>('/shows'),
  })
}

export function useCurrentShow() {
  return useQuery({
    queryKey: showKeys.current(),
    queryFn: () => api.get<CurrentShow>('/shows/current'),
  })
}

// Mutations
export function useActivateShow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post<{ show: string }>(`/shows/${name}/activate`, {}),
    onSuccess: () => {
      // Invalidate everything - new show means all data changed
      queryClient.invalidateQueries()
    },
  })
}
