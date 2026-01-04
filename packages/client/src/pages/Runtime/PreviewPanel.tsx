import { useRuntimeStore } from '@/stores/runtime'
import { useFixtures } from '@/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function PreviewPanel() {
  const fixtureValues = useRuntimeStore((s) => s.fixtureValues)
  const { data: fixtures = [] } = useFixtures()

  const colorToCSS = (c?: { r: number; g: number; b: number }) =>
    c
      ? `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`
      : 'transparent'

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Preview</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fixture</TableHead>
            <TableHead>Intensity</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Pan</TableHead>
            <TableHead>Tilt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fixtures.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No fixtures defined
              </TableCell>
            </TableRow>
          ) : (
            fixtures.map((fixture) => {
              const values = fixtureValues[fixture.id]
              return (
                <TableRow key={fixture.id}>
                  <TableCell className="font-medium">{fixture.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{
                          width: `${(values?.intensity ?? 0) * 100}%`,
                          maxWidth: '100px',
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {Math.round((values?.intensity ?? 0) * 100)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div
                      className="h-6 w-6 rounded border"
                      style={{ backgroundColor: colorToCSS(values?.color) }}
                    />
                  </TableCell>
                  <TableCell className="text-xs">
                    {values?.pan?.toFixed(2) ?? '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {values?.tilt?.toFixed(2) ?? '-'}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
