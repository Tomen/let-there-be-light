import { useStatusStore } from '@/stores/status'
import { cn } from '@/lib/utils'
import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
}

const styleMap = {
  info: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  success: 'bg-green-500/10 text-green-600 border-green-500/20',
  warning: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  error: 'bg-red-500/10 text-red-600 border-red-500/20',
}

export function StatusBar() {
  const message = useStatusStore((s) => s.currentMessage)

  // Default to "Ready" state when no message
  const displayMessage = message ?? { type: 'info' as const, message: 'Ready' }
  const Icon = iconMap[displayMessage.type]

  return (
    <div
      className={cn(
        'border-t',
        'flex items-center px-4 py-2',
        styleMap[displayMessage.type]
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm">{displayMessage.message}</span>
      </div>
    </div>
  )
}
