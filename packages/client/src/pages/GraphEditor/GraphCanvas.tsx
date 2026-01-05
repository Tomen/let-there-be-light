import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type NodeTypes,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { type NodeType, NODE_DEFINITIONS, type PortType } from '@let-there-be-light/shared'
import type { GraphNode, GraphEdge } from '@let-there-be-light/shared'
import { useInputs, useGroups, useFixtures, useFaders, useButtons } from '@/api'
import GraphNodeComponent from './nodes/GraphNodeComponent'
import { GraphContext } from './GraphContext'

interface GraphCanvasProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodesChange: (nodes: GraphNode[]) => void
  onEdgesChange: (edges: GraphEdge[]) => void
  onNodeSelect: (nodeId: string | null) => void
  onParamChange: (nodeId: string, paramName: string, value: unknown) => void
  selectedNodeId: string | null
}

// Convert domain GraphNode to ReactFlow Node
function toReactFlowNode(
  node: GraphNode,
  inputNames: Record<string, string>
): Node {
  return {
    id: node.id,
    type: 'graphNode',
    position: node.position,
    data: {
      type: node.type as NodeType,
      params: node.params,
      inputNames,
    },
  }
}

// Convert ReactFlow Node back to domain GraphNode
function fromReactFlowNode(node: Node): GraphNode {
  return {
    id: node.id,
    type: node.data.type as string,
    position: { x: node.position.x, y: node.position.y },
    params: node.data.params as Record<string, unknown>,
  }
}

// Convert domain GraphEdge to ReactFlow Edge
function toReactFlowEdge(edge: GraphEdge): Edge {
  return {
    id: edge.id,
    source: edge.from.nodeId,
    sourceHandle: edge.from.port,
    target: edge.to.nodeId,
    targetHandle: edge.to.port,
  }
}

// Convert ReactFlow Edge back to domain GraphEdge
function fromReactFlowEdge(edge: Edge): GraphEdge {
  return {
    id: edge.id,
    from: {
      nodeId: edge.source,
      port: edge.sourceHandle || 'output',
    },
    to: {
      nodeId: edge.target,
      port: edge.targetHandle || 'input',
    },
  }
}

// Type compatibility check for connections
function areTypesCompatible(sourceType: PortType, targetType: PortType): boolean {
  if (sourceType === targetType) return true
  if (targetType === 'Bundle') {
    return ['Color', 'Position', 'Scalar', 'Bundle'].includes(sourceType)
  }
  return false
}

// Custom node types
const nodeTypes: NodeTypes = {
  graphNode: GraphNodeComponent,
}

export function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
  onParamChange,
  selectedNodeId,
}: GraphCanvasProps) {
  // Fetch inputs for name lookup in node previews
  const { data: inputs = [] } = useInputs()
  const inputNames = useMemo(() =>
    inputs.reduce((acc, input) => {
      acc[input.id] = input.name
      return acc
    }, {} as Record<string, string>),
    [inputs]
  )

  // Fetch data for inline param dropdowns
  const { data: groups = [] } = useGroups()
  const { data: fixtures = [] } = useFixtures()
  const { data: faders = [] } = useFaders()
  const { data: buttons = [] } = useButtons()

  // Compute connected inputs for context
  const connectedInputs = useMemo(() => {
    const set = new Set<string>()
    edges.forEach((e) => set.add(`${e.to.nodeId}:${e.to.port}`))
    return set
  }, [edges])

  // Context value for inline editing
  const graphContextValue = useMemo(() => ({
    onParamChange,
    connectedInputs,
    groups,
    fixtures,
    faders,
    buttons,
  }), [onParamChange, connectedInputs, groups, fixtures, faders, buttons])

  // Use ReactFlow's built-in state management
  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState([])
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState([])
  const { screenToFlowPosition } = useReactFlow()

  // Track whether we've initialized from props
  const initializedRef = useRef(false)
  // Track the last props we synced from to detect external changes
  const lastPropsNodesRef = useRef<string>('')
  const lastPropsEdgesRef = useRef<string>('')

  // Initialize and sync from props when they change externally
  useEffect(() => {
    const nodesJson = JSON.stringify(nodes)
    const edgesJson = JSON.stringify(edges)

    // Only sync if props actually changed (not from our own updates)
    if (nodesJson !== lastPropsNodesRef.current) {
      lastPropsNodesRef.current = nodesJson
      setRfNodes(nodes.map((n) => toReactFlowNode(n, inputNames)))
    }
    if (edgesJson !== lastPropsEdgesRef.current) {
      lastPropsEdgesRef.current = edgesJson
      setRfEdges(edges.map(toReactFlowEdge))
    }

    initializedRef.current = true
  }, [nodes, edges, inputNames, setRfNodes, setRfEdges])

  // Track dragging state
  const isDraggingRef = useRef(false)

  // Handle node changes - only sync position on drag end and removals
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onRfNodesChange>[0]) => {
      // Let ReactFlow handle all changes internally
      onRfNodesChange(changes)

      // Check for drag state
      const positionChanges = changes.filter((c) => c.type === 'position')
      if (positionChanges.length > 0) {
        const isDragging = positionChanges.some(
          (c) => c.type === 'position' && c.dragging
        )
        const wasDragging = isDraggingRef.current
        isDraggingRef.current = isDragging

        // Sync to parent when drag ends
        if (wasDragging && !isDragging) {
          setRfNodes((currentNodes) => {
            const domainNodes = currentNodes.map(fromReactFlowNode)
            lastPropsNodesRef.current = JSON.stringify(domainNodes)
            // Use setTimeout to avoid setState during render
            setTimeout(() => onNodesChange(domainNodes), 0)
            return currentNodes
          })
        }
      }

      // Handle removals immediately
      const hasRemoval = changes.some((c) => c.type === 'remove')
      if (hasRemoval) {
        setRfNodes((currentNodes) => {
          const domainNodes = currentNodes.map(fromReactFlowNode)
          lastPropsNodesRef.current = JSON.stringify(domainNodes)
          setTimeout(() => onNodesChange(domainNodes), 0)
          return currentNodes
        })
      }
    },
    [onRfNodesChange, onNodesChange, setRfNodes]
  )

  // Handle edge changes
  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onRfEdgesChange>[0]) => {
      onRfEdgesChange(changes)

      // Sync removals to parent
      const hasRemoval = changes.some((c) => c.type === 'remove')
      if (hasRemoval) {
        setRfEdges((currentEdges) => {
          const domainEdges = currentEdges.map(fromReactFlowEdge)
          lastPropsEdgesRef.current = JSON.stringify(domainEdges)
          setTimeout(() => onEdgesChange(domainEdges), 0)
          return currentEdges
        })
      }
    },
    [onRfEdgesChange, onEdgesChange, setRfEdges]
  )

  // Handle new connections
  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      if (!connection.sourceHandle || !connection.targetHandle) return

      // Validate connection
      const sourceNode = rfNodes.find((n) => n.id === connection.source)
      const targetNode = rfNodes.find((n) => n.id === connection.target)
      if (!sourceNode || !targetNode) return

      const sourceDef = NODE_DEFINITIONS[sourceNode.data.type as NodeType]
      const targetDef = NODE_DEFINITIONS[targetNode.data.type as NodeType]
      if (!sourceDef || !targetDef) return

      const sourcePort = sourceDef.outputs[connection.sourceHandle]
      const targetPort = targetDef.inputs[connection.targetHandle]
      if (!sourcePort || !targetPort) return

      if (!areTypesCompatible(sourcePort.type, targetPort.type)) {
        console.warn(`Incompatible types: ${sourcePort.type} -> ${targetPort.type}`)
        return
      }

      // Add edge and sync to parent
      setRfEdges((currentEdges) => {
        const newEdges = addEdge(connection, currentEdges)
        const domainEdges = newEdges.map(fromReactFlowEdge)
        lastPropsEdgesRef.current = JSON.stringify(domainEdges)
        setTimeout(() => onEdgesChange(domainEdges), 0)
        return newEdges
      })
    },
    [rfNodes, setRfEdges, onEdgesChange]
  )

  // Handle node click for selection
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect(node.id)
    },
    [onNodeSelect]
  )

  // Handle pane click to deselect
  const handlePaneClick = useCallback(() => {
    onNodeSelect(null)
  }, [onNodeSelect])

  // Handle drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const nodeType = event.dataTransfer.getData('application/reactflow') as NodeType
      if (!nodeType) return

      const def = NODE_DEFINITIONS[nodeType]
      if (!def) return

      // Convert screen coordinates to flow coordinates (accounts for zoom/pan)
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const params: Record<string, unknown> = {}
      for (const [key, paramDef] of Object.entries(def.params)) {
        if (paramDef.default !== undefined) {
          params[key] = paramDef.default
        }
      }

      const newRfNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: 'graphNode',
        position,
        data: {
          type: nodeType,
          params,
          inputNames,
        },
      }

      setRfNodes((currentNodes) => {
        const updatedNodes = [...currentNodes, newRfNode]
        const domainNodes = updatedNodes.map(fromReactFlowNode)
        lastPropsNodesRef.current = JSON.stringify(domainNodes)
        setTimeout(() => onNodesChange(domainNodes), 0)
        return updatedNodes
      })
    },
    [inputNames, setRfNodes, onNodesChange, screenToFlowPosition]
  )

  // Apply selection state to nodes for rendering
  const nodesWithSelection = useMemo(
    () => rfNodes.map((n) => ({ ...n, selected: n.id === selectedNodeId })),
    [rfNodes, selectedNodeId]
  )

  return (
    <GraphContext.Provider value={graphContextValue}>
      <div className="h-full w-full">
        <ReactFlow
          nodes={nodesWithSelection}
          edges={rfEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          deleteKeyCode={['Backspace', 'Delete']}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: false,
            style: { strokeWidth: 2 },
          }}
          edgesReconnectable
          edgesFocusable
        >
          <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-background"
          />
        </ReactFlow>
      </div>
    </GraphContext.Provider>
  )
}
