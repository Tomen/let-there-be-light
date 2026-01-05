import { useEffect } from 'react'
import { wsClient } from '@/ws/connection'
import { useRuntimeStore } from '@/stores/runtime'
import { Separator } from '@/components/ui/separator'
import { FaderPanel } from './FaderPanel'
import { ButtonPanel } from './ButtonPanel'
import { GraphsPanel } from './GraphsPanel'
import { ActiveGraphsList } from '@/pages/Runtime/ActiveGraphsList'
import { PreviewPanel } from '@/pages/Runtime/PreviewPanel'

export default function ControlRoomPage() {
  const subscribeFrames = useRuntimeStore((s) => s.subscribeFrames)

  useEffect(() => {
    // Connect to WebSocket when entering control room
    wsClient.connect()

    // Subscribe to frame updates for preview
    subscribeFrames('full')

    return () => {
      // Optionally disconnect when leaving
      // wsClient.disconnect()
    }
  }, [subscribeFrames])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Control Room</h1>
        <p className="text-muted-foreground">
          Live control panel for faders, buttons, and graphs
        </p>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <FaderPanel />
          <ButtonPanel />
        </div>
        <GraphsPanel />
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <ActiveGraphsList />
        <PreviewPanel />
      </div>
    </div>
  )
}
