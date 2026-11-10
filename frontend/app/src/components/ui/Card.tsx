import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border bg-surface shadow-card', className)} {...rest} />
}

export function CardHeader({ title, description, action, className }: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 p-5 pb-0', className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export const CardBody = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-5', className)} {...rest} />
)
