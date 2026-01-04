import { useRuntimeStore } from '@/stores/runtime'

export function RuntimeStatus() {
  const isConnected = useRuntimeStore((s) => s.isConnected)
  const tickHz = useRuntimeStore((s) => s.tickHz)
  const currentTime = useRuntimeStore((s) => s.currentTime)
  const instances = useRuntimeStore((s) => s.instances)

  return (
    <div className="space-y-2">
      <h3 className="font-medium">Runtime Status</h3>
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div>
          <span className="text-muted-foreground">Connection:</span>{' '}
          <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Tick Rate:</span> {tickHz} Hz
        </div>
        <div>
          <span className="text-muted-foreground">Time:</span> {currentTime.toFixed(2)}s
        </div>
        <div>
          <span className="text-muted-foreground">Instances:</span> {instances.length}
        </div>
      </div>
    </div>
  )
}
