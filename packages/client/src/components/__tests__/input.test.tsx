import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '../ui/input'

describe('Input', () => {
  it('renders with default type', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    // HTML inputs default to type="text" even without the attribute
    expect(input.getAttribute('type') ?? 'text').toBe('text')
  })

  it('renders with specified type', () => {
    render(<Input type="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')
  })

  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text..." />)
    expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument()
  })

  it('handles value changes', () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test value' } })

    expect(onChange).toHaveBeenCalled()
  })

  it('can be controlled', () => {
    const { rerender } = render(<Input value="initial" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('initial')

    rerender(<Input value="updated" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('updated')
  })

  it('can be disabled', () => {
    render(<Input disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('applies custom className', () => {
    render(<Input className="custom-input" />)
    expect(screen.getByRole('textbox')).toHaveClass('custom-input')
  })

  it('forwards ref', () => {
    const ref = vi.fn()
    render(<Input ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })

  it('passes through additional props', () => {
    render(<Input data-testid="custom-input" aria-label="Custom" />)
    const input = screen.getByTestId('custom-input')
    expect(input).toHaveAttribute('aria-label', 'Custom')
  })
})
