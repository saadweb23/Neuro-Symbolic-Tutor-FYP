import { Activity, CalendarDays, Target, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAnalytics, useSummary, useTrajectory } from '@/api/queries/hooks'
import { useStudentId } from '@/app/providers/StudentProvider'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ChartCard, DataTable } from '@/components/ui/ChartCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { StatCard } from '@/components/ui/StatCard'
import { buildInsights } from '@/features/analytics/insights'
import { activityTotals, improvedCount, progressionRows } from '@/features/analytics/series'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { BLOCK_COLORS, pct } from '@/lib/tiers'
import type { Analytics } from '@/api/types'

const RANGES = [{ label: 'All time', days: null }, { label: '30 days', days: 30 }, { label: '7 days', days: 7 }] as const
const AXIS = { fontSize: 12, fill: 'var(--muted)' }
const GRID = { stroke: 'var(--border)', strokeDasharray: '3 3' }
const TIP = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }, labelStyle: { color: 'var(--muted)' } }
const MIN_POINTS = 3

export function AnalyticsPage() {
  const id = useStudentId()
  const [params, setParams] = useSearchParams()
  const daysParam = params.get('days')
  const days = daysParam === '7' ? 7 : daysParam === '30' ? 30 : null
  const analytics = useAnalytics(id, days)
  const summary = useSummary(id)

  return (
    <div className="space-y-6">
      <PageHeader title="Progress analytics" description="How your mastery estimates, accuracy and activity have changed. Everything here is computed from your own recorded answers."
        actions={
          <div role="group" aria-label="Date range" className="inline-flex rounded-lg bg-raised p-1">
            {RANGES.map((r) => (
              <button key={r.label} aria-pressed={days === r.days} onClick={() => setParams(r.days ? { days: String(r.days) } : {}, { replace: true })}
                className={cn('rounded-md px-3 py-1.5 text-sm font-medium', days === r.days ? 'bg-surface text-text shadow-card' : 'text-muted hover:text-text')}>{r.label}</button>
            ))}
          </div>
        } />

      {analytics.isPending && <SkeletonCard lines={8} />}
      {analytics.isError && <ErrorState error={analytics.error} onRetry={() => void analytics.refetch()} />}
      {analytics.data && <AnalyticsBody a={analytics.data} summaryData={summary.data} id={id} />}
    </div>
  )
}

function AnalyticsBody({ a, summaryData, id }: { a: Analytics; summaryData: ReturnType<typeof useSummary>['data']; id: string }) {
  const totals = activityTotals(a)
  const insights = buildInsights(a, summaryData)
  const hasAnswers = a.concepts.length > 0 || totals.answered > 0
  if (!hasAnswers && a.activity.length === 0) {
    return <Card><EmptyState title="No activity in this period" description="Answer some questions in a learning session and your trends will appear here." /></Card>
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Questions answered" icon={<Target className="size-4" />} value={totals.answered} hint={a.window.days ? `last ${a.window.days} days` : 'all time'} />
        <StatCard label="Accuracy" icon={<TrendingUp className="size-4" />} value={totals.accuracy === null ? undefined : pct(totals.accuracy)} emptyText="no answers yet" hint={totals.accuracy === null ? undefined : `${totals.correct} of ${totals.answered} correct`} />
        <StatCard label="Active days" icon={<CalendarDays className="size-4" />} value={totals.activeDays} />
        <StatCard label="Concepts improved" icon={<Activity className="size-4" />} value={improvedCount(a)} hint="estimate up 5+ points, 2+ answers" />
      </div>

      {insights.length > 0 && (
        <Card><CardHeader title="Highlights" /><CardBody><ul className="grid gap-2.5 sm:grid-cols-2">{insights.map((i) => <li key={i.id} className="rounded-lg bg-raised/60 p-3 text-sm">{i.text}</li>)}</ul></CardBody></Card>
      )}

      <Progression id={id} />
      <div className="grid gap-6 lg:grid-cols-2">
        <BlockPerformance a={a} />
        <AccuracyTrend a={a} />
        <ActivityChart a={a} />
        <ContentMix a={a} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ConceptImprovement a={a} />
        <Difficulty a={a} />
      </div>
    </>
  )
}

function Progression({ id }: { id: string }) {
  const traj = useTrajectory(id)
  const [axis, setAxis] = useState<'n' | 't'>('n')
  const [shown, setShown] = useState<Record<string, boolean>>({ overall: true })
  const rows = useMemo(() => (traj.data ? progressionRows(traj.data) : []), [traj.data])
  const names = ['Fundamentals', 'Control Flow', 'Data Structures', 'Modularity', 'Intermediate Mechanics']
  const data = rows.map((r) => ({ n: r.n, t: r.t, overall: r.overall * 100, ...Object.fromEntries(r.blocks.map((b, i) => [`b${i}`, b * 100])) }))
  const dated = data.filter((d) => d.t !== null)
  const series = [{ key: 'overall', label: 'Overall', color: 'var(--primary)' }, ...names.map((n, i) => ({ key: `b${i}`, label: n, color: BLOCK_COLORS[i]! }))]

  return (
    <QueryBoundary query={traj} lines={6}>
      {() => (
        <ChartCard
          title="Mastery progression"
          description="Estimated mastery after each interaction, replayed with the current tracker."
          summary={rows.length > 1 ? `Overall estimate moved from ${pct(rows[0]!.overall)} to ${pct(rows[rows.length - 1]!.overall)} over ${rows.length - 1} interactions.` : undefined}
          chart={
            data.length < MIN_POINTS ? <EmptyState compact title="Not enough data yet" description={`The trend appears after ${MIN_POINTS} interactions.`} /> : (
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {series.map((s) => (
                    <button key={s.key} aria-pressed={!!shown[s.key]} onClick={() => setShown((p) => ({ ...p, [s.key]: !p[s.key] }))}
                      className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium', shown[s.key] ? 'border-border-strong bg-surface text-text' : 'border-border text-muted opacity-70')}>
                      <span className="h-0.5 w-4 rounded" style={{ background: s.color }} aria-hidden />{s.label}
                    </button>
                  ))}
                  <span className="ml-auto inline-flex rounded-md bg-raised p-0.5 text-xs" role="group" aria-label="X axis">
                    {([['n', 'Interaction'], ['t', 'Date']] as const).map(([k, l]) => (
                      <button key={k} aria-pressed={axis === k} onClick={() => setAxis(k)} className={cn('rounded px-2.5 py-1 font-medium', axis === k ? 'bg-surface shadow-card' : 'text-muted')}>{l}</button>
                    ))}
                  </span>
                </div>
                <div className="h-72" role="img" aria-label="Line chart of estimated mastery over time">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={axis === 'n' ? data : dated} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                      <CartesianGrid {...GRID} />
                      {axis === 'n'
                        ? <XAxis dataKey="n" tick={AXIS} stroke="var(--border)" label={{ value: 'Interaction', position: 'insideBottom', offset: -2, fill: 'var(--muted)', fontSize: 12 }} />
                        : <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={AXIS} stroke="var(--border)" tickFormatter={(v: number) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />}
                      <YAxis domain={[0, 100]} tick={AXIS} stroke="var(--border)" tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip {...TIP} formatter={(v) => `${Number(v).toFixed(1)}%`} labelFormatter={(l) => (axis === 'n' ? (l === 0 ? 'Start' : `Interaction ${l}`) : new Date(Number(l)).toLocaleString())} />
                      {series.filter((s) => shown[s.key]).map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={s.key === 'overall' ? 2.5 : 1.8} dot={false} isAnimationActive={false} />)}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          }
          table={<DataTable head={['#', 'Overall', ...names]} rows={rows.map((r) => [r.n === 0 ? 'Start' : r.n, pct(r.overall), ...r.blocks.map(pct)])} />}
        />
      )}
    </QueryBoundary>
  )
}

function BlockPerformance({ a }: { a: Analytics }) {
  const data = a.blocks.map((b) => ({ name: b.name, accuracy: b.accuracy === null ? null : b.accuracy * 100, mastery: b.current_average * 100 }))
  return (
    <ChartCard title="Block performance" description="Answer accuracy in this period next to the block's current estimated mastery."
      summary={a.blocks.map((b) => `${b.name}: ${b.accuracy === null ? 'no answers' : pct(b.accuracy)} accuracy, ${pct(b.current_average)} mastery`).join('. ')}
      chart={
        <div className="h-64" role="img" aria-label="Bar chart of accuracy and mastery per block">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 11 }} stroke="var(--border)" tickFormatter={(v: string) => v.split(' ')[0]!} />
              <YAxis domain={[0, 100]} tick={AXIS} stroke="var(--border)" tickFormatter={(v: number) => `${v}%`} />
              <Tooltip {...TIP} formatter={(v) => (v === null || v === undefined ? 'no answers' : `${Number(v).toFixed(0)}%`)} cursor={{ fill: 'var(--raised)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="accuracy" name="Accuracy" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="mastery" name="Current mastery" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={<DataTable head={['Block', 'Answered', 'Correct', 'Accuracy', 'Mastery']} rows={a.blocks.map((b) => [b.name, b.answered, b.correct, b.accuracy === null ? '–' : pct(b.accuracy), pct(b.current_average)])} />} />
  )
}

function AccuracyTrend({ a }: { a: Analytics }) {
  const data = a.accuracy_trend.map((t) => ({ n: t.answer_number, acc: t.rolling_accuracy * 100 }))
  return (
    <ChartCard title="Accuracy trend" description={`Share of your last ${a.window.accuracy_window} answers that were correct.`}
      summary={data.length ? `Rolling accuracy ended at ${Math.round(data[data.length - 1]!.acc)} percent.` : undefined}
      chart={data.length < 2 ? <EmptyState compact title="Not enough data yet" description={`Appears after ${a.window.accuracy_window + 1} answered questions.`} /> : (
        <div className="h-64" role="img" aria-label="Line chart of rolling answer accuracy">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="n" tick={AXIS} stroke="var(--border)" />
              <YAxis domain={[0, 100]} tick={AXIS} stroke="var(--border)" tickFormatter={(v: number) => `${v}%`} />
              <Tooltip {...TIP} formatter={(v) => `${Number(v).toFixed(0)}%`} labelFormatter={(l) => `After answer ${l}`} />
              <Line type="monotone" dataKey="acc" name="Accuracy" stroke="var(--accent)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      table={<DataTable head={['After answer', 'Rolling accuracy']} rows={data.map((d) => [d.n, `${Math.round(d.acc)}%`])} />} />
  )
}

function ActivityChart({ a }: { a: Analytics }) {
  const data = a.activity.map((d) => ({ date: d.date, correct: d.correct, incorrect: d.answered - d.correct }))
  return (
    <ChartCard title="Daily activity" description="Questions answered per day."
      summary={`${data.length} active days.`}
      chart={data.length === 0 ? <EmptyState compact title="No answers in this period" /> : (
        <div className="h-64" role="img" aria-label="Stacked bar chart of correct and incorrect answers per day">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS} stroke="var(--border)" tickFormatter={(v: string) => formatDate(`${v}T12:00:00Z`).replace(/, \d{4}$/, '')} />
              <YAxis allowDecimals={false} tick={AXIS} stroke="var(--border)" />
              <Tooltip {...TIP} cursor={{ fill: 'var(--raised)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="correct" name="Correct" stackId="a" fill="var(--good)" isAnimationActive={false} />
              <Bar dataKey="incorrect" name="Incorrect" stackId="a" fill="var(--bad)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      table={<DataTable head={['Date', 'Answered', 'Correct', 'Videos', 'Docs', 'Answering time (s)']} rows={a.activity.map((d) => [d.date, d.answered, d.correct, d.videos, d.deep_dives, Math.round(d.answering_seconds)])} />} />
  )
}

function ContentMix({ a }: { a: Analytics }) {
  const labels = { practice: 'Practice questions', placement: 'Placement', video: 'Videos', deep_dive: 'Docs deep-dives' } as const
  const colors = ['var(--primary)', 'var(--accent)', 'var(--block-2)', 'var(--block-3)']
  const data = (Object.keys(labels) as (keyof typeof labels)[]).map((k, i) => ({ name: labels[k], value: a.content_mix[k], color: colors[i]! })).filter((d) => d.value > 0)
  return (
    <ChartCard title="What you spent time on" description="Activities in this period, by type."
      summary={data.map((d) => `${d.name}: ${d.value}`).join(', ')}
      chart={data.length === 0 ? <EmptyState compact title="No activity in this period" /> : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="size-44 shrink-0" role="img" aria-label="Donut chart of activity types">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={data} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none" isAnimationActive={false}>{data.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip {...TIP} /></PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-2 text-sm">{data.map((d) => <li key={d.name} className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: d.color }} aria-hidden /><span className="flex-1">{d.name}</span><span className="font-semibold tabular-nums">{d.value}</span></li>)}</ul>
        </div>
      )}
      table={<DataTable head={['Type', 'Count']} rows={data.map((d) => [d.name, d.value])} />} />
  )
}

function ConceptImprovement({ a }: { a: Analytics }) {
  const rows = a.concepts
  return (
    <Card>
      <CardHeader title="Concept improvement" description="Estimated mastery just before your first answer on a concept versus now." />
      <CardBody>
        {rows.length === 0 ? <EmptyState compact title="No concept data yet" /> : (
          <ul className="max-h-80 space-y-3 overflow-auto pr-1">
            {rows.map((c) => {
              const d = Math.round(c.delta * 100)
              return (
                <li key={c.concept}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{c.concept}</span>
                    <span className="tabular-nums text-muted">{pct(c.first_belief)} → {pct(c.current_belief)} <span className={cn('font-semibold', d > 0 ? 'text-good' : d < 0 ? 'text-bad' : 'text-muted')}>({d > 0 ? '+' : ''}{d})</span></span>
                  </div>
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-raised" aria-hidden>
                    <div className="absolute inset-y-0 rounded-full bg-border-strong" style={{ left: `${Math.min(c.first_belief, c.current_belief) * 100}%`, width: `${Math.abs(c.delta) * 100}%` }} />
                    <div className={cn('absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full', d >= 0 ? 'bg-good' : 'bg-bad')} style={{ left: `${c.current_belief * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted">{c.attempts} answer{c.attempts === 1 ? '' : 's'} · {pct(c.accuracy)} correct</p>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

function Difficulty({ a }: { a: Analytics }) {
  const labels = { placement: 'Placement', easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const
  const rows = (Object.keys(labels) as (keyof typeof labels)[]).map((k) => ({ k, label: labels[k], ...a.difficulty[k] })).filter((r) => r.answered > 0)
  return (
    <Card>
      <CardHeader title="By question difficulty" description="Difficulty is set from your estimated mastery when the question is served." />
      <CardBody>
        {rows.length === 0 ? <EmptyState compact title="No answers in this period" /> : (
          <ul className="space-y-4">
            {rows.map((r) => (
              <li key={r.k}>
                <div className="flex items-baseline justify-between text-sm"><span className="font-medium">{r.label}</span><span className="tabular-nums text-muted">{r.correct} of {r.answered} correct · {pct(r.correct / r.answered)}</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised" aria-hidden><div className="h-full rounded-full bg-accent" style={{ width: `${(r.correct / r.answered) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
