import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Input, InputType, CreateRequest, UpdateRequest } from '@let-there-be-light/shared'
import { api } from './client'

interface InputUsage {
  inputId: string
  usedBy: Array<{ graphId: string; graphName: string }>
}

export const inputKeys = {
  all: ['inputs'] as const,
  lists: () => [...inputKeys.all, 'list'] as const,
  list: (type?: InputType) => [...inputKeys.lists(), { type }] as const,
  details: () => [...inputKeys.all, 'detail'] as const,
  detail: (id: string) => [...inputKeys.details(), id] as const,
  usage: (id: string) => [...inputKeys.all, 'usage', id] as const,
}

// Queries
export function useInputs(type?: InputType) {
  return useQuery({
    queryKey: inputKeys.list(type),
    queryFn: async () => {
      const inputs = await api.get<Input[]>('/inputs')
      if (type) {
        return inputs.filter((i) => i.type === type)
      }
      return inputs
    },
  })
}

export function useFaders() {
  return useQuery({
    queryKey: inputKeys.list('fader'),
    queryFn: () => api.get<Input[]>('/inputs/faders'),
  })
}

export function useButtons() {
  return useQuery({
    queryKey: inputKeys.list('button'),
    queryFn: () => api.get<Input[]>('/inputs/buttons'),
  })
}

export function useInput(id: string) {
  return useQuery({
    queryKey: inputKeys.detail(id),
    queryFn: () => api.get<Input>(`/inputs/${id}`),
    enabled: !!id,
  })
}

export function useInputUsage(id: string) {
  return useQuery({
    queryKey: inputKeys.usage(id),
    queryFn: () => api.get<InputUsage>(`/inputs/${id}/usage`),
    enabled: !!id,
  })
}

// Mutations
export function useCreateInput() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRequest<Input>) =>
      api.post<Input>('/inputs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inputKeys.lists() })
    },
  })
}

export function useUpdateInput() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...update }: { id: string } & UpdateRequest<Input>) =>
      api.put<Input>(`/inputs/${id}`, update),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inputKeys.lists() })
      queryClient.setQueryData(inputKeys.detail(data.id), data)
    },
  })
}

export function useDeleteInput() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/inputs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inputKeys.lists() })
    },
  })
}
