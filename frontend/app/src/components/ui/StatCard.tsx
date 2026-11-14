import type { ReactNode } from 'react'
import { AnimatedNumber } from '@/components/motion/AnimatedNumber'
import { TiltCard } from '@/components/motion/TiltCard'
import { Card } from './Card'
import { Skeleton } from './Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'

interface Props {
  label: string
  value?: ReactNode
  /** animate `value` as a count-up: the real number plus how to print it */
  count?: { to: number; format?: (n: number) => string }
  hint?: ReactNode
  icon?: ReactNode
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  /** shown instead of a value when there is genuinely no data yet */
  emptyText?: string
}

export function StatCard({ label, value, count, hint, icon, loading, error, onRetry, emptyText }: Props) {
  const empty = count === undefined && (value === undefined || value === null)
  return (
    <TiltCard>
    <Card interactive className="h-full p-4">
      <div className="flex items-center justify-between gap-2 text-sm text-muted">
        <span>{label}</span>
        {icon && <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} className="mt-2 !p-2" />
      ) : empty ? (
        <p className="mt-2 text-sm text-muted">{emptyText ?? 'No data yet'}</p>
      ) : (
        <>
          <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">
            {count ? <AnimatedNumber value={count.to} format={count.format} /> : value}
          </p>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </>
      )}
    </Card>
    </TiltCard>
  )
}
