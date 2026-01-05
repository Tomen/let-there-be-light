import { useState, useEffect } from 'react'
import { NODE_DEFINITIONS, type NodeType, type PortDefinition, isConnectableType, hasDefault } from '@let-there-be-light/shared'
import type { GraphNode, GraphEdge } from '@let-there-be-light/shared'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFaders, useButtons, useGroups, useFixtures } from '@/api'
import { cn } from '@/lib/utils'

// Scalar slider that only commits on release to avoid flickering
function ScalarSlider({
  id,
  value,
  min,
  max,
  step,
  disabled,
  onCommit,
}: {
  id: string
  value: number
  min: number
  max: number
  step: number
  disabled?: boolean
  onCommit: (value: number) => void
}) {
  const [localValue, setLocalValue] = useState(value)

  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <div className={cn('flex items-center gap-2', disabled && 'opacity-50')}>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[localValue]}
        onValueChange={([v]) => setLocalValue(v)}
        onValueCommit={([v]) => onCommit(v)}
        disabled={disabled}
        className="flex-1"
      />
      <span className="w-12 text-right text-xs text-muted-foreground">
        {localValue.toFixed(2)}
      </span>
    </div>
  )
}

// Position slider that only commits on release
function PositionSlider({
  value,
  disabled,
  onCommit,
}: {
  value: { pan: number; tilt: number }
  disabled?: boolean
  onCommit: (value: { pan: number; tilt: number }) => void
}) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <div className={cn('space-y-2', disabled && 'opacity-50')}>
      <div className="flex items-center gap-2">
        <span className="w-8 text-xs text-muted-foreground">Pan</span>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[localValue.pan]}
          onValueChange={([v]) => setLocalValue({ ...localValue, pan: v })}
          onValueCommit={([v]) => onCommit({ ...localValue, pan: v })}
          disabled={disabled}
          className="flex-1"
        />
        <span className="w-10 text-right text-xs text-muted-foreground">
          {localValue.pan.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8 text-xs text-muted-foreground">Tilt</span>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[localValue.tilt]}
          onValueChange={([v]) => setLocalValue({ ...localValue, tilt: v })}
          onValueCommit={([v]) => onCommit({ ...localValue, tilt: v })}
          disabled={disabled}
          className="flex-1"
        />
        <span className="w-10 text-right text-xs text-muted-foreground">
          {localValue.tilt.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

interface NodeInspectorProps {
  node: GraphNode | null
  edges: GraphEdge[]
  onParamChange: (nodeId: string, paramName: string, value: unknown) => void
}

// Check if an input port is connected
function isInputConnected(edges: GraphEdge[], nodeId: string, inputPort: string): boolean {
  return edges.some(e => e.to.nodeId === nodeId && e.to.port === inputPort)
}

// Get default color value
function getColorValue(value: unknown, defaultValue: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  if (value && typeof value === 'object' && 'r' in value) {
    return value as { r: number; g: number; b: number }
  }
  return defaultValue
}

// Convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    }
  }
  return { r: 1, g: 1, b: 1 }
}

// Get position value
function getPositionValue(value: unknown, defaultValue: { pan: number; tilt: number }): { pan: number; tilt: number } {
  if (value && typeof value === 'object' && 'pan' in value) {
    return value as { pan: number; tilt: number }
  }
  return defaultValue
}

// Render input control based on port type
function renderInputControl(
  inputName: string,
  inputDef: PortDefinition,
  value: unknown,
  isConnected: boolean,
  onChange: (name: string, value: unknown) => void
): React.ReactNode {
  if (inputDef.type === 'Scalar') {
    const numValue = typeof value === 'number' ? value : (inputDef.default as number) ?? 0
    const hasRange = inputDef.min !== undefined && inputDef.max !== undefined

    if (hasRange) {
      return (
        <ScalarSlider
          id={inputName}
          value={numValue}
          min={inputDef.min!}
          max={inputDef.max!}
          step={(inputDef.max! - inputDef.min!) / 100}
          disabled={isConnected}
          onCommit={(v) => onChange(inputName, v)}
        />
      )
    }

    return (
      <Input
        id={inputName}
        type="number"
        value={String(numValue)}
        onChange={(e) => onChange(inputName, Number(e.target.value))}
        disabled={isConnected}
        className={cn('h-8 text-sm', isConnected && 'opacity-50')}
      />
    )
  }

  if (inputDef.type === 'Bool') {
    const boolValue = typeof value === 'boolean' ? value : (inputDef.default as boolean) ?? false
    return (
      <input
        id={inputName}
        type="checkbox"
        checked={boolValue}
        onChange={(e) => onChange(inputName, e.target.checked)}
        disabled={isConnected}
        className={cn('rounded', isConnected && 'opacity-50')}
      />
    )
  }

  if (inputDef.type === 'Color') {
    const colorValue = getColorValue(value, (inputDef.default as { r: number; g: number; b: number }) ?? { r: 1, g: 1, b: 1 })
    const hexValue = rgbToHex(colorValue.r, colorValue.g, colorValue.b)

    return (
      <div className={cn('flex items-center gap-2', isConnected && 'opacity-50')}>
        <input
          type="color"
          value={hexValue}
          onChange={(e) => onChange(inputName, hexToRgb(e.target.value))}
          disabled={isConnected}
          className="h-8 w-12 cursor-pointer rounded border"
        />
        <span className="text-xs text-muted-foreground">{hexValue}</span>
      </div>
    )
  }

  if (inputDef.type === 'Position') {
    const posValue = getPositionValue(value, (inputDef.default as { pan: number; tilt: number }) ?? { pan: 0.5, tilt: 0.5 })

    return (
      <PositionSlider
        value={posValue}
        disabled={isConnected}
        onCommit={(v) => onChange(inputName, v)}
      />
    )
  }

  // Fallback for unknown types
  return <span className="text-xs text-muted-foreground">No editor for {inputDef.type}</span>
}

export function NodeInspector({ node, edges, onParamChange }: NodeInspectorProps) {
  const { data: faders = [] } = useFaders()
  const { data: buttons = [] } = useButtons()
  const { data: groups = [] } = useGroups()
  const { data: fixtures = [] } = useFixtures()

  if (!node) {
    return (
      <div className="flex h-full w-64 flex-col border-l bg-background">
        <div className="border-b p-3">
          <h2 className="text-sm font-semibold">Inspector</h2>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Select a node to edit
        </div>
      </div>
    )
  }

  const def = NODE_DEFINITIONS[node.type as NodeType]
  if (!def) {
    return (
      <div className="flex h-full w-64 flex-col border-l bg-background">
        <div className="border-b p-3">
          <h2 className="text-sm font-semibold">Inspector</h2>
        </div>
        <div className="p-3 text-sm text-destructive">Unknown node type</div>
      </div>
    )
  }

  const paramEntries = Object.entries(def.params)

  // Get connectable inputs (those with defaults that can be edited)
  const connectableInputs = Object.entries(def.inputs).filter(
    ([_, portDef]) => isConnectableType(portDef.type) && hasDefault(portDef)
  )

  // Get non-connectable inputs (just for display)
  const nonConnectableInputs = Object.entries(def.inputs).filter(
    ([_, portDef]) => !isConnectableType(portDef.type) || !hasDefault(portDef)
  )

  return (
    <div className="flex h-full w-64 flex-col border-l bg-background">
      <div className="border-b p-3">
        <h2 className="text-sm font-semibold">{def.label}</h2>
        <p className="text-xs text-muted-foreground">{node.id}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Connectable Inputs with Defaults */}
        {connectableInputs.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">INPUTS</h3>
            <div className="space-y-3">
              {connectableInputs.map(([inputName, inputDef]) => {
                const isConnected = isInputConnected(edges, node.id, inputName)
                const value = node.params[inputName] ?? inputDef.default
                const label = inputDef.label || inputName

                return (
                  <div key={inputName} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{label}</Label>
                      {isConnected && (
                        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-500">
                          Connected
                        </span>
                      )}
                    </div>
                    {renderInputControl(
                      inputName,
                      inputDef,
                      value,
                      isConnected,
                      (name, val) => onParamChange(node.id, name, val)
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Non-connectable Inputs (display only) */}
        {nonConnectableInputs.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              {connectableInputs.length > 0 ? 'OTHER INPUTS' : 'INPUTS'}
            </h3>
            <div className="space-y-1 text-sm">
              {nonConnectableInputs.map(([port, portDef]) => (
                <div key={port} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{portDef.label || port}</span>
                  <span className="rounded bg-muted px-1 text-xs">{portDef.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Node Outputs */}
        {Object.keys(def.outputs).length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">OUTPUTS</h3>
            <div className="space-y-1 text-sm">
              {Object.entries(def.outputs).map(([port, portDef]) => (
                <div key={port} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{portDef.label || port}</span>
                  <span className="rounded bg-muted px-1 text-xs">{portDef.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Node Parameters */}
        {paramEntries.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">PARAMETERS</h3>
            <div className="space-y-3">
              {paramEntries.map(([paramName, paramDef]) => {
                const value = node.params[paramName] ?? paramDef.default
                const label = paramDef.label || paramName

                // Special handling for faderId
                if (paramName === 'faderId') {
                  return (
                    <div key={paramName} className="space-y-1.5">
                      <Label htmlFor={paramName} className="text-xs">{label}</Label>
                      <Select
                        value={String(value ?? '')}
                        onValueChange={(v) => onParamChange(node.id, paramName, v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select fader" />
                        </SelectTrigger>
                        <SelectContent>
                          {faders.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground">
                              No faders configured
                            </div>
                          ) : (
                            faders.map((fader) => (
                              <SelectItem key={fader.id} value={fader.id}>
                                {fader.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                }

                // Special handling for buttonId
                if (paramName === 'buttonId') {
                  return (
                    <div key={paramName} className="space-y-1.5">
                      <Label htmlFor={paramName} className="text-xs">{label}</Label>
                      <Select
                        value={String(value ?? '')}
                        onValueChange={(v) => onParamChange(node.id, paramName, v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select button" />
                        </SelectTrigger>
                        <SelectContent>
                          {buttons.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground">
                              No buttons configured
                            </div>
                          ) : (
                            buttons.map((button) => (
                              <SelectItem key={button.id} value={button.id}>
                                {button.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                }

                // Special handling for groupId
                if (paramName === 'groupId') {
                  return (
                    <div key={paramName} className="space-y-1.5">
                      <Label htmlFor={paramName} className="text-xs">{label}</Label>
                      <Select
                        value={String(value ?? '')}
                        onValueChange={(v) => onParamChange(node.id, paramName, v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground">
                              No groups configured
                            </div>
                          ) : (
                            groups.map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                {group.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                }

                // Special handling for fixtureId
                if (paramName === 'fixtureId') {
                  return (
                    <div key={paramName} className="space-y-1.5">
                      <Label htmlFor={paramName} className="text-xs">{label}</Label>
                      <Select
                        value={String(value ?? '')}
                        onValueChange={(v) => onParamChange(node.id, paramName, v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select fixture" />
                        </SelectTrigger>
                        <SelectContent>
                          {fixtures.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground">
                              No fixtures configured
                            </div>
                          ) : (
                            fixtures.map((fixture) => (
                              <SelectItem key={fixture.id} value={fixture.id}>
                                {fixture.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                }

                if (paramDef.type === 'number') {
                  const hasRange = paramDef.min !== undefined && paramDef.max !== undefined
                  return (
                    <div key={paramName} className="space-y-1.5">
                      <Label htmlFor={paramName} className="text-xs">{label}</Label>
                      {hasRange ? (
                        <ScalarSlider
                          id={paramName}
                          value={Number(value) || paramDef.min!}
                          min={paramDef.min!}
                          max={paramDef.max!}
                          step={(paramDef.max! - paramDef.min!) / 100}
                          onCommit={(v) => onParamChange(node.id, paramName, v)}
                        />
                      ) : (
                        <Input
                          id={paramName}
                          type="number"
                          value={String(value ?? '')}
                          onChange={(e) => onParamChange(node.id, paramName, Number(e.target.value))}
                          className="h-8 text-sm"
                        />
                      )}
                    </div>
                  )
                }

                if (paramDef.type === 'string') {
                  return (
                    <div key={paramName} className="space-y-1.5">
                      <Label htmlFor={paramName} className="text-xs">{label}</Label>
                      <Input
                        id={paramName}
                        type="text"
                        value={String(value ?? '')}
                        onChange={(e) => onParamChange(node.id, paramName, e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  )
                }

                if (paramDef.type === 'boolean') {
                  return (
                    <div key={paramName} className="flex items-center gap-2">
                      <input
                        id={paramName}
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => onParamChange(node.id, paramName, e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor={paramName} className="text-xs">{label}</Label>
                    </div>
                  )
                }

                return null
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
