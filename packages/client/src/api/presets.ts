import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Preset, PresetType, CreateRequest, UpdateRequest } from '@let-there-be-light/shared'
import { api } from './client'

export const presetKeys = {
  all: ['presets'] as const,
  lists: () => [...presetKeys.all, 'list'] as const,
  list: (type?: PresetType) => [...presetKeys.lists(), { type }] as const,
  details: () => [...presetKeys.all, 'detail'] as const,
  detail: (id: string) => [...presetKeys.details(), id] as const,
}

// Queries
export function usePresets(type?: PresetType) {
  return useQuery({
    queryKey: presetKeys.list(type),
    queryFn: async () => {
      const presets = await api.get<Preset[]>('/presets')
      if (type) {
        return presets.filter((p) => p.type === type)
      }
      return presets
    },
  })
}

export function usePreset(id: string) {
  return useQuery({
    queryKey: presetKeys.detail(id),
    queryFn: () => api.get<Preset>(`/presets/${id}`),
    enabled: !!id,
  })
}

// Mutations
export function useCreatePreset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRequest<Preset>) =>
      api.post<Preset>('/presets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: presetKeys.lists() })
    },
  })
}

export function useUpdatePreset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...update }: { id: string } & UpdateRequest<Preset>) =>
      api.put<Preset>(`/presets/${id}`, update),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: presetKeys.lists() })
      queryClient.setQueryData(presetKeys.detail(data.id), data)
    },
  })
}

export function useDeletePreset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/presets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: presetKeys.lists() })
    },
  })
}
