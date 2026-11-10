import { ArrowRight } from 'lucide-react'
import { useStatus } from '@/api/queries/hooks'
import { useStudentId } from '@/app/providers/StudentProvider'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { useLearningAction } from '@/features/dashboard/useLearningAction'
import { relativeTime } from '@/lib/format'
import { BlocksOverview, CurrentSessionCard, DistributionCard, InsightsCard, KpiStrip, NeedsAttentionCard, RecentActivityCard, RecommendedNextCard } from './DashboardCards'

function Greeting() {
  const id = useStudentId()
  const status = useStatus(id)
  const action = useLearningAction()
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold md:text-3xl">Welcome back, {id}</h2>
        <p className="mt-1 text-sm text-muted">
          {status.data?.last_active_at ? `Last active ${relativeTime(status.data.last_active_at)}.` : 'Ready when you are.'}
        </p>
      </div>
      <Button size="lg" onClick={action.run} loading={action.loading} disabled={action.disabled} icon={<ArrowRight className="size-5" />}>
        {action.label}
      </Button>
      {action.error != null && <div className="w-full"><ErrorState compact error={action.error} /></div>}
    </div>
  )
}

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />
      <Greeting />
      <KpiStrip />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CurrentSessionCard />
          <RecommendedNextCard />
        </div>
        <NeedsAttentionCard />
      </div>
      <BlocksOverview />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1"><DistributionCard /></div>
        <div className="lg:col-span-2"><RecentActivityCard /></div>
      </div>
      <InsightsCard />
    </div>
  )
}
