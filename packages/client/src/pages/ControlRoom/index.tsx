import { useEffect } from 'react'
import { wsClient } from '@/ws/connection'
import { Separator } from '@/components/ui/separator'
import { FaderPanel } from './FaderPanel'
import { ButtonPanel } from './ButtonPanel'
import { GraphsPanel } from './GraphsPanel'

export default function ControlRoomPage() {
  useEffect(() => {
    // Connect to WebSocket when entering control room
    wsClient.connect()

    return () => {
      // Optionally disconnect when leaving
      // wsClient.disconnect()
    }
  }, [])

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
    </div>
  )
}
