import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CompileErrorPanel } from '../CompileErrorPanel'
import type { CompileResult } from '@let-there-be-light/shared'

describe('CompileErrorPanel', () => {
  it('shows not compiled message when result is null', () => {
    render(<CompileErrorPanel result={null} onFocusNode={vi.fn()} />)

    expect(screen.getByText('Not compiled yet')).toBeInTheDocument()
  })

  it('shows success message when compilation succeeds', () => {
    const result: CompileResult = {
      ok: true,
      errors: [],
      dependencies: { faderIds: [], buttonIds: [], groupIds: [], fixtureIds: [] },
    }

    render(<CompileErrorPanel result={result} onFocusNode={vi.fn()} />)

    expect(screen.getByText('Compilation successful')).toBeInTheDocument()
  })

  it('shows error count when compilation fails', () => {
    const result: CompileResult = {
      ok: false,
      errors: [
        { nodeId: 'node-1', message: 'Missing input', code: 'MISSING_CONNECTION' },
        { nodeId: 'node-2', message: 'Invalid type', code: 'TYPE_MISMATCH' },
      ],
      dependencies: { faderIds: [], buttonIds: [], groupIds: [], fixtureIds: [] },
    }

    render(<CompileErrorPanel result={result} onFocusNode={vi.fn()} />)

    expect(screen.getByText('2 errors')).toBeInTheDocument()
  })

  it('shows singular error for single error', () => {
    const result: CompileResult = {
      ok: false,
      errors: [
        { nodeId: 'node-1', message: 'Missing input', code: 'MISSING_CONNECTION' },
      ],
      dependencies: { faderIds: [], buttonIds: [], groupIds: [], fixtureIds: [] },
    }

    render(<CompileErrorPanel result={result} onFocusNode={vi.fn()} />)

    expect(screen.getByText('1 error')).toBeInTheDocument()
  })

  it('displays error messages', () => {
    const result: CompileResult = {
      ok: false,
      errors: [
        { nodeId: 'node-1', message: 'Missing input connection', code: 'MISSING_CONNECTION' },
      ],
      dependencies: { faderIds: [], buttonIds: [], groupIds: [], fixtureIds: [] },
    }

    render(<CompileErrorPanel result={result} onFocusNode={vi.fn()} />)

    expect(screen.getByText('Missing input connection')).toBeInTheDocument()
    expect(screen.getByText(/Node: node-1/)).toBeInTheDocument()
  })

  it('shows port info when available', () => {
    const result: CompileResult = {
      ok: false,
      errors: [
        { nodeId: 'node-1', port: 'value', message: 'Missing input', code: 'MISSING_CONNECTION' },
      ],
      dependencies: { faderIds: [], buttonIds: [], groupIds: [], fixtureIds: [] },
    }

    render(<CompileErrorPanel result={result} onFocusNode={vi.fn()} />)

    expect(screen.getByText(/Port: value/)).toBeInTheDocument()
  })

  it('calls onFocusNode when error is clicked', () => {
    const onFocusNode = vi.fn()
    const result: CompileResult = {
      ok: false,
      errors: [
        { nodeId: 'node-1', message: 'Missing input', code: 'MISSING_CONNECTION' },
      ],
      dependencies: { faderIds: [], buttonIds: [], groupIds: [], fixtureIds: [] },
    }

    render(<CompileErrorPanel result={result} onFocusNode={onFocusNode} />)

    const errorItem = screen.getByText('Missing input').closest('div[class*="cursor-pointer"]')!
    fireEvent.click(errorItem)

    expect(onFocusNode).toHaveBeenCalledWith('node-1')
  })
})
