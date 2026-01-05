import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NodeInspector } from '../NodeInspector'
import type { GraphNode } from '@let-there-be-light/shared'

// Mock the API hooks
vi.mock('@/api', () => ({
  useFaders: () => ({ data: [], isLoading: false }),
  useButtons: () => ({ data: [], isLoading: false }),
  useGroups: () => ({ data: [], isLoading: false }),
  useFixtures: () => ({ data: [], isLoading: false }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('NodeInspector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no node selected', () => {
    render(<NodeInspector node={null} edges={[]} onParamChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Select a node to edit')).toBeInTheDocument()
  })

  it('shows node info when selected', () => {
    const node: GraphNode = {
      id: 'fader-123',
      type: 'Fader',
      position: { x: 0, y: 0 },
      params: { faderId: 'A' },
    }

    render(<NodeInspector node={node} edges={[]} onParamChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Fader')).toBeInTheDocument()
    expect(screen.getByText('fader-123')).toBeInTheDocument()
  })

  it('shows input and output ports', () => {
    const node: GraphNode = {
      id: 'add-123',
      type: 'Add',
      position: { x: 0, y: 0 },
      params: {},
    }

    render(<NodeInspector node={node} edges={[]} onParamChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('INPUTS')).toBeInTheDocument()
    expect(screen.getByText('OUTPUTS')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('Result')).toBeInTheDocument()
  })

  it('shows parameters section for nodes with params', () => {
    const node: GraphNode = {
      id: 'fader-123',
      type: 'Fader',
      position: { x: 0, y: 0 },
      params: { faderId: 'A' },
    }

    render(<NodeInspector node={node} edges={[]} onParamChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('PARAMETERS')).toBeInTheDocument()
    // With the new dropdown, we check for the "Fader ID" label
    expect(screen.getByText('Fader ID')).toBeInTheDocument()
  })

  it('shows unknown node type error', () => {
    const node: GraphNode = {
      id: 'unknown-123',
      type: 'InvalidType',
      position: { x: 0, y: 0 },
      params: {},
    }

    render(<NodeInspector node={node} edges={[]} onParamChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Unknown node type')).toBeInTheDocument()
  })
})
