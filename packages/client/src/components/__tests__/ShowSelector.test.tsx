import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShowSelector } from '../ShowSelector'

// Mock the API hooks
vi.mock('@/api/shows', () => ({
  useShows: vi.fn(),
  useCurrentShow: vi.fn(),
  useActivateShow: vi.fn(),
}))

import { useShows, useCurrentShow, useActivateShow } from '@/api/shows'

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

describe('ShowSelector', () => {
  const mockMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    vi.mocked(useShows).mockReturnValue({
      data: [
        { id: 'default', name: 'default', isActive: true },
        { id: 'sunday-service', name: 'sunday-service', isActive: false },
      ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useShows>)

    vi.mocked(useCurrentShow).mockReturnValue({
      data: { show: 'default', dataDir: '/data/default' },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCurrentShow>)

    vi.mocked(useActivateShow).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useActivateShow>)
  })

  const renderShowSelector = () => {
    const queryClient = createTestQueryClient()
    return render(
      <QueryClientProvider client={queryClient}>
        <ShowSelector />
      </QueryClientProvider>
    )
  }

  it('renders the show selector', () => {
    renderShowSelector()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('displays current show value', () => {
    renderShowSelector()
    expect(screen.getByText('default')).toBeInTheDocument()
  })

  it('calls hooks with correct parameters', () => {
    renderShowSelector()

    expect(useShows).toHaveBeenCalled()
    expect(useCurrentShow).toHaveBeenCalled()
    expect(useActivateShow).toHaveBeenCalled()
  })

  it('disables selector while mutation is pending', () => {
    vi.mocked(useActivateShow).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    } as unknown as ReturnType<typeof useActivateShow>)

    renderShowSelector()

    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('renders with empty shows list', () => {
    vi.mocked(useShows).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useShows>)

    renderShowSelector()

    // Should still render the selector
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders with undefined current show', () => {
    vi.mocked(useCurrentShow).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useCurrentShow>)

    renderShowSelector()

    // Should still render the selector
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
