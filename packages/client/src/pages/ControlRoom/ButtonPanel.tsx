import { useRuntimeStore } from '@/stores/runtime'
import { useButtons } from '@/api'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

export function ButtonPanel() {
  const { data: buttons = [], isLoading } = useButtons()
  const buttonsDown = useRuntimeStore((s) => s.buttonsDown)
  const buttonDown = useRuntimeStore((s) => s.buttonDown)
  const buttonUp = useRuntimeStore((s) => s.buttonUp)
  const buttonPress = useRuntimeStore((s) => s.buttonPress)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">Buttons</h3>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (buttons.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">Buttons</h3>
        <div className="text-muted-foreground">
          No buttons configured.{' '}
          <Link to="/inputs" className="text-primary underline">
            Add buttons on the Inputs page.
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Buttons</h3>
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => (
          <div key={btn.id} className="flex flex-col items-center gap-2">
            <Button
              variant={buttonsDown[btn.id] ? 'default' : 'outline'}
              className="w-16 h-12 text-xs"
              title={btn.name}
              onMouseDown={() => buttonDown(btn.id)}
              onMouseUp={() => buttonUp(btn.id)}
              onMouseLeave={() => buttonsDown[btn.id] && buttonUp(btn.id)}
            >
              <span className="truncate max-w-[52px]">{btn.name}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => buttonPress(btn.id)}
            >
              Tap
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
