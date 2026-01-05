import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActiveGraphsList } from '../ActiveGraphsList'
import type { InstanceStatus, Graph, Fixture } from '@let-there-be-light/shared'

// Mock the API hooks
vi.mock('@/api', () => ({
  useGraphs: vi.fn(),
  useFixtures: vi.fn(),
}))

// Mock the runtime store
vi.mock('@/stores/runtime', () => ({
  useRuntimeStore: vi.fn(),
}))

import { useGraphs, useFixtures } from '@/api'
import { useRuntimeStore } from '@/stores/runtime'

const mockUseGraphs = vi.mocked(useGraphs)
const mockUseFixtures = vi.mocked(useFixtures)
const mockUseRuntimeStore = vi.mocked(useRuntimeStore)

describe('ActiveGraphsList', () => {
  const mockGraphs: Graph[] = [
    {
      id: 'graph-1',
      revision: 1,
      name: 'Rainbow Effect',
      nodes: [],
      edges: [],
      enabled: true,
    },
    {
      id: 'graph-2',
      revision: 1,
      name: 'Chase Pattern',
      nodes: [],
      edges: [],
      enabled: false,
    },
  ]

  const mockFixtures: Fixture[] = [
    {
      id: 'fix1',
      revision: 1,
      name: 'Front Left',
      modelId: 'generic-dimmer',
      address: { universe: 0, channel: 1 },
    },
    {
      id: 'fix2',
      revision: 1,
      name: 'Front Right',
      modelId: 'generic-dimmer',
      address: { universe: 0, channel: 2 },
    },
    {
      id: 'fix3',
      revision: 1,
      name: 'Back Center',
      modelId: 'generic-dimmer',
      address: { universe: 0, channel: 3 },
    },
  ]

  beforeEach(() => {
    mockUseGraphs.mockReturnValue({
      data: mockGraphs,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGraphs>)

    mockUseFixtures.mockReturnValue({
      data: mockFixtures,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useFixtures>)
  })

  it('shows no graphs message when instances is empty', () => {
    mockUseRuntimeStore.mockImplementation((selector) =>
      selector({ instances: [] } as unknown as Parameters<typeof selector>[0])
    )

    render(<ActiveGraphsList />)

    expect(screen.getByText('No graphs loaded')).toBeInTheDocument()
  })

  it('shows enabled graphs with green indicator', () => {
    const instances: InstanceStatus[] = [
      {
        id: 'graph-1',
        graphId: 'graph-1',
        enabled: true,
      },
    ]

    mockUseRuntimeStore.mockImplementation((selector) =>
      selector({ instances } as unknown as Parameters<typeof selector>[0])
    )

    render(<ActiveGraphsList />)

    expect(screen.getByText('Rainbow Effect')).toBeInTheDocument()
  })

  it('shows disabled graphs with muted style', () => {
    const instances: InstanceStatus[] = [
      {
        id: 'graph-2',
        graphId: 'graph-2',
        enabled: false,
      },
    ]

    mockUseRuntimeStore.mockImplementation((selector) =>
      selector({ instances } as unknown as Parameters<typeof selector>[0])
    )

    render(<ActiveGraphsList />)

    expect(screen.getByText('Chase Pattern')).toBeInTheDocument()
    expect(screen.getByText('(disabled)')).toBeInTheDocument()
  })

  it('shows error count when present', () => {
    const instances: InstanceStatus[] = [
      {
        id: 'graph-1',
        graphId: 'graph-1',
        enabled: true,
        errorCount: 3,
      },
    ]

    mockUseRuntimeStore.mockImplementation((selector) =>
      selector({ instances } as unknown as Parameters<typeof selector>[0])
    )

    render(<ActiveGraphsList />)

    expect(screen.getByText('(3 errors)')).toBeInTheDocument()
  })

  describe('WriteAttributes outputs table', () => {
    it('shows fixture names in table', () => {
      const instances: InstanceStatus[] = [
        {
          id: 'graph-1',
          graphId: 'graph-1',
          enabled: true,
          writes: [
            {
              nodeId: 'write-1',
              selection: ['fix1', 'fix2'],
              bundle: { color: { r: 1, g: 0, b: 0 } },
              priority: 0,
            },
          ],
        },
      ]

      mockUseRuntimeStore.mockImplementation((selector) =>
        selector({ instances } as unknown as Parameters<typeof selector>[0])
      )

      render(<ActiveGraphsList />)

      expect(screen.getByText('Front Left')).toBeInTheDocument()
      expect(screen.getByText('Front Right')).toBeInTheDocument()
    })

    it('shows intensity values as percentage', () => {
      const instances: InstanceStatus[] = [
        {
          id: 'graph-1',
          graphId: 'graph-1',
          enabled: true,
          writes: [
            {
              nodeId: 'write-1',
              selection: ['fix1'],
              bundle: { intensity: 0.75 },
              priority: 0,
            },
          ],
        },
      ]

      mockUseRuntimeStore.mockImplementation((selector) =>
        selector({ instances } as unknown as Parameters<typeof selector>[0])
      )

      render(<ActiveGraphsList />)

      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('shows table headers', () => {
      const instances: InstanceStatus[] = [
        {
          id: 'graph-1',
          graphId: 'graph-1',
          enabled: true,
          writes: [
            {
              nodeId: 'write-1',
              selection: ['fix1'],
              bundle: { intensity: 1 },
              priority: 0,
            },
          ],
        },
      ]

      mockUseRuntimeStore.mockImplementation((selector) =>
        selector({ instances } as unknown as Parameters<typeof selector>[0])
      )

      render(<ActiveGraphsList />)

      expect(screen.getByText('Fixture')).toBeInTheDocument()
      expect(screen.getByText('Intensity')).toBeInTheDocument()
      expect(screen.getByText('Color')).toBeInTheDocument()
      expect(screen.getByText('Pan')).toBeInTheDocument()
      expect(screen.getByText('Tilt')).toBeInTheDocument()
    })

    it('shows no WriteAttributes message when writes is empty', () => {
      const instances: InstanceStatus[] = [
        {
          id: 'graph-1',
          graphId: 'graph-1',
          enabled: true,
          writes: [],
        },
      ]

      mockUseRuntimeStore.mockImplementation((selector) =>
        selector({ instances } as unknown as Parameters<typeof selector>[0])
      )

      render(<ActiveGraphsList />)

      expect(screen.getByText('No WriteAttributes outputs')).toBeInTheDocument()
    })

    it('shows no WriteAttributes message when writes is undefined', () => {
      const instances: InstanceStatus[] = [
        {
          id: 'graph-1',
          graphId: 'graph-1',
          enabled: true,
        },
      ]

      mockUseRuntimeStore.mockImplementation((selector) =>
        selector({ instances } as unknown as Parameters<typeof selector>[0])
      )

      render(<ActiveGraphsList />)

      expect(screen.getByText('No WriteAttributes outputs')).toBeInTheDocument()
    })

    it('shows no fixtures selected when selection is empty', () => {
      const instances: InstanceStatus[] = [
        {
          id: 'graph-1',
          graphId: 'graph-1',
          enabled: true,
          writes: [
            {
              nodeId: 'write-1',
              selection: [],
              bundle: { intensity: 1 },
              priority: 0,
            },
          ],
        },
      ]

      mockUseRuntimeStore.mockImplementation((selector) =>
        selector({ instances } as unknown as Parameters<typeof selector>[0])
      )

      render(<ActiveGraphsList />)

      expect(screen.getByText('No fixtures selected')).toBeInTheDocument()
    })

    it('shows each WriteAttributes node separately with its priority', () => {
      const instances: InstanceStatus[] = [
        {
          id: 'graph-1',
          graphId: 'graph-1',
          enabled: true,
          writes: [
            {
              nodeId: 'write-1',
              selection: ['fix1'],
              bundle: { intensity: 0.5 },
              priority: 0,
            },
            {
              nodeId: 'write-2',
              selection: ['fix1'],
              bundle: { intensity: 1.0 },
              priority: 10,
            },
          ],
        },
      ]

      mockUseRuntimeStore.mockImplementation((selector) =>
        selector({ instances } as unknown as Parameters<typeof selector>[0])
      )

      render(<ActiveGraphsList />)

      // Each WriteAttributes node shows separately with its own values
      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByText('Priority: 0')).toBeInTheDocument()
      expect(screen.getByText('Priority: 10')).toBeInTheDocument()
    })
  })
})
