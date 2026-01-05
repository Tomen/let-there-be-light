import { useState, useCallback, useRef, useEffect } from 'react'
import type { PortDefinition } from '@let-there-be-light/shared'
import { useGraphContext } from '../GraphContext'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

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
          min={inputDef.min}
          max={inputDef.max}
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
      return (
        <ColorValue
          nodeId={nodeId}
          inputName={inputName}
          value={value as { r: number; g: number; b: number } | undefined}
          onCommit={onParamChange}
        />
      )
    case 'Position':
      return (
        <PositionValue
          nodeId={nodeId}
          inputName={inputName}
          value={value as { pan: number; tilt: number } | undefined}
          onCommit={onParamChange}
        />
      )
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
  min?: number
  max?: number
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
      // Only clamp if both min and max are defined
      const finalValue = (min !== undefined && max !== undefined)
        ? Math.max(min, Math.min(max, numValue))
        : numValue
      onCommit(nodeId, inputName, finalValue)
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
        {...(min !== undefined && { min })}
        {...(max !== undefined && { max })}
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
// Color Value (click to edit with popover)
// ============================================

interface ColorValueProps {
  nodeId: string
  inputName: string
  value: { r: number; g: number; b: number } | undefined
  onCommit: (nodeId: string, paramName: string, value: unknown) => void
}

function ColorValue({ nodeId, inputName, value, onCommit }: ColorValueProps) {
  const [isOpen, setIsOpen] = useState(false)
  const color = value ?? { r: 1, g: 1, b: 1 }
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)

  // Convert RGB to hex for the color input
  const toHex = (c: { r: number; g: number; b: number }) => {
    const rHex = Math.round(c.r * 255).toString(16).padStart(2, '0')
    const gHex = Math.round(c.g * 255).toString(16).padStart(2, '0')
    const bHex = Math.round(c.b * 255).toString(16).padStart(2, '0')
    return `#${rHex}${gHex}${bHex}`
  }

  // Convert hex to normalized RGB
  const fromHex = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (result) {
      return {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    }
    return color
  }

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = fromHex(e.target.value)
      onCommit(nodeId, inputName, newColor)
    },
    [nodeId, inputName, onCommit, color]
  )

  const handleComponentChange = useCallback(
    (component: 'r' | 'g' | 'b', newValue: number) => {
      const clamped = Math.max(0, Math.min(1, newValue))
      onCommit(nodeId, inputName, { ...color, [component]: clamped })
    },
    [nodeId, inputName, color, onCommit]
  )

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <span
          onClick={(e) => e.stopPropagation()}
          className="inline-block h-3 w-3 cursor-pointer rounded border border-white/50 hover:ring-1 hover:ring-blue-400"
          style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-48 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          {/* Color picker */}
          <input
            type="color"
            value={toHex(color)}
            onChange={handleColorChange}
            className="h-8 w-full cursor-pointer rounded border-0"
          />
          {/* RGB sliders */}
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-6 text-red-400">R</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={color.r}
                onChange={(e) => handleComponentChange('r', parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="w-8 text-right text-muted-foreground">
                {(color.r * 255).toFixed(0)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 text-green-400">G</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={color.g}
                onChange={(e) => handleComponentChange('g', parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="w-8 text-right text-muted-foreground">
                {(color.g * 255).toFixed(0)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 text-blue-400">B</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={color.b}
                onChange={(e) => handleComponentChange('b', parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="w-8 text-right text-muted-foreground">
                {(color.b * 255).toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ============================================
// Position Value (click to edit with popover)
// ============================================

interface PositionValueProps {
  nodeId: string
  inputName: string
  value: { pan: number; tilt: number } | undefined
  onCommit: (nodeId: string, paramName: string, value: unknown) => void
}

function PositionValue({ nodeId, inputName, value, onCommit }: PositionValueProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pos = value ?? { pan: 0, tilt: 0 }

  const handleComponentChange = useCallback(
    (component: 'pan' | 'tilt', newValue: number) => {
      const clamped = Math.max(0, Math.min(1, newValue))
      onCommit(nodeId, inputName, { ...pos, [component]: clamped })
    },
    [nodeId, inputName, pos, onCommit]
  )

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <span
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'cursor-pointer rounded px-1 text-[9px]',
            'bg-muted/50 text-muted-foreground/70 hover:bg-muted hover:text-foreground'
          )}
        >
          {pos.pan.toFixed(2)},{pos.tilt.toFixed(2)}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-48 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-8 text-muted-foreground">Pan</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={pos.pan}
              onChange={(e) => handleComponentChange('pan', parseFloat(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={pos.pan.toFixed(2)}
              onChange={(e) => handleComponentChange('pan', parseFloat(e.target.value))}
              className="w-12 rounded border bg-background px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 text-muted-foreground">Tilt</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={pos.tilt}
              onChange={(e) => handleComponentChange('tilt', parseFloat(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={pos.tilt.toFixed(2)}
              onChange={(e) => handleComponentChange('tilt', parseFloat(e.target.value))}
              className="w-12 rounded border bg-background px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
