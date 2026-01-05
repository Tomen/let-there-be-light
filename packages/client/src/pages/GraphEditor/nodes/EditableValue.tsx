import { useState, useCallback, useRef, useEffect } from 'react'
import type { PortDefinition } from '@let-there-be-light/shared'
import { useGraphContext } from '../GraphContext'
import { cn } from '@/lib/utils'

interface EditableValueProps {
  nodeId: string
  inputName: string
  inputDef: PortDefinition
  value: unknown
}

export function EditableValue({ nodeId, inputName, inputDef, value }: EditableValueProps) {
  const { onParamChange } = useGraphContext()

  switch (inputDef.type) {
    case 'Scalar':
      return (
        <ScalarValue
          nodeId={nodeId}
          inputName={inputName}
          value={typeof value === 'number' ? value : (inputDef.default as number) ?? 0}
          min={inputDef.min ?? 0}
          max={inputDef.max ?? 1}
          onCommit={onParamChange}
        />
      )
    case 'Bool':
      return (
        <BoolValue
          nodeId={nodeId}
          inputName={inputName}
          value={typeof value === 'boolean' ? value : (inputDef.default as boolean) ?? false}
          onCommit={onParamChange}
        />
      )
    case 'Color':
      return <ColorSwatch value={value as { r: number; g: number; b: number } | undefined} />
    case 'Position':
      return <PositionDisplay value={value as { pan: number; tilt: number } | undefined} />
    default:
      return null
  }
}

// ============================================
// Scalar Value (click to edit)
// ============================================

interface ScalarValueProps {
  nodeId: string
  inputName: string
  value: number
  min: number
  max: number
  onCommit: (nodeId: string, paramName: string, value: unknown) => void
}

function ScalarValue({ nodeId, inputName, value, min, max, onCommit }: ScalarValueProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  // Update local value when prop changes
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(String(value))
    }
  }, [value, isEditing])

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }, [])

  const handleCommit = useCallback(() => {
    const numValue = parseFloat(localValue)
    if (!isNaN(numValue)) {
      const clamped = Math.max(min, Math.min(max, numValue))
      onCommit(nodeId, inputName, clamped)
    }
    setIsEditing(false)
  }, [localValue, min, max, nodeId, inputName, onCommit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommit()
    } else if (e.key === 'Escape') {
      setLocalValue(String(value))
      setIsEditing(false)
    }
    e.stopPropagation()
  }, [handleCommit, value])

  const handleBlur = useCallback(() => {
    handleCommit()
  }, [handleCommit])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onClick={(e) => e.stopPropagation()}
        step={0.01}
        min={min}
        max={max}
        className="w-10 rounded border border-blue-500 bg-background px-1 text-[10px] text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    )
  }

  return (
    <span
      onClick={handleClick}
      className={cn(
        'cursor-pointer rounded border border-transparent px-1 text-[10px]',
        'bg-muted/50 text-foreground hover:border-blue-400 hover:bg-muted'
      )}
    >
      {value.toFixed(2)}
    </span>
  )
}

// ============================================
// Bool Value (checkbox toggle)
// ============================================

interface BoolValueProps {
  nodeId: string
  inputName: string
  value: boolean
  onCommit: (nodeId: string, paramName: string, value: unknown) => void
}

function BoolValue({ nodeId, inputName, value, onCommit }: BoolValueProps) {
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onCommit(nodeId, inputName, !value)
  }, [nodeId, inputName, value, onCommit])

  return (
    <span
      onClick={handleToggle}
      className={cn(
        'flex h-3 w-3 cursor-pointer items-center justify-center rounded border',
        value
          ? 'border-blue-500 bg-blue-500'
          : 'border-muted-foreground/50 bg-background hover:border-blue-400'
      )}
    >
      {value && (
        <svg className="h-2 w-2 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

// ============================================
// Color Swatch (display only on node)
// ============================================

interface ColorSwatchProps {
  value: { r: number; g: number; b: number } | undefined
}

function ColorSwatch({ value }: ColorSwatchProps) {
  const color = value ?? { r: 1, g: 1, b: 1 }
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)

  return (
    <span
      className="inline-block h-3 w-3 rounded border border-white/50"
      style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
    />
  )
}

// ============================================
// Position Display (display only on node)
// ============================================

interface PositionDisplayProps {
  value: { pan: number; tilt: number } | undefined
}

function PositionDisplay({ value }: PositionDisplayProps) {
  const pos = value ?? { pan: 0, tilt: 0 }

  return (
    <span className="text-[9px] text-muted-foreground/70">
      {pos.pan.toFixed(1)},{pos.tilt.toFixed(1)}
    </span>
  )
}
