import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodePalette } from '../NodePalette'

describe('NodePalette', () => {
  it('renders category headers', () => {
    render(<NodePalette onAddNode={vi.fn()} />)

    expect(screen.getByText('Inputs')).toBeInTheDocument()
    expect(screen.getByText('Selection')).toBeInTheDocument()
    expect(screen.getByText('Math')).toBeInTheDocument()
    expect(screen.getByText('Effects')).toBeInTheDocument()
    expect(screen.getByText('Output')).toBeInTheDocument()
  })

  it('renders node types', () => {
    render(<NodePalette onAddNode={vi.fn()} />)

    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('Fader')).toBeInTheDocument()
    expect(screen.getByText('Button')).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
    expect(screen.getByText('Multiply')).toBeInTheDocument()
    expect(screen.getByText('Write Attributes')).toBeInTheDocument()
  })

  it('calls onAddNode when node is clicked', () => {
    const onAddNode = vi.fn()
    render(<NodePalette onAddNode={onAddNode} />)

    fireEvent.click(screen.getByText('Time'))
    expect(onAddNode).toHaveBeenCalledWith('Time')

    fireEvent.click(screen.getByText('Add'))
    expect(onAddNode).toHaveBeenCalledWith('Add')
  })

  it('makes nodes draggable', () => {
    render(<NodePalette onAddNode={vi.fn()} />)

    const timeNode = screen.getByText('Time')
    expect(timeNode).toHaveAttribute('draggable', 'true')
  })
})
