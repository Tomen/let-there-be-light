import { useGraphs } from '@/api'
import { useRuntimeStore } from '@/stores/runtime'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function GraphsPanel() {
  const { data: graphs = [] } = useGraphs()
  const instances = useRuntimeStore((s) => s.instances)
  const compileResults = useRuntimeStore((s) => s.compileResults)
  const setInstanceEnabled = useRuntimeStore((s) => s.setInstanceEnabled)

  // Find instance for each graph
  const getInstanceForGraph = (graphId: string) =>
    instances.find((i) => i.graphId === graphId)

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Graphs</h3>
      {graphs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No graphs defined</p>
      ) : (
        <div className="space-y-3">
          {graphs.map((graph) => {
            const instance = getInstanceForGraph(graph.id)
            const isEnabled = instance?.enabled ?? false
            const compileResult = compileResults[graph.id]
            const hasErrors = compileResult && !compileResult.ok

            return (
              <div
                key={graph.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`graph-${graph.id}`}
                      className="font-medium cursor-pointer"
                    >
                      {graph.name}
                    </Label>
                    {hasErrors && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-red-500" title="Compile errors" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {graph.nodes.length} nodes
                  </p>
                </div>
                <Switch
                  id={`graph-${graph.id}`}
                  checked={isEnabled}
                  onCheckedChange={(checked) => setInstanceEnabled(graph.id, checked)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
