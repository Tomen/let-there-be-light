import { NODE_DEFINITIONS, getCategories, getNodesByCategory, type NodeType } from '@let-there-be-light/shared'

interface NodePaletteProps {
  onAddNode: (type: NodeType) => void
}

const categoryLabels: Record<string, string> = {
  input: 'Inputs',
  constant: 'Constants',
  selection: 'Selection',
  math: 'Math',
  effect: 'Effects',
  color: 'Color',
  position: 'Position',
  bundle: 'Bundle',
  output: 'Output',
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const categories = getCategories()

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="flex h-full w-48 flex-col overflow-hidden border-r bg-background">
      <div className="border-b p-3">
        <h2 className="text-sm font-semibold">Nodes</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {categories.map((category) => {
          const nodeTypes = getNodesByCategory(category)
          return (
            <div key={category} className="mb-4">
              <div className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                {categoryLabels[category] || category}
              </div>
              <div className="space-y-1">
                {nodeTypes.map((type) => {
                  const def = NODE_DEFINITIONS[type]
                  return (
                    <div
                      key={type}
                      className="cursor-grab rounded px-2 py-1 text-sm hover:bg-accent active:cursor-grabbing"
                      draggable
                      onDragStart={(e) => onDragStart(e, type)}
                      onClick={() => onAddNode(type)}
                    >
                      {def.label}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
