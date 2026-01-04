import { useRuntimeStore } from '@/stores/runtime'
import { useFaders } from '@/api'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Link } from 'react-router-dom'

export function FaderPanel() {
  const { data: faders = [], isLoading } = useFaders()
  const faderValues = useRuntimeStore((s) => s.faders)
  const setFader = useRuntimeStore((s) => s.setFader)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">Faders</h3>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (faders.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">Faders</h3>
        <div className="text-muted-foreground">
          No faders configured.{' '}
          <Link to="/inputs" className="text-primary underline">
            Add faders on the Inputs page.
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Faders</h3>
      <div className="grid grid-cols-4 gap-4 md:grid-cols-8">
        {faders.map((fader) => (
          <div key={fader.id} className="space-y-2">
            <Label className="text-center block truncate" title={fader.name}>
              {fader.name}
            </Label>
            <div className="h-32 flex flex-col items-center justify-center">
              <Slider
                orientation="vertical"
                value={[faderValues[fader.id] ?? 0]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={([v]) => setFader(fader.id, v)}
                className="h-24"
              />
            </div>
            <div className="text-center text-xs text-muted-foreground">
              {Math.round((faderValues[fader.id] ?? 0) * 100)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
