import type { ReactNode } from 'react'
import { AnimatedCubeLogo } from '@/components/brand/AnimatedCubeLogo'
import { cn } from '@/lib/cn'

interface Props {
  title: string
  description?: ReactNode
  action?: ReactNode
  /** compact variant for use inside cards */
  compact?: boolean
  className?: string
}

/** An honest empty state: says why there is nothing and what will make something appear. */
export function EmptyState({ title, description, action, compact, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'gap-2 py-6' : 'gap-3 py-14', className)}>
      {!compact && <AnimatedCubeLogo size={44} motion="none" className="mb-3 opacity-80" />}
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
