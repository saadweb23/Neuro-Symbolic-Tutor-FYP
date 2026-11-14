import { ChevronDown, Dumbbell, Link2, PlayCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ConceptDetail, Graph } from '@/api/types'
import { DonutChart } from '@/components/charts/DonutChart'
import { AnimatedNumber } from '@/components/motion/AnimatedNumber'
import { Stagger, StaggerItem } from '@/components/motion/Stagger'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { RadialProgress } from '@/components/ui/RadialProgress'
import { ROUTES } from '@/constants/routes'
import { useChartMotion } from '@/hooks/useChartMotion'
import { AXIS, GRID, LEVEL_COLORS, TIP } from '@/lib/chartTheme'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { BLOCK_COLORS, pct, type Tier } from '@/lib/tiers'

/** The three student-facing levels. Strong / Intermediate / Weak are the same three tiers the backend
 *  uses (mastered / developing / needs work), cut at the thresholds from GET /meta. */
export const LEVELS: { tier: Tier; title: string; blurb: string; icon: string; color: string; stroke: string; soft: string; text: string; ring: string }[] = [
  { tier: 'mastered', title: 'Strong', blurb: 'You understand these very well.', icon: '●', color: LEVEL_COLORS.strong, stroke: 'stroke-good', soft: 'bg-good-soft', text: 'text-good', ring: 'border-good/40' },
  { tier: 'developing', title: 'Intermediate', blurb: 'Partly understood. A little more practice will lift them.', icon: '◐', color: LEVEL_COLORS.intermediate, stroke: 'stroke-mid', soft: 'bg-mid-soft', text: 'text-mid', ring: 'border-mid/40' },
  { tier: 'weak', title: 'Weak', blurb: 'These need more explanation and practice.', icon: '○', color: LEVEL_COLORS.weak, stroke: 'stroke-bad', soft: 'bg-bad-soft', text: 'text-bad', ring: 'border-bad/40' },
]

interface Props {
  /** concepts that pass the page's filters */
  concepts: ConceptDetail[]
  all: ConceptDetail[]
  blocks: Graph['blocks']
  tierFor: (b: number) => Tier
  onSelect: (concept: string) => void
}

// ------------------------------------------------------------------ summary
function Summary({ all, blocks, tierFor, onSelect }: Pick<Props, 'all' | 'blocks' | 'tierFor' | 'onSelect'>) {
  const motion_ = useChartMotion()
  const counts = { mastered: 0, developing: 0, weak: 0 }
  for (const c of all) counts[tierFor(c.belief)]++
  const avg = all.length ? all.reduce((a, c) => a + c.belief, 0) / all.length : 0
  const donut = LEVELS.map((l) => ({ name: l.title, value: counts[l.tier], color: l.color }))
  const blockData = blocks.map((b) => {
    const cs = all.filter((c) => c.block_index === b.index)
    return { name: b.name, index: b.index, mastery: cs.length ? Math.round((cs.reduce((a, c) => a + c.belief, 0) / cs.length) * 100) : 0 }
  })

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="h-full min-w-0">
        <CardHeader title="Knowledge level" description="All concepts, by level." />
        <CardBody className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
          <DonutChart data={donut} size={150} unit=" concepts" label={donut.map((d) => `${d.name}: ${d.value}`).join(', ')}
            center={<div><p className="font-display text-2xl font-bold tabular-nums"><AnimatedNumber value={Math.round(avg * 100)} format={(n) => `${Math.round(n)}%`} /></p><p className="text-xs text-muted">average</p></div>} />
          <ul className="grid w-full grid-cols-3 gap-2 text-center sm:grid-cols-1 sm:text-left lg:grid-cols-3 xl:grid-cols-1">
            {LEVELS.map((l) => (
              <li key={l.tier} className={cn('rounded-lg border p-2.5', l.soft, l.ring)}>
                <p className={cn('font-display text-2xl font-bold tabular-nums', l.text)}><AnimatedNumber value={counts[l.tier]} /></p>
                <p className="text-xs font-medium text-muted">{l.title}</p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card className="h-full min-w-0 lg:col-span-2">
        <CardHeader title="Topic-wise performance" description="Average mastery of each curriculum block." />
        <CardBody>
          <div className="h-52" role="img" aria-label={`Average mastery by block: ${blockData.map((b) => `${b.name} ${b.mastery}%`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={blockData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} interval={0} tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)} />
                <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
                <Tooltip {...TIP} formatter={(v) => [`${v}%`, 'Average mastery']} />
                <Bar dataKey="mastery" radius={[8, 8, 0, 0]} {...motion_}>
                  {blockData.map((b) => <Cell key={b.index} fill={BLOCK_COLORS[b.index]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <Card className="min-w-0 lg:col-span-3">
        <CardHeader title="Mastery heatmap" description="Every concept at a glance. Deeper colour means a stronger estimate; select one for details." />
        <CardBody>
          <div className="space-y-2 overflow-x-auto">
            {blocks.map((b) => {
              const cs = all.filter((c) => c.block_index === b.index).sort((x, y) => x.id - y.id)
              return (
                <div key={b.index} className="flex min-w-[560px] items-center gap-3">
                  <p className="flex w-36 shrink-0 items-center gap-2 text-xs font-semibold"><span className="size-2 rounded-full" style={{ background: BLOCK_COLORS[b.index] }} aria-hidden />{b.name}</p>
                  <div className="grid flex-1 grid-cols-5 gap-2">
                    {cs.map((c) => {
                      const l = LEVELS.find((x) => x.tier === tierFor(c.belief))!
                      return (
                        <button key={c.concept} onClick={() => onSelect(c.concept)} title={`${c.concept}: ${pct(c.belief)} (${l.title})`}
                          className="group relative flex h-12 flex-col items-center justify-center rounded-lg border border-transparent px-1 text-center transition-transform hover:z-10 hover:scale-105 hover:border-text/30"
                          style={{ background: `color-mix(in srgb, ${l.color} ${Math.round(18 + c.belief * 62)}%, var(--surface))` }}>
                          <span className="w-full truncate text-[10px] font-semibold leading-tight">{c.concept}</span>{' '}
                          <span className="text-[11px] font-bold tabular-nums">{Math.round(c.belief * 100)}</span>
                          <span className="sr-only">, {l.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ one concept card
function ConceptCard({ c, level, blockName, byName, onSelect }: { c: ConceptDetail; level: (typeof LEVELS)[number]; blockName: string; byName: Map<string, ConceptDetail>; onSelect: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const pre = c.weakest_prerequisite ? byName.get(c.weakest_prerequisite) : undefined
  return (
    <div className={cn('rounded-xl border bg-surface transition-shadow hover:shadow-raised', open ? level.ring : 'border-border')}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`${c.concept}, ${pct(c.belief)}, ${level.title}. ${open ? 'Hide' : 'Show'} details`} className="flex w-full items-center gap-3 p-3.5 text-left">
        <RadialProgress value={c.belief} size={56} stroke={6} barClassName={level.stroke} label={`${c.concept} mastery`}>
          <span className="text-xs font-bold tabular-nums">{Math.round(c.belief * 100)}</span>
        </RadialProgress>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{c.concept}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><span className="size-2 rounded-full" style={{ background: BLOCK_COLORS[c.block_index] }} aria-hidden />{blockName}</span>
          <span className="mt-1.5 flex gap-3 text-[11px] text-muted">
            <span><b className="text-text tabular-nums">{c.attempts}</b> {c.attempts === 1 ? 'answer' : 'answers'}</span>
            <span><b className="text-text tabular-nums">{c.accuracy === null ? '–' : pct(c.accuracy)}</b> correct</span>
          </span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="space-y-3 border-t border-border px-3.5 pb-3.5 pt-3 text-sm">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-muted">Last answered</dt><dd className="font-medium">{c.last_attempt_at ? formatDate(c.last_attempt_at) : 'never'}</dd></div>
                <div><dt className="text-muted">Builds on</dt><dd className="font-medium">{c.prerequisites.length ? c.prerequisites.join(', ') : 'nothing (a starting point)'}</dd></div>
                <div className="col-span-2"><dt className="text-muted">Leads to</dt><dd className="font-medium">{c.dependents.length ? c.dependents.join(', ') : 'nothing further'}</dd></div>
              </dl>
              {level.tier !== 'mastered' && (
                <div className={cn('rounded-lg p-3', level.soft)}>
                  <p className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', level.text)}>Recommended actions</p>
                  <ul className="space-y-1.5">
                    <li><Link to={`${ROUTES.learn}#block-${c.block_index}`} className="inline-flex items-center gap-2 font-medium hover:underline"><Dumbbell className="size-4" aria-hidden />Practise in {blockName}</Link></li>
                    {pre && pre.belief < c.belief + 0.1 && <li><button onClick={() => onSelect(pre.concept)} className="inline-flex items-center gap-2 font-medium hover:underline"><Link2 className="size-4" aria-hidden />Review the prerequisite {pre.concept} ({pct(pre.belief)})</button></li>}
                    <li><Link to={ROUTES.resources} className="inline-flex items-center gap-2 font-medium hover:underline"><PlayCircle className="size-4" aria-hidden />Watch the video and read the docs</Link></li>
                  </ul>
                </div>
              )}
              <button onClick={() => onSelect(c.concept)} className="text-xs font-semibold text-primary hover:underline">Open full details</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function LevelsView({ concepts, all, blocks, tierFor, onSelect }: Props) {
  const byName = new Map(all.map((c) => [c.concept, c]))
  const blockName = (i: number) => blocks[i]?.name ?? `Block ${i + 1}`
  return (
    <div className="space-y-8">
      <Summary all={all} blocks={blocks} tierFor={tierFor} onSelect={onSelect} />
      {LEVELS.map((l) => {
        const items = concepts.filter((c) => tierFor(c.belief) === l.tier)
        return (
          <section key={l.tier} aria-labelledby={`level-${l.tier}`} className={cn('rounded-2xl border p-4 sm:p-5', l.ring)} style={{ background: `color-mix(in srgb, ${l.color} 6%, var(--surface))` }}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={cn('flex size-9 items-center justify-center rounded-full text-base font-bold text-white')} style={{ background: l.color }} aria-hidden>{l.icon}</span>
              <div className="min-w-0 flex-1">
                <h3 id={`level-${l.tier}`} className="font-display text-lg font-bold">{l.title} <span className="text-sm font-medium text-muted">· {items.length} concept{items.length === 1 ? '' : 's'}</span></h3>
                <p className="text-sm text-muted">{l.blurb}</p>
              </div>
            </div>
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface/60 p-4 text-center text-sm text-muted">No concepts at this level{concepts.length !== all.length ? ' with the current filters' : ' right now'}.</p>
            ) : (
              <Stagger inView className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" gap={0.05}>
                {items.map((c) => <StaggerItem key={c.concept}><ConceptCard c={c} level={l} blockName={blockName(c.block_index)} byName={byName} onSelect={onSelect} /></StaggerItem>)}
              </Stagger>
            )}
          </section>
        )
      })}
    </div>
  )
}
