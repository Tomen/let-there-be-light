import { NODE_DEFINITIONS, type NodeType } from '@let-there-be-light/shared'
import type { GraphNode } from '@let-there-be-light/shared'
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
import { useFaders, useButtons } from '@/api'

interface NodeInspectorProps {
  node: GraphNode | null
  onParamChange: (nodeId: string, paramName: string, value: unknown) => void
}

export function NodeInspector({ node, onParamChange }: NodeInspectorProps) {
  const { data: faders = [] } = useFaders()
  const { data: buttons = [] } = useButtons()

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

  return (
    <div className="flex h-full w-64 flex-col border-l bg-background">
      <div className="border-b p-3">
        <h2 className="text-sm font-semibold">{def.label}</h2>
        <p className="text-xs text-muted-foreground">{node.id}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Node Inputs */}
        {Object.keys(def.inputs).length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">INPUTS</h3>
            <div className="space-y-1 text-sm">
              {Object.entries(def.inputs).map(([port, portDef]) => (
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

                if (paramDef.type === 'number') {
                  const hasRange = paramDef.min !== undefined && paramDef.max !== undefined
                  return (
                    <div key={paramName} className="space-y-1.5">
                      <Label htmlFor={paramName} className="text-xs">{label}</Label>
                      {hasRange ? (
                        <div className="flex items-center gap-2">
                          <Slider
                            id={paramName}
                            min={paramDef.min}
                            max={paramDef.max}
                            step={(paramDef.max! - paramDef.min!) / 100}
                            value={[Number(value) || paramDef.min!]}
                            onValueChange={([v]) => onParamChange(node.id, paramName, v)}
                            className="flex-1"
                          />
                          <span className="w-12 text-right text-xs text-muted-foreground">
                            {(Number(value) || 0).toFixed(2)}
                          </span>
                        </div>
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
