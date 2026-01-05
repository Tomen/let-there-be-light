import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { NODE_DEFINITIONS, hasDefault, type NodeType, type PortType } from '@let-there-be-light/shared'
import { cn } from '@/lib/utils'
import { useGraphContext } from '../GraphContext'
import { EditableValue } from './EditableValue'

interface GraphNodeData {
  type: NodeType
  params: Record<string, unknown>
  inputNames?: Record<string, string>
}

type GraphNodeProps = NodeProps<Node<GraphNodeData>>

// Port colors by type (using hex for inline styles to override ReactFlow defaults)
const portColors: Record<PortType, string> = {
  Scalar: '#3b82f6',     // blue-500
  Bool: '#eab308',       // yellow-500
  Color: 'linear-gradient(to right, #ef4444, #22c55e, #3b82f6)', // red-green-blue
  Position: '#a855f7',   // purple-500
  Bundle: '#f97316',     // orange-500
  Selection: '#06b6d4',  // cyan-500
  Trigger: '#ec4899',    // pink-500
}

// Category colors for node headers
const categoryColors: Record<string, string> = {
  input: 'bg-green-600',
  constant: 'bg-teal-600',
  selection: 'bg-cyan-600',
  preset: 'bg-orange-600',
  math: 'bg-blue-600',
  effect: 'bg-purple-600',
  color: 'bg-gradient-to-r from-red-600 to-orange-600',
  position: 'bg-indigo-600',
  bundle: 'bg-amber-600',
  output: 'bg-red-600',
}

function GraphNodeComponent({ id, data, selected }: GraphNodeProps) {
  const { connectedInputs } = useGraphContext()
  const def = NODE_DEFINITIONS[data.type]
  if (!def) {
    return (
      <div className="rounded border border-destructive bg-destructive/20 p-2 text-xs">
        Unknown: {data.type}
      </div>
    )
  }

  const inputs = Object.entries(def.inputs)
  const outputs = Object.entries(def.outputs)
  const maxPorts = Math.max(inputs.length, outputs.length, 1)

  // Check if an input is connected
  const isConnected = (inputName: string) => connectedInputs.has(`${id}:${inputName}`)

  return (
    <div
      className={cn(
        'min-w-[140px] rounded-lg border bg-background shadow-md',
        selected && 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/30'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'rounded-t-lg px-3 py-1.5 text-xs font-medium text-white',
          categoryColors[def.category] || 'bg-gray-600'
        )}
      >
        {def.label}
      </div>

      {/* Body with ports */}
      <div className="py-2">
        {/* Render rows - each row can have an input (left) and/or output (right) */}
        {Array.from({ length: maxPorts }).map((_, rowIndex) => {
          const input = inputs[rowIndex]
          const output = outputs[rowIndex]

          return (
            <div
              key={rowIndex}
              className="relative flex h-6 items-center justify-between px-1"
            >
              {/* Input handle + label */}
              {input ? (
                <>
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={input[0]}
                    className="!absolute !h-3 !w-3 !rounded-full !border-2 !border-white"
                    style={{
                      background: portColors[input[1].type],
                      left: -6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  />
                  <span className="flex items-center gap-1 pl-2 text-[10px] text-muted-foreground">
                    {input[1].label || input[0]}
                    {hasDefault(input[1]) && !isConnected(input[0]) && (
                      <EditableValue
                        nodeId={id}
                        inputName={input[0]}
                        inputDef={input[1]}
                        value={data.params[input[0]] ?? input[1].default}
                      />
                    )}
                  </span>
                </>
              ) : (
                <span />
              )}

              {/* Output label + handle */}
              {output ? (
                <>
                  <span className="pr-2 text-[10px] text-muted-foreground">
                    {output[1].label || output[0]}
                  </span>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={output[0]}
                    className="!absolute !h-3 !w-3 !rounded-full !border-2 !border-white"
                    style={{
                      background: portColors[output[1].type],
                      right: -6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  />
                </>
              ) : (
                <span />
              )}
            </div>
          )
        })}

        {/* Show key param value preview */}
        {Object.keys(def.params).length > 0 && (
          <div className="mt-1 border-t pt-1 text-center">
            <span className="text-[9px] text-muted-foreground/70">
              {getParamPreview(data.params, def.params, data.inputNames)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function getParamPreview(
  params: Record<string, unknown>,
  paramDefs: Record<string, { type: string; default?: unknown; label?: string }>,
  inputNames?: Record<string, string>
): string {
  const entries = Object.entries(paramDefs).slice(0, 2)
  return entries
    .map(([key, def]) => {
      const value = params[key] ?? def.default
      // Show input name for faderId/buttonId
      if ((key === 'faderId' || key === 'buttonId') && inputNames && typeof value === 'string') {
        const name = inputNames[value]
        return name ? name : String(value)
      }
      if (typeof value === 'number') {
        return `${def.label || key}: ${value.toFixed(2)}`
      }
      return `${def.label || key}: ${value}`
    })
    .join(', ')
}

export default memo(GraphNodeComponent)
