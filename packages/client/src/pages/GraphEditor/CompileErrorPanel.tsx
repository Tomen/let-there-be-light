import type { CompileResult, CompileError } from '@let-there-be-light/shared'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompileErrorPanelProps {
  result: CompileResult | null
  onFocusNode: (nodeId: string) => void
}

export function CompileErrorPanel({ result, onFocusNode }: CompileErrorPanelProps) {
  if (!result) {
    return (
      <div className="border-t p-2 text-center text-xs text-muted-foreground">
        Not compiled yet
      </div>
    )
  }

  if (result.ok) {
    return (
      <div className="flex items-center gap-2 border-t p-2">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-xs text-green-600">Compilation successful</span>
      </div>
    )
  }

  return (
    <div className="border-t">
      <div className="flex items-center gap-2 border-b bg-destructive/10 p-2">
        <XCircle className="h-4 w-4 text-destructive" />
        <span className="text-xs font-medium text-destructive">
          {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="max-h-32 overflow-y-auto">
        {result.errors.map((error, index) => (
          <ErrorItem
            key={`${error.nodeId}-${error.code}-${index}`}
            error={error}
            onFocus={() => onFocusNode(error.nodeId)}
          />
        ))}
      </div>
    </div>
  )
}

interface ErrorItemProps {
  error: CompileError
  onFocus: () => void
}

function ErrorItem({ error, onFocus }: ErrorItemProps) {
  return (
    <div
      onClick={onFocus}
      className={cn(
        'flex w-full items-start gap-2 p-2 text-left text-xs hover:bg-accent cursor-pointer',
        'border-b last:border-b-0 select-text'
      )}
    >
      <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-destructive" />
      <div>
        <div className="text-foreground">{error.message}</div>
        <div className="text-muted-foreground">
          Node: {error.nodeId}
          {error.port && ` • Port: ${error.port}`}
        </div>
      </div>
    </div>
  )
}
