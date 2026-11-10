import type { ReactNode } from 'react'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from './ErrorState'

/** Every dashboard card owns its query, so one failing request shows an inline error with Retry
 *  on that card only -- never a blank page. */
export function QueryBoundary<T>({ query, children, skeleton, lines = 3 }: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown }
  children: (data: T) => ReactNode
  skeleton?: ReactNode
  lines?: number
}) {
  if (query.isPending) return <>{skeleton ?? <SkeletonCard lines={lines} />}</>
  if (query.isError) return <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
  return <>{children(query.data as T)}</>
}
