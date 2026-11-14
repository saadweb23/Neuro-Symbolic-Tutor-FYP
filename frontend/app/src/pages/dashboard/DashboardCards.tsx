import { ArrowRight, Flame, Gauge, Layers, Target, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts'
import { useAnalytics, useBlocks, useConcepts, useGraph, useHistory, useMastery, useRecommendation, useSession, useSummary } from '@/api/queries/hooks'
import { useMetaConfig, useTierFor } from '@/app/providers/MetaProvider'
import { useStudentId } from '@/app/providers/StudentProvider'
import { AnimatedNumber } from '@/components/motion/AnimatedNumber'
import { Stagger, StaggerItem } from '@/components/motion/Stagger'
import { ActivityRow } from '@/components/domain/ActivityRow'
import { BlockCard, blockStatus } from '@/components/domain/BlockCard'
import { TierBadge } from '@/components/domain/TierBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { Badge } from '@/components/ui/Badge'
import { Button, LinkButton } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { RadialProgress } from '@/components/ui/RadialProgress'
import { StatCard } from '@/components/ui/StatCard'
import { ROUTES } from '@/constants/routes'
import { buildInsights } from '@/features/analytics/insights'
import { averageBelief, countTiers, weakestConcepts } from '@/features/dashboard/tiers'
import { useLearningAction } from '@/features/dashboard/useLearningAction'
import { formatDuration, plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { TIER_STYLES, pct } from '@/lib/tiers'

// ------------------------------------------------------------------ KPI strip
export function KpiStrip() {
  const id = useStudentId()
  const mastery = useMastery(id)
  const blocks = useBlocks(id)
  const summary = useSummary(id)
  const tierFor = useTierFor()
  const { concept_count, block_count } = useMetaConfig()

  const avg = mastery.data ? averageBelief(mastery.data) : undefined
  const counts = mastery.data ? countTiers(mastery.data, tierFor) : undefined
  const done = blocks.data?.filter((b) => b.complete).length
  const s = summary.data

  return (
    <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-5" delay={0.15} gap={0.08}>
      <StaggerItem className="col-span-2 lg:col-span-1">
      <Card interactive className="flex h-full items-center gap-4 p-4">
        {mastery.isPending ? (
          <div className="nt-skeleton size-20 rounded-full" />
        ) : (
          <RadialProgress value={avg ?? 0} size={80} stroke={8} label="Overall estimated mastery">
            <span className="font-display text-lg font-semibold tabular-nums">{avg !== undefined ? <AnimatedNumber value={Math.round(avg * 100)} format={(n) => `${Math.round(n)}%`} /> : '–'}</span>
          </RadialProgress>
        )}
        <div className="text-sm">
          <p className="font-medium">Overall mastery</p>
          <p className="text-xs text-muted">estimated across {concept_count} concepts</p>
        </div>
      </Card>
      </StaggerItem>
      <StaggerItem><StatCard label="Concepts mastered" icon={<Target className="size-4" />} loading={mastery.isPending} error={mastery.error} onRetry={() => void mastery.refetch()}
        value={counts ? `${counts.mastered}/${concept_count}` : undefined} count={counts ? { to: counts.mastered, format: (n) => `${Math.round(n)}/${concept_count}` } : undefined} hint={counts ? `${counts.developing} developing · ${counts.weak} need work` : undefined} /></StaggerItem>
      <StaggerItem><StatCard label="Blocks complete" icon={<Layers className="size-4" />} loading={blocks.isPending} error={blocks.error} onRetry={() => void blocks.refetch()}
        value={done !== undefined ? `${done}/${block_count}` : undefined} count={done !== undefined ? { to: done, format: (n) => `${Math.round(n)}/${block_count}` } : undefined} hint="meets the target and has real answers" /></StaggerItem>
      <StaggerItem><StatCard label="Questions answered" icon={<Gauge className="size-4" />} loading={summary.isPending} error={summary.error} onRetry={() => void summary.refetch()}
        value={s ? s.answered_questions : undefined} count={s ? { to: s.answered_questions } : undefined}
        hint={s ? (s.accuracy === null ? 'no answers yet' : `${pct(s.accuracy)} correct · ${formatDuration(s.answering_time_seconds)} answering`) : undefined} />
      </StaggerItem>
      <StaggerItem><StatCard label="Day streak" icon={<Flame className="size-4" />} loading={summary.isPending} error={summary.error} onRetry={() => void summary.refetch()}
        value={s ? s.current_streak_days : undefined} count={s ? { to: s.current_streak_days } : undefined} hint={s ? `${plural(s.active_days, 'active day')} · best ${s.longest_streak_days}` : undefined} /></StaggerItem>
    </Stagger>
  )
}

// ------------------------------------------------------------------ current session
export function CurrentSessionCard() {
  const id = useStudentId()
  const session = useSession(id)
  const blocks = useBlocks(id)
  const { mastery_threshold } = useMetaConfig()
  const action = useLearningAction()

  return (
    <Card>
      <CardHeader title="Current session" />
      <CardBody>
        <QueryBoundary query={session}>
          {(s) => {
            if (!s.active) {
              return <EmptyState compact title="No active session" description="Pick a focus area to start one. Your progress in every block is always saved." action={<Button size="sm" onClick={action.run} loading={action.loading} disabled={action.disabled}>{action.label}</Button>} />
            }
            const block = blocks.data?.[s.block_index]
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{block?.name ?? `Block ${s.block_index + 1}`}</p>
                    <p className="text-sm text-muted">Round {s.round_count} of {s.round_cap}</p>
                  </div>
                  <Button onClick={action.run} icon={<ArrowRight className="size-4" />}>Resume</Button>
                </div>
                <ProgressBar value={s.round_count / s.round_cap} label="Session rounds used" />
                {block && (
                  <>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{pct(block.average_mastery)} average mastery</span>
                      <span className="text-xs text-muted">target {pct(mastery_threshold)}</span>
                    </div>
                    <ProgressBar value={block.average_mastery} target={mastery_threshold} label="Block average mastery" />
                    <p className="text-xs text-muted">Weakest: <span className="font-medium text-text">{block.weakest_concept}</span> ({pct(block.weakest_belief)})</p>
                  </>
                )}
              </div>
            )
          }}
        </QueryBoundary>
      </CardBody>
    </Card>
  )
}

// ------------------------------------------------------------------ recommended next (PREVIEW)
const TYPE_LABEL = { video: 'Video', practice_problem: 'Practice question', escalation: 'Docs deep-dive' } as const

export function RecommendedNextCard() {
  const id = useStudentId()
  const rec = useRecommendation(id)
  const action = useLearningAction()
  return (
    <Card>
      <CardHeader title="Likely next" description="A read-only preview of the tutoring agent's current preference. It does not use up a round." />
      <CardBody>
        <QueryBoundary query={rec} lines={4}>
          {(r) => {
            if (r.state === 'complete') return <EmptyState compact title="Curriculum complete" description="Every concept clears the target. Review your mastery map for anything worth another look." />
            if (r.state === 'block_complete') return <EmptyState compact title={`${r.block_name} is complete`} description="Choose another focus area to keep going." action={<LinkButton to={ROUTES.learn} size="sm">Choose a focus area</LinkButton>} />
            if (r.state === 'session_paused') return <EmptyState compact title="Session paused" description={`You have used all rounds in ${r.block_name}. Resume to extend it, or switch focus.`} action={<Button size="sm" onClick={action.run}>{action.label}</Button>} />
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  {r.suggested ? <>Suggested focus area: <strong className="text-text">{r.block_name}</strong> (your lowest incomplete block). </> : <>In <strong className="text-text">{r.block_name}</strong>. </>}
                  The agent is most inclined to pick:
                </p>
                <ul className="space-y-3">
                  {r.candidates.map((c, i) => (
                    <li key={c.concept} className={cn('rounded-lg border p-3.5', i === 0 ? 'border-primary/40 bg-primary-soft/50' : 'border-border')}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{c.concept}</span>
                        <span className="flex items-center gap-2"><Badge tone="primary">{TYPE_LABEL[c.predicted_content_type]}</Badge><TierBadge belief={c.belief} /></span>
                      </div>
                      <p className="mt-1.5 text-sm text-muted">{c.explanation}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                        <span className="w-28 shrink-0">agent preference</span>
                        <ProgressBar value={c.probability} className="h-1.5" label={`Agent preference for ${c.concept}`} />
                        <span className="w-9 text-right tabular-nums">{pct(c.probability)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted">{r.note}</p>
              </div>
            )
          }}
        </QueryBoundary>
      </CardBody>
    </Card>
  )
}

// ------------------------------------------------------------------ needs attention
export function NeedsAttentionCard() {
  const id = useStudentId()
  const mastery = useMastery(id)
  const graph = useGraph()
  const tierFor = useTierFor()
  return (
    <Card className="h-full">
      <CardHeader title="Needs attention" description="Your three lowest estimates right now." />
      <CardBody>
        <QueryBoundary query={mastery}>
          {(m) => (
            <>
            <ul className="space-y-4">
              {weakestConcepts(m, 3).map(([concept, belief]) => {
                const block = graph.data?.blocks.find((b) => b.concepts.includes(concept))
                const s = TIER_STYLES[tierFor(belief)]
                return (
                  <li key={concept}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{concept}</span>
                      <span className={cn('text-sm font-semibold tabular-nums', s.text)}>{pct(belief)}</span>
                    </div>
                    <ProgressBar value={belief} barClassName={s.solid} className="mt-1.5 h-1.5" label={`${concept} mastery`} />
                    {block && <p className="mt-1 text-xs text-muted">in {block.name}</p>}
                  </li>
                )
              })}
            </ul>
            <Link to={ROUTES.mastery} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">See all concepts <ArrowRight className="size-3.5" aria-hidden /></Link>
            </>
          )}
        </QueryBoundary>
      </CardBody>
    </Card>
  )
}

// ------------------------------------------------------------------ block overview
export function BlocksOverview() {
  const id = useStudentId()
  const blocks = useBlocks(id)
  const concepts = useConcepts(id)
  const session = useSession(id)
  const rec = useRecommendation(id)
  return (
    <section aria-labelledby="blocks-h">
      <div className="mb-3 flex items-center justify-between">
        <h3 id="blocks-h" className="text-base font-semibold">Learning blocks</h3>
        <Link to={ROUTES.learn} className="text-sm font-medium text-primary hover:underline">All paths</Link>
      </div>
      <QueryBoundary query={blocks} lines={5}>
        {(bs) => (
          <Stagger inView className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {bs.map((b) => {
              const attempted = b.concepts.filter((c) => (concepts.data?.find((x) => x.concept === c)?.attempts ?? 0) > 0).length
              const active = session.data?.active === true && session.data.block_index === b.index
              return <StaggerItem key={b.index} className="h-full"><BlockCard block={b} compact active={active} suggested={rec.data?.suggested === true && rec.data.block_index === b.index} status={blockStatus(b, { attempted, active })} /></StaggerItem>
            })}
          </Stagger>
        )}
      </QueryBoundary>
    </section>
  )
}

// ------------------------------------------------------------------ mastery distribution
export function DistributionCard() {
  const id = useStudentId()
  const mastery = useMastery(id)
  const tierFor = useTierFor()
  const { concept_count } = useMetaConfig()
  const COLORS = { mastered: 'var(--good)', developing: 'var(--mid)', weak: 'var(--bad)' } as const
  return (
    <Card className="h-full">
      <CardHeader title="Mastery distribution" description={`How your ${concept_count} concepts split across tiers.`} />
      <CardBody>
        <QueryBoundary query={mastery}>
          {(m) => {
            const counts = countTiers(m, tierFor)
            const data = (Object.keys(counts) as (keyof typeof counts)[]).map((k) => ({ key: k, name: TIER_STYLES[k].label, value: counts[k] }))
            return (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="size-36 shrink-0" role="img" aria-label={data.map((d) => `${d.name}: ${d.value}`).join(', ')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none" isAnimationActive animationDuration={900} animationEasing="ease-out">
                        {data.map((d) => <Cell key={d.key} fill={COLORS[d.key]} />)}
                      </Pie>
                      <ChartTooltip formatter={(v, n) => [`${v} concepts`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="w-full space-y-2.5">
                  {data.map((d) => {
                    const s = TIER_STYLES[d.key]
                    const Icon = s.icon
                    return (
                      <li key={d.key} className="flex items-center gap-2.5 text-sm">
                        <Icon className={cn('size-4', s.text)} aria-hidden />
                        <span className="flex-1">{d.name}</span>
                        <span className="font-semibold tabular-nums">{d.value}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          }}
        </QueryBoundary>
      </CardBody>
    </Card>
  )
}

// ------------------------------------------------------------------ recent activity + insights
export function RecentActivityCard() {
  const id = useStudentId()
  const history = useHistory(id, {}, 6)
  const items = history.data?.pages[0]?.items
  return (
    <Card>
      <CardHeader title="Recent activity" action={<Link to={ROUTES.history} className="text-sm font-medium text-primary hover:underline">View all</Link>} />
      <CardBody className="pt-2">
        <QueryBoundary query={{ ...history, data: items }}>
          {(rows) =>
            rows && rows.length > 0 ? (
              <div className="divide-y divide-border">{rows.map((r) => <ActivityRow key={r.step_index} item={r} />)}</div>
            ) : (
              <EmptyState compact title="Nothing yet" description="Your answers and lessons will appear here after your first session." />
            )
          }
        </QueryBoundary>
      </CardBody>
    </Card>
  )
}

export function InsightsCard() {
  const id = useStudentId()
  const analytics = useAnalytics(id, null)
  const summary = useSummary(id)
  return (
    <Card>
      <CardHeader title="Insights" description="Plain statements computed from your own results." />
      <CardBody>
        <QueryBoundary query={analytics}>
          {(a) => {
            const insights = buildInsights(a, summary.data)
            return insights.length === 0 ? (
              <EmptyState compact title="Not enough data yet" description="Insights appear once you have answered a few questions in a block." />
            ) : (
              <ul className="space-y-3">
                {insights.map((i) => (
                  <li key={i.id} className="flex items-start gap-2.5 text-sm">
                    <TrendingUp className={cn('mt-0.5 size-4 shrink-0', i.tone === 'good' ? 'text-good' : i.tone === 'mid' ? 'text-mid' : 'text-primary')} aria-hidden />
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            )
          }}
        </QueryBoundary>
      </CardBody>
    </Card>
  )
}


