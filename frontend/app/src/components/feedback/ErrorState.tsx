import { AlertTriangle, RotateCw } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

interface Props {
  error: unknown
  onRetry?: () => void
  title?: string
  compact?: boolean
  className?: string
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

export function ErrorState({ error, onRetry, title = 'Something went wrong', compact, className }: Props) {
  const network = error instanceof ApiError && error.kind === 'network'
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-bad/30 bg-bad-soft text-center',
        compact ? 'p-4' : 'p-8',
        className,
      )}
    >
      <AlertTriangle className="size-6 text-bad" aria-hidden />
      <p className="font-semibold text-bad">{network ? "Can't reach the server" : title}</p>
      <p className="max-w-md text-sm text-text/80">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<RotateCw className="size-4" />} onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  )
}
