import { useEffect } from 'react'
import { useRuntimeStore } from '@/stores/runtime'
import { wsClient } from '@/ws/connection'
import { Separator } from '@/components/ui/separator'
import { RuntimeStatus } from './RuntimeStatus'
import { ActiveGraphsList } from './ActiveGraphsList'
import { PreviewPanel } from './PreviewPanel'

export default function RuntimePage() {
  const subscribeFrames = useRuntimeStore((s) => s.subscribeFrames)
  const unsubscribeFrames = useRuntimeStore((s) => s.unsubscribeFrames)
  const isConnected = useRuntimeStore((s) => s.isConnected)

  useEffect(() => {
    // Connect to WebSocket when entering runtime page
    wsClient.connect()

    return () => {
      // Optionally disconnect when leaving
      // wsClient.disconnect()
    }
  }, [])

  useEffect(() => {
    if (isConnected) {
      subscribeFrames('full')
      return () => unsubscribeFrames()
    }
  }, [isConnected, subscribeFrames, unsubscribeFrames])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Runtime</h1>
        <p className="text-muted-foreground">
          Monitoring dashboard
        </p>
      </div>

      <RuntimeStatus />

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <ActiveGraphsList />
        <PreviewPanel />
      </div>
    </div>
  )
}
