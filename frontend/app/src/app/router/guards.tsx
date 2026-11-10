import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useStatus } from '@/api/queries/hooks'
import { ErrorState } from '@/components/feedback/ErrorState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ROUTES } from '@/constants/routes'
import { AppShell } from '@/layouts/AppShell'
import { PublicLayout } from '@/layouts/PublicLayout'
import { useStudentContext } from '../providers/StudentProvider'

/** Any page that needs a student id: without one, go to onboarding. */
export function RequireStudent() {
  const { studentId } = useStudentContext()
  const location = useLocation()
  if (!studentId) return <Navigate to={ROUTES.start} replace state={{ from: location.pathname }} />
  return <Outlet />
}

function GuardSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <SkeletonCard lines={2} />
      <SkeletonCard lines={4} />
    </div>
  )
}

/** App pages need a completed placement quiz (the mastery state it seeds). The decision comes from
 *  the server (GET /status), not from localStorage, so a new browser no longer repeats placement. */
export function RequirePlacement() {
  const { studentId } = useStudentContext()
  const status = useStatus(studentId)
  if (status.isPending) return <GuardSkeleton />
  if (status.isError) return <div className="mx-auto max-w-lg p-6"><ErrorState error={status.error} onRetry={() => status.refetch()} /></div>
  if (!status.data.placement_completed) return <Navigate to={ROUTES.placement} replace />
  return <Outlet />
}

/** Help is reachable both signed-out (public frame) and signed-in (app frame). */
export function AdaptiveLayout() {
  const { studentId } = useStudentContext()
  return studentId ? <AppShell /> : <PublicLayout />
}
