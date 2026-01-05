import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '../Layout'

// Mock the runtime store
vi.mock('@/stores/runtime', () => ({
  useRuntimeStore: vi.fn((selector) => {
    const state = { isConnected: false }
    return selector(state)
  }),
}))

// Create a QueryClient for tests
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderLayout = (initialPath = '/') => {
    const queryClient = createTestQueryClient()
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Layout />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders the app title', () => {
    renderLayout()
    expect(screen.getByText('Let There Be Light')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    renderLayout()

    expect(screen.getByRole('link', { name: /patch/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /graphs/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /runtime/i })).toBeInTheDocument()
  })

  it('shows disconnected status when not connected', async () => {
    renderLayout()
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('shows connected status when connected', async () => {
    const { useRuntimeStore } = await import('@/stores/runtime')
    vi.mocked(useRuntimeStore).mockImplementation((selector) => {
      const state = { isConnected: true }
      return selector(state)
    })

    renderLayout()
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('highlights active navigation link', () => {
    renderLayout('/patch')

    const patchLink = screen.getByRole('link', { name: /patch/i })
    expect(patchLink).toHaveClass('bg-secondary')
  })

  it('renders navigation with correct hrefs', () => {
    renderLayout()

    expect(screen.getByRole('link', { name: /patch/i })).toHaveAttribute('href', '/patch')
    expect(screen.getByRole('link', { name: /graphs/i })).toHaveAttribute('href', '/graphs')
    expect(screen.getByRole('link', { name: /runtime/i })).toHaveAttribute('href', '/runtime')
  })
})
