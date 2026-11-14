import { Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { useMastery } from '@/api/queries/hooks'
import type { Analytics } from '@/api/types'
import { useTierFor } from '@/app/providers/MetaProvider'
import { useStudentId } from '@/app/providers/StudentProvider'
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap'
import { DonutChart } from '@/components/charts/DonutChart'
import { EmptyState } from '@/components/feedback/EmptyState'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { AnimatedNumber } from '@/components/motion/AnimatedNumber'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ChartCard, DataTable } from '@/components/ui/ChartCard'
import { activityHeat, lastDays } from '@/features/analytics/weekly'
import { countTiers } from '@/features/dashboard/tiers'
import { useChartMotion } from '@/hooks/useChartMotion'
import { AXIS, GRID, LEVEL_COLORS, TIP } from '@/lib/chartTheme'
import { plural } from '@/lib/format'

export function MasteryDistribution() {
  const id = useStudentId()
  const mastery = useMastery(id)
  const tierFor = useTierFor()
  return (
    <Card className="h-full">
      <CardHeader title="Concept mastery distribution" description="How many concepts are strong, intermediate or weak right now." />
      <CardBody>
        <QueryBoundary query={mastery}>
          {(m) => {
            const c = countTiers(m, tierFor)
            const data = [
              { name: 'Strong', value: c.mastered, color: LEVEL_COLORS.strong },
              { name: 'Intermediate', value: c.developing, color: LEVEL_COLORS.intermediate },
              { name: 'Weak', value: c.weak, color: LEVEL_COLORS.weak },
            ]
            const total = data.reduce((a, d) => a + d.value, 0)
            return (
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <DonutChart data={data} size={190} unit=" concepts" label={data.map((d) => `${d.name}: ${d.value}`).join(', ')}
                  center={<div><p className="font-display text-3xl font-bold tabular-nums">{total}</p><p className="text-xs text-muted">concepts</p></div>} />
                <ul className="w-full space-y-3">
                  {data.map((d) => (
                    <li key={d.name} className="flex items-center gap-3 text-sm">
                      <span className="size-3 rounded-full" style={{ background: d.color }} aria-hidden />
                      <span className="flex-1 font-medium">{d.name}</span>
                      <span className="tabular-nums text-muted">{total ? Math.round((d.value / total) * 100) : 0}%</span>
                      <span className="w-8 text-right font-bold tabular-nums"><AnimatedNumber value={d.value} /></span>
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

export function StrengthRadar({ a }: { a: Analytics }) {
  const motion = useChartMotion()
  const data = a.blocks.map((b) => ({ subject: b.name, mastery: Math.round(b.current_average * 100), accuracy: b.accuracy === null ? 0 : Math.round(b.accuracy * 100) }))
  return (
    <ChartCard
      title="Strengths and weaknesses"
      description="Mastery estimate and answer accuracy across the five learning areas."
      summary={data.map((d) => `${d.subject}: mastery ${d.mastery}%, accuracy ${d.accuracy}%`).join('; ')}
      chart={
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ ...AXIS, fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip {...TIP} formatter={(v) => `${v}%`} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Radar name="Mastery" dataKey="mastery" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.28} strokeWidth={2} {...motion} />
              <Radar name="Accuracy" dataKey="accuracy" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.18} strokeWidth={2} {...motion} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      }
      table={<DataTable head={['Area', 'Mastery', 'Accuracy']} rows={data.map((d) => [d.subject, `${d.mastery}%`, `${d.accuracy}%`])} />}
    />
  )
}

export function ConsistencyHeatmap({ a }: { a: Analytics }) {
  const active = a.activity.filter((d) => d.answered + d.videos + d.deep_dives > 0).length
  return (
    <Card className="h-full">
      <CardHeader title="Learning consistency" description={`Active on ${plural(active, 'day')} in this period. Darker squares are busier days.`} />
      <CardBody>
        {a.activity.length === 0 ? <EmptyState compact title="No activity yet" description="Days you learn will light up here." /> : <CalendarHeatmap days={activityHeat(a.activity)} weeks={16} unit="activities" />}
      </CardBody>
    </Card>
  )
}

export function TimeSpent({ a }: { a: Analytics }) {
  const motion = useChartMotion()
  const days = lastDays(a.activity, 14)
  const total = Math.round(days.reduce((x, d) => x + d.minutes, 0) * 10) / 10
  return (
    <ChartCard
      title="Time spent answering"
      description={`Minutes spent answering questions per day over the last 14 days (${total} min in total).`}
      summary={`${total} minutes answering over the last 14 days.`}
      chart={
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} interval={1} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} unit="m" />
              <Tooltip {...TIP} formatter={(v) => [`${v} min`, 'Answering time']} />
              <Bar dataKey="minutes" name="Minutes" fill="var(--block-4)" radius={[6, 6, 0, 0]} {...motion} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={<DataTable head={['Day', 'Minutes answering']} rows={days.map((d) => [d.date, d.minutes])} />}
    />
  )
}
