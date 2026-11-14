import { Activity, ArrowRight, BookOpenCheck, CheckCircle2, CircleDashed, Clock, Flame, Lightbulb, ListChecks, Play, Sparkles, Target, TrendingUp, TriangleAlert, Trophy } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { useAnalytics, useBlocks, useConcepts, useHistory, useMastery, useRecommendation, useSession, useSummary, useTrajectory } from '@/api/queries/hooks'
import { useMetaConfig, useTierFor } from '@/app/providers/MetaProvider'
import { useStudentId } from '@/app/providers/StudentProvider'
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap'
import { DonutChart } from '@/components/charts/DonutChart'
import { TierBadge } from '@/components/domain/TierBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { AnimatedNumber } from '@/components/motion/AnimatedNumber'
import { Stagger, StaggerItem } from '@/components/motion/Stagger'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ChartCard, DataTable } from '@/components/ui/ChartCard'
import { RadialProgress } from '@/components/ui/RadialProgress'
import { StatCard } from '@/components/ui/StatCard'
import { ROUTES } from '@/constants/routes'
import { activityHeat, lastDays } from '@/features/analytics/weekly'
import { strongestBlock, studyTips, topImprovements } from '@/features/dashboard/aiInsights'
import { averageBelief, countTiers } from '@/features/dashboard/tiers'
import { useLearningAction } from '@/features/dashboard/useLearningAction'
import { useChartMotion } from '@/hooks/useChartMotion'
import { AXIS, GRID, LEVEL_COLORS, TIP } from '@/lib/chartTheme'
import { cn } from '@/lib/cn'
import { formatDuration, plural, relativeTime } from '@/lib/format'
import { pct } from '@/lib/tiers'

// ------------------------------------------------------------------ learning overview
export function LearningOverview() {
  const id = useStudentId()
  const mastery = useMastery(id)
  const summary = useSummary(id)
  const tierFor = useTierFor()
  const { concept_count } = useMetaConfig()
  const s = summary.data
  const counts = mastery.data ? countTiers(mastery.data, tierFor) : undefined
  const err = { error: mastery.error ?? summary.error, onRetry: () => { void mastery.refetch(); void summary.refetch() } }
  const loading = mastery.isPending || summary.isPending
  const activities = s ? s.answered_questions + s.videos_viewed + s.deep_dives_read : undefined

  return (
    <section aria-labelledby="overview-h">
      <h3 id="overview-h" className="mb-3 text-base font-semibold">Learning overview</h3>
      <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6" gap={0.06}>
        <StaggerItem><StatCard tone="primary" label="Concepts studied" icon={<BookOpenCheck className="size-4" />} loading={loading} {...err}
          value={s ? `${s.concepts_attempted}/${concept_count}` : undefined} count={s ? { to: s.concepts_attempted, format: (n) => `${Math.round(n)}/${concept_count}` } : undefined} hint="with at least one answer" /></StaggerItem>
        <StaggerItem><StatCard tone="good" label="Mastered" icon={<CheckCircle2 className="size-4" />} loading={loading} {...err}
          value={counts?.mastered} count={counts ? { to: counts.mastered } : undefined} hint="strong concepts" /></StaggerItem>
        <StaggerItem><StatCard tone="mid" label="Learning" icon={<CircleDashed className="size-4" />} loading={loading} {...err}
          value={counts?.developing} count={counts ? { to: counts.developing } : undefined} hint="partly understood" /></StaggerItem>
        <StaggerItem><StatCard tone="bad" label="Need improvement" icon={<TriangleAlert className="size-4" />} loading={loading} {...err}
          value={counts?.weak} count={counts ? { to: counts.weak } : undefined} hint="weak concepts" /></StaggerItem>
        <StaggerItem><StatCard tone="accent" label="Time answering" icon={<Clock className="size-4" />} loading={loading} {...err}
          value={s ? formatDuration(s.answering_time_seconds) : undefined} hint={s ? `${plural(s.active_days, 'active day')}` : undefined} /></StaggerItem>
        <StaggerItem><StatCard tone="violet" label="Activities done" icon={<ListChecks className="size-4" />} loading={loading} {...err}
          value={activities} count={activities !== undefined ? { to: activities } : undefined} hint={s ? `${s.answered_questions} answers · ${s.videos_viewed + s.deep_dives_read} lessons` : undefined} /></StaggerItem>
      </Stagger>
    </section>
  )
}

// ------------------------------------------------------------------ continue learning
export function ContinueLearningCard() {
  const id = useStudentId()
  const history = useHistory(id, {}, 12)
  const session = useSession(id)
  const rec = useRecommendation(id)
  const blocks = useBlocks(id)
  const mastery = useMastery(id)
  const action = useLearningAction()
  const items = history.data?.pages[0]?.items ?? []
  const recent = [...new Map(items.map((i) => [i.concept, i])).values()].slice(0, 4)
  const last = items[0]
  const next = rec.data?.candidates[0]
  const avg = mastery.data ? averageBelief(mastery.data) : 0
  const done = blocks.data?.filter((b) => b.complete).length ?? 0
  const kind = { video: 'video lesson', practice_problem: 'practice question', escalation: 'documentation deep-dive' } as const

  return (
    <Card className="h-full overflow-hidden">
      <div aria-hidden className="h-1 w-full" style={{ background: 'var(--grad-brand)' }} />
      <CardHeader title="Continue learning" description="Pick up where you left off." />
      <CardBody className="space-y-5">
        <div className="rounded-xl bg-primary-soft/60 p-4">
          <div className="flex items-center gap-4">
            <RadialProgress value={avg} size={72} stroke={8} label="Overall mastery">
              <span className="text-sm font-bold tabular-nums">{pct(avg)}</span>
            </RadialProgress>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Learning progress</p>
              <p className="text-muted">{done} of {blocks.data?.length ?? 5} blocks complete</p>
              {session.data?.active && <p className="mt-0.5 text-xs text-muted">Session: round {session.data.round_count} of {session.data.round_cap}</p>}
            </div>
          </div>
          <Button className="mt-4 w-full" onClick={action.run} loading={action.loading} disabled={action.disabled} icon={<Play className="size-4" />}>
            Continue learning
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Last completed lesson</h4>
            {last ? (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-semibold">{last.concept}</p>
                <p className="mt-0.5 text-xs text-muted">{last.content_type === 'video' ? 'Watched a video' : last.content_type === 'deep_dive' ? 'Read the documentation' : last.passed ? 'Answered correctly' : 'Answered incorrectly'} · {relativeTime(last.at)}</p>
              </div>
            ) : <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">Nothing yet. Your first lesson will appear here.</p>}
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recommended next</h4>
            {next ? (
              <div className="rounded-lg border border-primary/30 bg-primary-soft/40 p-3 text-sm">
                <p className="font-semibold">{next.concept}</p>
                <p className="mt-0.5 text-xs text-muted">A {kind[next.predicted_content_type]} · {rec.data?.block_name}</p>
              </div>
            ) : <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">{rec.data?.state === 'complete' ? 'Every concept is at target.' : 'Choose a focus area to get a recommendation.'}</p>}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recently studied</h4>
          {recent.length ? (
            <ul className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <li key={r.concept}><Link to={`${ROUTES.mastery}?view=list&concept=${encodeURIComponent(r.concept)}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm transition-colors hover:border-primary/40 hover:bg-primary-soft">{r.concept}<span className="text-xs text-muted">{relativeTime(r.at)}</span></Link></li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Topics you study will be listed here.</p>}
        </div>
      </CardBody>
    </Card>
  )
}

// ------------------------------------------------------------------ AI learning insights
function InsightBlock({ icon: Icon, tone, title, children }: { icon: typeof Lightbulb; tone: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <h4 className={cn('mb-2 flex items-center gap-2 text-sm font-semibold', tone)}><Icon className="size-4" aria-hidden />{title}</h4>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  )
}

export function AiInsightsCard() {
  const id = useStudentId()
  const analytics = useAnalytics(id, null)
  const concepts = useConcepts(id)
  const rec = useRecommendation(id)
  const tierFor = useTierFor()

  return (
    <Card className="h-full">
      <CardHeader title={<span className="inline-flex items-center gap-2"><Sparkles className="size-4 text-primary" aria-hidden />Your AI learning insights</span>}
        description="Worked out from your own answers and mastery estimates. Nothing here is generated text." />
      <CardBody>
        <QueryBoundary query={{ ...analytics, isPending: analytics.isPending || concepts.isPending, isError: analytics.isError || concepts.isError, error: analytics.error ?? concepts.error, refetch: () => { void analytics.refetch(); void concepts.refetch() } }} lines={5}>
          {() => {
            const a = analytics.data!
            const all = concepts.data!
            const best = strongestBlock(a.blocks)
            const tips = studyTips(all, tierFor, 3)
            const gains = topImprovements(a.concepts)
            const next = rec.data?.candidates[0]
            if (a.activity.length === 0 && !best) return <EmptyState compact title="Not enough data yet" description="Insights appear after you answer a few questions." />
            return (
              <Stagger inView className="grid gap-3 sm:grid-cols-2" gap={0.08}>
                <StaggerItem>
                  <InsightBlock icon={Trophy} tone="text-good" title="Strongest subject">
                    {best ? <><p className="text-base font-semibold">{best.name}</p><p className="text-muted">{pct(best.average)} average mastery across its concepts.</p></> : <p className="text-muted">Answer questions in a block to see your strongest one.</p>}
                  </InsightBlock>
                </StaggerItem>
                <StaggerItem>
                  <InsightBlock icon={TriangleAlert} tone="text-bad" title="Needs more attention">
                    {tips.length ? <ul className="space-y-1">{tips.map((t) => <li key={t.concept} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><span className="font-medium">{t.concept}</span><TierBadge belief={t.belief} /></li>)}</ul> : <p className="text-muted">Every concept is at the strong level.</p>}
                  </InsightBlock>
                </StaggerItem>
                <StaggerItem>
                  <InsightBlock icon={TrendingUp} tone="text-primary" title="Recent improvements">
                    {gains.length ? gains.map((g) => <p key={g.concept}><span className="font-medium">{g.concept}</span> <span className="text-good">+{Math.round(g.delta * 100)} pts</span> <span className="text-muted">({pct(g.first_belief)} to {pct(g.current_belief)})</span></p>) : <p className="text-muted">No concept has moved much yet. Keep practising.</p>}
                  </InsightBlock>
                </StaggerItem>
                <StaggerItem>
                  <InsightBlock icon={Target} tone="text-accent" title="Suggested next activity">
                    {next ? <><p className="font-semibold">{next.concept}</p><p className="text-muted">{next.explanation}</p></> : <p className="text-muted">{rec.data?.state === 'complete' ? 'You have reached the target everywhere.' : 'Choose a focus area to get a suggestion.'}</p>}
                  </InsightBlock>
                </StaggerItem>
                {tips.length > 0 && (
                  <StaggerItem className="sm:col-span-2">
                    <InsightBlock icon={Lightbulb} tone="text-mid" title="Personalised study recommendations">
                      <ul className="space-y-1.5">{tips.map((t) => <li key={t.concept} className="flex gap-2"><ArrowRight className="mt-0.5 size-4 shrink-0 text-mid" aria-hidden /><span>{t.text}</span></li>)}</ul>
                    </InsightBlock>
                  </StaggerItem>
                )}
              </Stagger>
            )
          }}
        </QueryBoundary>
      </CardBody>
    </Card>
  )
}

// ------------------------------------------------------------------ charts
export function MasteryDonutCard() {
  const id = useStudentId()
  const mastery = useMastery(id)
  const tierFor = useTierFor()
  const { concept_count } = useMetaConfig()
  return (
    <Card className="h-full">
      <CardHeader title="Mastery distribution" description={`How your ${concept_count} concepts split by level.`} />
      <CardBody>
        <QueryBoundary query={mastery}>
          {(m) => {
            const c = countTiers(m, tierFor)
            const data = [
              { name: 'Strong', value: c.mastered, color: LEVEL_COLORS.strong },
              { name: 'Intermediate', value: c.developing, color: LEVEL_COLORS.intermediate },
              { name: 'Weak', value: c.weak, color: LEVEL_COLORS.weak },
            ]
            return (
              <div className="flex flex-col items-center gap-5">
                <DonutChart data={data} size={170} unit=" concepts" label={data.map((d) => `${d.name}: ${d.value}`).join(', ')}
                  center={<div><p className="font-display text-3xl font-bold tabular-nums">{pct(averageBelief(m))}</p><p className="text-xs text-muted">average</p></div>} />
                <ul className="w-full space-y-2.5">
                  {data.map((d) => (
                    <li key={d.name} className="flex items-center gap-2.5 text-sm">
                      <span className="size-3 rounded-full" style={{ background: d.color }} aria-hidden />
                      <span className="flex-1">{d.name}</span>
                      <span className="font-semibold tabular-nums"><AnimatedNumber value={d.value} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          }}
        </QueryBoundary>
      </CardBody>
    </Card>
  )
}

export function ProgressOverTimeCard() {
  const id = useStudentId()
  const traj = useTrajectory(id)
  const motion = useChartMotion()
  return (
    <QueryBoundary query={traj} lines={5}>
      {(t) => {
        const data = [{ n: 0, mastery: Math.round(t.initial.average * 1000) / 10 }, ...t.steps.map((s, i) => ({ n: i + 1, mastery: Math.round(s.average * 1000) / 10 }))]
        const first = data[0]!.mastery
        const last = data[data.length - 1]!.mastery
        return (
          <ChartCard
            title="Learning progress over time"
            description="Your average mastery estimate after each interaction."
            summary={`Average mastery moved from ${first}% to ${last}% over ${t.steps.length} interactions.`}
            chart={
              t.steps.length < 2 ? <EmptyState compact title="Not enough activity yet" description="The line appears after a few interactions." /> : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="progress-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...GRID} vertical={false} />
                      <XAxis dataKey="n" tick={AXIS} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
                      <Tooltip {...TIP} formatter={(v) => [`${v}%`, 'Average mastery']} labelFormatter={(l) => (l === 0 ? 'Start' : `Interaction ${l}`)} />
                      <Area type="monotone" dataKey="mastery" stroke="var(--primary)" strokeWidth={2.5} fill="url(#progress-fill)" dot={false} activeDot={{ r: 5 }} {...motion} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )
            }
            table={<DataTable head={['Interaction', 'Average mastery']} rows={data.map((d) => [d.n === 0 ? 'Start' : d.n, `${d.mastery}%`])} />}
          />
        )
      }}
    </QueryBoundary>
  )
}

export function WeeklyActivityCard() {
  const id = useStudentId()
  const analytics = useAnalytics(id, null)
  const motion = useChartMotion()
  return (
    <QueryBoundary query={analytics} lines={5}>
      {(a) => {
        const days = lastDays(a.activity, 7)
        const total = days.reduce((x, d) => x + d.answered + d.lessons, 0)
        return (
          <ChartCard
            title="Weekly learning activity"
            description="Questions answered and lessons viewed in the last 7 days."
            summary={`${total} activities in the last 7 days.`}
            chart={
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={days} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...GRID} vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                    <Tooltip {...TIP} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="answered" name="Questions" stackId="a" fill="var(--accent)" {...motion} />
                    <Bar dataKey="lessons" name="Lessons" stackId="a" fill="var(--block-3)" radius={[6, 6, 0, 0]} {...motion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            }
            table={<DataTable head={['Day', 'Questions', 'Lessons', 'Minutes answering']} rows={days.map((d) => [d.date, d.answered, d.lessons, d.minutes])} />}
          />
        )
      }}
    </QueryBoundary>
  )
}

export function BlockComparisonCard() {
  const id = useStudentId()
  const analytics = useAnalytics(id, null)
  const motion = useChartMotion()
  return (
    <QueryBoundary query={analytics} lines={5}>
      {(a) => {
        const data = a.blocks.map((b) => ({ name: b.name, accuracy: b.accuracy === null ? null : Math.round(b.accuracy * 100), mastery: Math.round(b.current_average * 100) }))
        return (
          <ChartCard
            title="Performance by subject"
            description="Answer accuracy versus current mastery estimate in each block."
            summary={data.map((d) => `${d.name}: mastery ${d.mastery}%, accuracy ${d.accuracy ?? 'no answers'}`).join('; ')}
            chart={
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...GRID} vertical={false} />
                    <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} interval={0} tickFormatter={(v: string) => (v.length > 11 ? `${v.slice(0, 10)}…` : v)} />
                    <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
                    <Tooltip {...TIP} formatter={(v) => (v === null ? 'no answers' : `${v}%`)} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="accuracy" name="Accuracy" fill="var(--accent)" radius={[6, 6, 0, 0]} {...motion} />
                    <Bar dataKey="mastery" name="Mastery" fill="var(--primary)" radius={[6, 6, 0, 0]} {...motion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            }
            table={<DataTable head={['Block', 'Accuracy', 'Mastery']} rows={data.map((d) => [d.name, d.accuracy === null ? 'no answers' : `${d.accuracy}%`, `${d.mastery}%`])} />}
          />
        )
      }}
    </QueryBoundary>
  )
}

export function ConsistencyCard() {
  const id = useStudentId()
  const analytics = useAnalytics(id, null)
  const summary = useSummary(id)
  return (
    <Card className="h-full">
      <CardHeader title={<span className="inline-flex items-center gap-2"><Flame className="size-4 text-mid" aria-hidden />Learning streak</span>}
        description={summary.data ? `${summary.data.current_streak_days}-day current streak · best ${summary.data.longest_streak_days}` : undefined} />
      <CardBody>
        <QueryBoundary query={analytics} lines={4}>{(a) => <CalendarHeatmap days={activityHeat(a.activity)} weeks={18} unit="activities" />}</QueryBoundary>
      </CardBody>
    </Card>
  )
}

const DOT = (passed: boolean | null) => (passed === null ? 'bg-primary' : passed ? 'bg-good' : 'bg-bad')

export function ActivityTimelineCard() {
  const id = useStudentId()
  const history = useHistory(id, {}, 6)
  const items = history.data?.pages[0]?.items
  return (
    <Card className="h-full">
      <CardHeader title={<span className="inline-flex items-center gap-2"><Activity className="size-4 text-primary" aria-hidden />Recent activity</span>}
        action={<Link to={ROUTES.history} className="text-sm font-medium text-primary hover:underline">View all</Link>} />
      <CardBody>
        <QueryBoundary query={{ ...history, data: items }}>
          {(rows) =>
            rows && rows.length > 0 ? (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {rows.map((r) => {
                  const delta = Math.round((r.belief_after - r.belief_before) * 100)
                  return (
                    <li key={r.step_index} className="relative">
                      <span className={cn('absolute -left-[26px] top-1.5 size-3 rounded-full ring-4 ring-surface', DOT(r.passed))} aria-hidden />
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm font-semibold">{r.concept}</p>
                        <time dateTime={r.at} className="text-xs text-muted">{relativeTime(r.at)}</time>
                      </div>
                      <p className="text-xs text-muted">
                        {r.content_type === 'video' ? 'Watched a video' : r.content_type === 'deep_dive' ? 'Read the documentation' : r.passed ? 'Answered correctly' : 'Answered incorrectly'}
                        {delta !== 0 && <span className={delta > 0 ? 'text-good' : 'text-bad'}> · {delta > 0 ? '+' : ''}{delta} pts</span>}
                      </p>
                    </li>
                  )
                })}
              </ol>
            ) : <EmptyState compact title="Nothing yet" description="Your answers and lessons will appear here after your first session." />
          }
        </QueryBoundary>
      </CardBody>
    </Card>
  )
}

