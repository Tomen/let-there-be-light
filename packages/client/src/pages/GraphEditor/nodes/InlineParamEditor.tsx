import { useState, useCallback } from 'react'
import type { ParamDefinition } from '@let-there-be-light/shared'
import { useGraphContext } from '../GraphContext'
import { X, Plus, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface InlineParamEditorProps {
  nodeId: string
  paramName: string
  paramDef: ParamDefinition
  value: unknown
}

export function InlineParamEditor({
  nodeId,
  paramName,
  paramDef,
  value,
}: InlineParamEditorProps) {
  const { onParamChange, groups, fixtures, faders, buttons } = useGraphContext()

  // Determine options based on param name
  const options = getOptionsForParam(paramName, { groups, fixtures, faders, buttons })

  if (paramDef.type === 'string[]') {
    return (
      <MultiSelectParam
        nodeId={nodeId}
        paramName={paramName}
        value={(value as string[]) || []}
        options={options}
        onParamChange={onParamChange}
      />
    )
  }

  if (paramDef.type === 'string') {
    return (
      <SingleSelectParam
        nodeId={nodeId}
        paramName={paramName}
        value={(value as string) || ''}
        options={options}
        onParamChange={onParamChange}
      />
    )
  }

  // Other param types (number, boolean) could be handled here
  return null
}

// ============================================
// Helper to get options for a param
// ============================================

interface OptionItem {
  id: string
  name: string
}

function getOptionsForParam(
  paramName: string,
  data: {
    groups: { id: string; name: string }[]
    fixtures: { id: string; name: string }[]
    faders: { id: string; name: string }[]
    buttons: { id: string; name: string }[]
  }
): OptionItem[] {
  switch (paramName) {
    case 'groupIds':
      return data.groups
    case 'fixtureIds':
      return data.fixtures
    case 'faderId':
      return data.faders
    case 'buttonId':
      return data.buttons
    default:
      return []
  }
}

// ============================================
// Multi-Select Param (groupIds, fixtureIds)
// ============================================

interface MultiSelectParamProps {
  nodeId: string
  paramName: string
  value: string[]
  options: OptionItem[]
  onParamChange: (nodeId: string, paramName: string, value: unknown) => void
}

function MultiSelectParam({
  nodeId,
  paramName,
  value,
  options,
  onParamChange,
}: MultiSelectParamProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleRemove = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      const newValue = value.filter((v) => v !== id)
      onParamChange(nodeId, paramName, newValue)
    },
    [nodeId, paramName, value, onParamChange]
  )

  const handleToggle = useCallback(
    (id: string) => {
      const newValue = value.includes(id)
        ? value.filter((v) => v !== id)
        : [...value, id]
      onParamChange(nodeId, paramName, newValue)
    },
    [nodeId, paramName, value, onParamChange]
  )

  const selectedOptions = options.filter((opt) => value.includes(opt.id))
  const availableOptions = options.filter((opt) => !value.includes(opt.id))

  return (
    <div className="px-1 pb-1">
      {/* Selected items as chips */}
      {selectedOptions.map((opt) => (
        <div
          key={opt.id}
          className="mb-0.5 flex items-center justify-between rounded bg-muted/50 px-1.5 py-0.5 text-[10px]"
        >
          <span className="truncate">{opt.name}</span>
          <button
            onClick={(e) => handleRemove(opt.id, e)}
            className="ml-1 rounded-full p-0.5 hover:bg-muted"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}

      {/* Add button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex w-full items-center justify-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-[10px] text-muted-foreground',
              'hover:border-blue-400 hover:text-foreground'
            )}
          >
            <Plus className="h-2.5 w-2.5" />
            Add
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-48 p-1"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-h-48 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-2 py-1 text-xs text-muted-foreground">
                No options available
              </div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleToggle(opt.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent',
                    value.includes(opt.id) && 'bg-accent'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-3.5 w-3.5 items-center justify-center rounded border',
                      value.includes(opt.id)
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-muted-foreground/50'
                    )}
                  >
                    {value.includes(opt.id) && (
                      <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="truncate">{opt.name}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ============================================
// Single-Select Param (faderId, buttonId)
// ============================================

interface SingleSelectParamProps {
  nodeId: string
  paramName: string
  value: string
  options: OptionItem[]
  onParamChange: (nodeId: string, paramName: string, value: unknown) => void
}

function SingleSelectParam({
  nodeId,
  paramName,
  value,
  options,
  onParamChange,
}: SingleSelectParamProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = useCallback(
    (id: string) => {
      onParamChange(nodeId, paramName, id)
      setIsOpen(false)
    },
    [nodeId, paramName, onParamChange]
  )

  const selectedOption = options.find((opt) => opt.id === value)

  return (
    <div className="px-1 pb-1">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex w-full items-center justify-between rounded bg-muted/50 px-1.5 py-0.5 text-[10px]',
              'hover:bg-muted'
            )}
          >
            <span className="truncate">
              {selectedOption?.name || 'Select...'}
            </span>
            <ChevronDown className="h-2.5 w-2.5 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-48 p-1"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-h-48 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-2 py-1 text-xs text-muted-foreground">
                No options available
              </div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSelect(opt.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent',
                    opt.id === value && 'bg-accent'
                  )}
                >
                  <span className="truncate">{opt.name}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
