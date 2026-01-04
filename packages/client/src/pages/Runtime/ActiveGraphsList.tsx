import { useGraphs } from '@/api'
import { useRuntimeStore } from '@/stores/runtime'

export function ActiveGraphsList() {
  const { data: graphs = [] } = useGraphs()
  const instances = useRuntimeStore((s) => s.instances)

  // Get graph name by ID
  const getGraphName = (graphId: string) =>
    graphs.find((g) => g.id === graphId)?.name ?? graphId

  const enabledInstances = instances.filter((i) => i.enabled)
  const disabledInstances = instances.filter((i) => !i.enabled)

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Active Graphs</h3>
      {instances.length === 0 ? (
        <p className="text-sm text-muted-foreground">No graphs loaded</p>
      ) : (
        <div className="space-y-2">
          {enabledInstances.map((instance) => (
            <div
              key={instance.id}
              className="flex items-center gap-2 text-sm"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
              <span>{getGraphName(instance.graphId)}</span>
              {instance.errorCount ? (
                <span className="text-xs text-red-500">
                  ({instance.errorCount} errors)
                </span>
              ) : null}
            </div>
          ))}
          {disabledInstances.map((instance) => (
            <div
              key={instance.id}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-muted" />
              <span>{getGraphName(instance.graphId)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
