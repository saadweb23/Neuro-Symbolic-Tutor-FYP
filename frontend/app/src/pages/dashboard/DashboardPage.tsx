import { ArrowRight } from 'lucide-react'
import { useStatus } from '@/api/queries/hooks'
import { useStudentId } from '@/app/providers/StudentProvider'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Reveal } from '@/components/ui/Reveal'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { useLearningAction } from '@/features/dashboard/useLearningAction'
import { relativeTime } from '@/lib/format'
import { BlocksOverview, RecommendedNextCard } from './DashboardCards'
import { ActivityTimelineCard, AiInsightsCard, BlockComparisonCard, ConsistencyCard, ContinueLearningCard, LearningOverview, MasteryDonutCard, ProgressOverTimeCard, WeeklyActivityCard } from './DashboardSections'

function Greeting() {
  const id = useStudentId()
  const status = useStatus(id)
  const action = useLearningAction()
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold md:text-3xl">Welcome back, <span className="nt-gradient-text">{id}</span></h2>
        <p className="mt-1 text-sm text-muted">
          {status.data?.last_active_at ? `Last active ${relativeTime(status.data.last_active_at)}.` : 'Ready when you are.'}
        </p>
      </div>
      <Button size="lg" magnetic onClick={action.run} loading={action.loading} disabled={action.disabled} icon={<ArrowRight className="size-5" />}>
        {action.label}
      </Button>
      {action.error != null && <div className="w-full"><ErrorState compact error={action.error} /></div>}
    </div>
  )
}

export function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" />
      <Reveal><Greeting /></Reveal>
      <LearningOverview />

      <div className="grid gap-6 xl:grid-cols-2">
        <Reveal><ContinueLearningCard /></Reveal>
        <Reveal delay={0.08}><AiInsightsCard /></Reveal>
      </div>

      <section aria-labelledby="performance-h" className="space-y-4">
        <h3 id="performance-h" className="text-base font-semibold">Learning performance</h3>
        <div className="grid gap-6 lg:grid-cols-3">
          <Reveal className="lg:col-span-2"><ProgressOverTimeCard /></Reveal>
          <Reveal delay={0.08}><MasteryDonutCard /></Reveal>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal><WeeklyActivityCard /></Reveal>
          <Reveal delay={0.08}><BlockComparisonCard /></Reveal>
        </div>
        <div className="grid gap-6 lg:grid-cols-5">
          <Reveal className="lg:col-span-3"><ConsistencyCard /></Reveal>
          <Reveal className="lg:col-span-2" delay={0.08}><ActivityTimelineCard /></Reveal>
        </div>
      </section>

      <Reveal><BlocksOverview /></Reveal>
      <Reveal><RecommendedNextCard /></Reveal>
    </div>
  )
}
