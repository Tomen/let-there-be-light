import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { useGraph, useUpdateGraph, useCompileGraph } from '@/api'
import type { GraphNode, GraphEdge, NodeType, CompileResult } from '@let-there-be-light/shared'
import { NODE_DEFINITIONS } from '@let-there-be-light/shared'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Play, Save } from 'lucide-react'
import { NodePalette } from './NodePalette'
import { GraphCanvas } from './GraphCanvas'
import { NodeInspector } from './NodeInspector'
import { CompileErrorPanel } from './CompileErrorPanel'

export default function GraphEditorPage() {
  const { graphId } = useParams<{ graphId: string }>()
  const navigate = useNavigate()
  const { data: graph, isLoading, error, refetch } = useGraph(graphId ?? '')
  const updateGraph = useUpdateGraph()
  const compileGraph = useCompileGraph()

  // Local state for editing
  const [localNodes, setLocalNodes] = useState<GraphNode[]>([])
  const [localEdges, setLocalEdges] = useState<GraphEdge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Debounce save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize local state when graph loads
  useEffect(() => {
    if (graph) {
      setLocalNodes(graph.nodes)
      setLocalEdges(graph.edges)
      setIsDirty(false)
    }
  }, [graph])

  // Handle nodes change
  const handleNodesChange = useCallback((nodes: GraphNode[]) => {
    setLocalNodes(nodes)
    setIsDirty(true)
  }, [])

  // Handle edges change
  const handleEdgesChange = useCallback((edges: GraphEdge[]) => {
    setLocalEdges(edges)
    setIsDirty(true)
  }, [])

  // Handle param change from inspector
  const handleParamChange = useCallback(
    (nodeId: string, paramName: string, value: unknown) => {
      setLocalNodes((nodes) =>
        nodes.map((node) =>
          node.id === nodeId
            ? { ...node, params: { ...node.params, [paramName]: value } }
            : node
        )
      )
      setIsDirty(true)
    },
    []
  )

  // Add a new node from the palette
  const handleAddNode = useCallback((type: NodeType) => {
    const def = NODE_DEFINITIONS[type]
    if (!def) return

    // Create default params
    const params: Record<string, unknown> = {}
    for (const [key, paramDef] of Object.entries(def.params)) {
      if (paramDef.default !== undefined) {
        params[key] = paramDef.default
      }
    }

    const newNode: GraphNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 250, y: 100 + localNodes.length * 50 },
      params,
    }

    setLocalNodes((nodes) => [...nodes, newNode])
    setIsDirty(true)
  }, [localNodes.length])

  // Focus on a node (from compile errors)
  const handleFocusNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    // TODO: Also pan the canvas to the node
  }, [])

  // Save the graph
  const handleSave = useCallback(async () => {
    if (!graph || !graphId) return

    try {
      await updateGraph.mutateAsync({
        id: graphId,
        data: {
          name: graph.name,
          nodes: localNodes,
          edges: localEdges,
        },
        revision: graph.revision,
      })
      await refetch()
      setIsDirty(false)
    } catch (err) {
      console.error('Failed to save graph:', err)
      // TODO: Show toast notification
    }
  }, [graph, graphId, localNodes, localEdges, updateGraph, refetch])

  // Auto-save with debounce
  useEffect(() => {
    if (!isDirty) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSave()
    }, 1500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [isDirty, localNodes, localEdges, handleSave])

  // Compile the graph
  const handleCompile = useCallback(async () => {
    if (!graphId) return

    // Save first if dirty
    if (isDirty) {
      await handleSave()
    }

    try {
      const result = await compileGraph.mutateAsync(graphId)
      setCompileResult(result)
    } catch (err) {
      console.error('Failed to compile graph:', err)
    }
  }, [graphId, isDirty, handleSave, compileGraph])

  // Get selected node
  const selectedNode = localNodes.find((n) => n.id === selectedNodeId) ?? null

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-muted-foreground">Loading graph...</div>
      </div>
    )
  }

  if (error || !graph) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <div className="text-destructive">Graph not found</div>
        <Button variant="outline" onClick={() => navigate('/graphs')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Graphs
        </Button>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-[calc(100vh-6rem)] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/graphs')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{graph.name}</h1>
              <p className="text-xs text-muted-foreground">
                {localNodes.length} nodes, {localEdges.length} edges
                {isDirty && ' • Unsaved changes'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || updateGraph.isPending}
            >
              <Save className="mr-1 h-4 w-4" />
              Save
            </Button>
            <Button
              size="sm"
              onClick={handleCompile}
              disabled={compileGraph.isPending}
            >
              <Play className="mr-1 h-4 w-4" />
              Compile
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Node Palette */}
          <NodePalette onAddNode={handleAddNode} />

          {/* Canvas + Errors */}
          <div className="flex flex-1 flex-col">
            <div className="flex-1">
              <GraphCanvas
                nodes={localNodes}
                edges={localEdges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onNodeSelect={setSelectedNodeId}
                selectedNodeId={selectedNodeId}
              />
            </div>
            <CompileErrorPanel
              result={compileResult}
              onFocusNode={handleFocusNode}
            />
          </div>

          {/* Node Inspector */}
          <NodeInspector
            node={selectedNode}
            onParamChange={handleParamChange}
          />
        </div>
      </div>
    </ReactFlowProvider>
  )
}
