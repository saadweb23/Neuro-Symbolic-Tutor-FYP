import type { ReactNode } from 'react'

/** Consistent heading block at the top of every app page. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold md:sr-only">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted md:mt-0">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
