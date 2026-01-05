import { useGraphs, useFixtures } from '@/api'
import { useRuntimeStore } from '@/stores/runtime'
import type { WriteOutputInfo, AttributeBundle, InstanceStatus } from '@let-there-be-light/shared'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const colorToCSS = (c?: { r: number; g: number; b: number }) =>
  c
    ? `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`
    : 'transparent'

// Component to display WriteAttributes outputs as a table
function WriteOutputsTable({ writes }: { writes: WriteOutputInfo[] }) {
  const { data: fixtures = [] } = useFixtures()

  // Get fixture name by ID
  const getFixtureName = (fixtureId: string) =>
    fixtures.find((f) => f.id === fixtureId)?.name ?? fixtureId

  // Collect all unique fixture IDs across all writes
  const allFixtureIds = [...new Set(writes.flatMap((w) => w.selection))]

  if (allFixtureIds.length === 0) {
    return (
      <p className="ml-4 text-xs text-muted-foreground">No fixtures selected</p>
    )
  }

  // For each fixture, find the write that affects it (highest priority wins)
  const fixtureWrites = new Map<string, { bundle: Partial<AttributeBundle>; priority: number }>()
  for (const write of writes) {
    for (const fixtureId of write.selection) {
      const existing = fixtureWrites.get(fixtureId)
      if (!existing || write.priority > existing.priority) {
        fixtureWrites.set(fixtureId, { bundle: write.bundle, priority: write.priority })
      }
    }
  }

  return (
    <div className="ml-4 mt-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 text-xs">Fixture</TableHead>
            <TableHead className="h-8 text-xs">Intensity</TableHead>
            <TableHead className="h-8 text-xs">Color</TableHead>
            <TableHead className="h-8 text-xs">Pan</TableHead>
            <TableHead className="h-8 text-xs">Tilt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allFixtureIds.map((fixtureId) => {
            const data = fixtureWrites.get(fixtureId)
            const bundle = data?.bundle ?? {}
            return (
              <TableRow key={fixtureId}>
                <TableCell className="py-1 text-xs font-medium">
                  {getFixtureName(fixtureId)}
                </TableCell>
                <TableCell className="py-1">
                  {bundle.intensity !== undefined ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{
                          width: `${bundle.intensity * 100}%`,
                          maxWidth: '60px',
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {Math.round(bundle.intensity * 100)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="py-1">
                  {bundle.color ? (
                    <div
                      className="h-5 w-5 rounded border"
                      style={{ backgroundColor: colorToCSS(bundle.color) }}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="py-1 text-xs">
                  {bundle.pan?.toFixed(2) ?? '-'}
                </TableCell>
                <TableCell className="py-1 text-xs">
                  {bundle.tilt?.toFixed(2) ?? '-'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// Component to display a single graph instance
function GraphInstance({ instance, graphName }: { instance: InstanceStatus; graphName: string }) {
  const hasWrites = instance.writes && instance.writes.length > 0

  // Get the highest priority from all writes (or undefined if no writes)
  const maxPriority = hasWrites
    ? Math.max(...instance.writes!.map((w) => w.priority))
    : undefined

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
        <span className="font-medium">{graphName}</span>
        {maxPriority !== undefined && (
          <span className="text-xs text-muted-foreground">
            (priority: {maxPriority})
          </span>
        )}
        {instance.errorCount ? (
          <span className="text-xs text-red-500">
            ({instance.errorCount} errors)
          </span>
        ) : null}
      </div>
      {hasWrites ? (
        <WriteOutputsTable writes={instance.writes!} />
      ) : (
        <p className="ml-4 mt-2 text-xs text-muted-foreground">
          No WriteAttributes outputs
        </p>
      )}
    </div>
  )
}

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
        <div className="space-y-3">
          {enabledInstances.map((instance) => (
            <GraphInstance
              key={instance.id}
              instance={instance}
              graphName={getGraphName(instance.graphId)}
            />
          ))}
          {disabledInstances.map((instance) => (
            <div
              key={instance.id}
              className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-muted" />
              <span>{getGraphName(instance.graphId)}</span>
              <span className="text-xs">(disabled)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
