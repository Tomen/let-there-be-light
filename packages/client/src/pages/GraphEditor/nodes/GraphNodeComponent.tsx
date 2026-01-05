import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { NODE_DEFINITIONS, hasDefault, type NodeType, type PortType, type ParamDefinition } from '@let-there-be-light/shared'
import { cn } from '@/lib/utils'
import { useGraphContext } from '../GraphContext'
import { EditableValue } from './EditableValue'
import { InlineParamEditor } from './InlineParamEditor'

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
  const { connectedInputs, onParamChange } = useGraphContext()
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

        {/* Color preview for ColorConstant */}
        {data.type === 'ColorConstant' && (
          <div className="border-t px-2 py-1.5">
            <ColorConstantPreview
              r={typeof data.params.r === 'number' ? data.params.r : 1}
              g={typeof data.params.g === 'number' ? data.params.g : 1}
              b={typeof data.params.b === 'number' ? data.params.b : 1}
              nodeId={id}
              onParamChange={onParamChange}
              rConnected={isConnected('r')}
              gConnected={isConnected('g')}
              bConnected={isConnected('b')}
            />
          </div>
        )}

        {/* Params section - inline editing (skip for ColorConstant which has custom UI) */}
        {Object.keys(def.params).length > 0 && data.type !== 'ColorConstant' && (
          <div className="border-t pt-1">
            {Object.entries(def.params).map(([paramName, paramDef]) => (
              <InlineParamEditor
                key={paramName}
                nodeId={id}
                paramName={paramName}
                paramDef={paramDef as ParamDefinition}
                value={data.params[paramName]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Color constant preview with inline color picker
interface ColorConstantPreviewProps {
  r: number
  g: number
  b: number
  nodeId: string
  onParamChange: (nodeId: string, paramName: string, value: unknown) => void
  rConnected: boolean
  gConnected: boolean
  bConnected: boolean
}

function ColorConstantPreview({
  r, g, b, nodeId, onParamChange,
  rConnected, gConnected, bConnected
}: ColorConstantPreviewProps) {
  const rInt = Math.round(r * 255)
  const gInt = Math.round(g * 255)
  const bInt = Math.round(b * 255)

  const anyConnected = rConnected || gConnected || bConnected

  const toHex = () => {
    const rHex = rInt.toString(16).padStart(2, '0')
    const gHex = gInt.toString(16).padStart(2, '0')
    const bHex = bInt.toString(16).padStart(2, '0')
    return `#${rHex}${gHex}${bHex}`
  }

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (anyConnected) return
    const hex = e.target.value
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (result) {
      onParamChange(nodeId, 'r', parseInt(result[1], 16) / 255)
      onParamChange(nodeId, 'g', parseInt(result[2], 16) / 255)
      onParamChange(nodeId, 'b', parseInt(result[3], 16) / 255)
    }
  }

  return (
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          'h-6 w-10 rounded border',
          anyConnected ? 'border-muted-foreground/30' : 'border-white/50'
        )}
        style={{ backgroundColor: `rgb(${rInt}, ${gInt}, ${bInt})` }}
      >
        {!anyConnected && (
          <input
            type="color"
            value={toHex()}
            onChange={handleColorChange}
            className="h-full w-full cursor-pointer opacity-0"
          />
        )}
      </div>
      <span className={cn(
        'text-[10px]',
        anyConnected ? 'text-muted-foreground/50' : 'text-muted-foreground'
      )}>
        {rInt}, {gInt}, {bInt}
      </span>
    </div>
  )
}

export default memo(GraphNodeComponent)
