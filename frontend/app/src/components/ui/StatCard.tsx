import type { ReactNode } from 'react'
import { Card } from './Card'
import { Skeleton } from './Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'

interface Props {
  label: string
  value?: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  /** shown instead of a value when there is genuinely no data yet */
  emptyText?: string
}

export function StatCard({ label, value, hint, icon, loading, error, onRetry, emptyText }: Props) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 text-sm text-muted">
        <span>{label}</span>
        {icon && <span className="text-muted/70">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} className="mt-2 !p-2" />
      ) : value === undefined || value === null ? (
        <p className="mt-2 text-sm text-muted">{emptyText ?? 'No data yet'}</p>
      ) : (
        <>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </>
      )}
    </Card>
  )
}
