import { Award, Clock, Flag, Lightbulb, Lock, Map as MapIcon, Rocket, Target, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBlocks, useConcepts, useGraph, useHistory, useRecommendation, useStatus, useSummary } from '@/api/queries/hooks'
import type { BlockProgress, ConceptDetail, Graph } from '@/api/types'
import { useMetaConfig, useTierFor } from '@/app/providers/MetaProvider'
import { useStudentId } from '@/app/providers/StudentProvider'
import { EmptyState } from '@/components/feedback/EmptyState'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { AnimatedNumber } from '@/components/motion/AnimatedNumber'
import { Stagger, StaggerItem } from '@/components/motion/Stagger'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { RadialProgress } from '@/components/ui/RadialProgress'
import { ROUTES } from '@/constants/routes'
import { CONCEPT_INFO } from '@/features/curriculum/content'
import { studyTips } from '@/features/dashboard/aiInsights'
import { buildBadges } from '@/features/learning/badges'
import { buildRoadmap, journeyCompletion, type RoadmapNode } from '@/features/learning/roadmap'
import { RoadmapGraph } from '@/features/learning/RoadmapGraph'
import { STATE_STYLE } from '@/features/learning/stateStyle'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { formatDuration, relativeTime } from '@/lib/format'
import { BLOCK_COLORS, pct } from '@/lib/tiers'

/** Everything the journey views need, from the same queries the rest of the app uses. */
export function useJourney() {
  const id = useStudentId()
  const graph = useGraph()
  const concepts = useConcepts(id)
  const rec = useRecommendation(id)
  const cfg = useMetaConfig()
  const current = rec.data?.state === 'ready' ? rec.data.candidates[0]?.concept ?? null : null
  const nodes = useMemo(
    () => (graph.data && concepts.data ? buildRoadmap({ graph: graph.data, concepts: concepts.data, threshold: cfg.mastery_threshold, floor: cfg.concept_floor, current }) : []),
    [graph.data, concepts.data, cfg.mastery_threshold, cfg.concept_floor, current],
  )
  return { graph, concepts, rec, nodes, cfg, current }
}

// ------------------------------------------------------------------ overview strip
export function JourneyOverview() {
  const { concepts, rec, nodes } = useJourney()
  const tierFor = useTierFor()
  const completion = journeyCompletion(nodes)
  const counts = { completed: 0, current: 0, upcoming: 0, locked: 0 }
  for (const n of nodes) counts[n.state]++
  const tips = concepts.data ? studyTips(concepts.data, tierFor, 2) : []
  const next = rec.data?.candidates[0]

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'var(--grad-brand)' }} />
        <CardBody className="flex items-center gap-5 pt-6">
          <RadialProgress value={completion} size={96} stroke={10} label="Learning journey completion" barClassName="stroke-good">
            <span className="font-display text-xl font-bold tabular-nums"><AnimatedNumber value={Math.round(completion * 100)} format={(n) => `${Math.round(n)}%`} /></span>
          </RadialProgress>
          <div>
            <p className="font-semibold">Journey completion</p>
            <p className="text-sm text-muted">{counts.completed} of {nodes.length || 25} concepts at target</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {(['completed', 'current', 'upcoming', 'locked'] as const).map((s) => <li key={s}><Badge className={STATE_STYLE[s].chip}>{counts[s]} {STATE_STYLE[s].label.toLowerCase()}</Badge></li>)}
            </ul>
          </div>
        </CardBody>
      </Card>

      <Card className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-primary" />
        <CardBody className="pt-6">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><Rocket className="size-4 text-primary" aria-hidden />Recommended next topic</p>
          <QueryBoundary query={rec} lines={2}>
            {() => next ? (
              <>
                <p className="font-display text-xl font-bold">{next.concept}</p>
                <p className="mt-1 text-sm text-muted">{next.explanation}</p>
              </>
            ) : <p className="text-sm text-muted">{rec.data?.state === 'complete' ? 'Every concept is at target. Review your mastery map.' : 'Choose a focus area below to get a recommendation.'}</p>}
          </QueryBoundary>
        </CardBody>
      </Card>

      <Card className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-mid" />
        <CardBody className="pt-6">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><Lightbulb className="size-4 text-mid" aria-hidden />Personalised recommendations</p>
          {tips.length ? <ul className="space-y-2 text-sm">{tips.map((t) => <li key={t.concept}>{t.text}</li>)}</ul> : <p className="text-sm text-muted">{concepts.isPending ? 'Loading…' : 'Nothing needs special attention right now.'}</p>}
        </CardBody>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ roadmap + detail panel
function PrereqChip({ node, onSelect }: { node: RoadmapNode | undefined; onSelect: (c: string) => void }) {
  if (!node) return null
  const S = STATE_STYLE[node.state]
  return (
    <button onClick={() => onSelect(node.concept)} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-transform hover:-translate-y-0.5', S.chip)}>
      <S.icon className="size-3.5" aria-hidden />{node.concept}
    </button>
  )
}

function RoadmapDetail({ node, nodes, blockName, onSelect, onClose }: { node: RoadmapNode; nodes: RoadmapNode[]; blockName: string; onSelect: (c: string) => void; onClose?: () => void }) {
  const id = useStudentId()
  const history = useHistory(id, { concept: node.concept }, 50)
  const info = CONCEPT_INFO[node.concept]
  const S = STATE_STYLE[node.state]
  const byName = new Map(nodes.map((n) => [n.concept, n]))
  const answered = (history.data?.pages[0]?.items ?? []).filter((i) => i.passed !== null)
  const pace = answered.length >= 2 ? answered.reduce((a, i) => a + i.time_taken, 0) / answered.length : null

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold">{node.concept}</h3>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-muted"><span className="size-2.5 rounded-full" style={{ background: BLOCK_COLORS[node.blockIndex] }} aria-hidden />{blockName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={S.chip}><S.icon className="size-3.5" aria-hidden />{S.label}</Badge>
          {onClose && <button onClick={onClose} aria-label="Close details" className="rounded-md p-1 text-muted hover:bg-raised hover:text-text"><X className="size-4" /></button>}
        </div>
      </div>

      {info && <p className="text-sm">{info.summary}</p>}

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-raised/60 p-2.5"><dt className="text-[11px] uppercase tracking-wide text-muted">Mastery</dt><dd className="mt-0.5 font-semibold tabular-nums">{pct(node.belief)}</dd></div>
        <div className="rounded-lg bg-raised/60 p-2.5"><dt className="text-[11px] uppercase tracking-wide text-muted">Difficulty</dt><dd className="mt-0.5 font-semibold">{node.difficulty}</dd></div>
        <div className="rounded-lg bg-raised/60 p-2.5"><dt className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide text-muted"><Clock className="size-3" aria-hidden />Your pace</dt><dd className="mt-0.5 font-semibold tabular-nums">{pace === null ? 'n/a' : `${formatDuration(pace)}/q`}</dd></div>
      </dl>
      <p className="-mt-3 text-[11px] text-muted">Difficulty comes from how many concepts must come first. Pace is your own average answer time on this concept{pace === null ? ' (not enough answers yet)' : ''}.</p>

      {node.state === 'locked' && (
        <p className="flex gap-2 rounded-lg bg-raised p-3 text-sm"><Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <span>Strengthen <strong>{node.blockedBy.join(', ')}</strong> first. It is below the minimum level this concept builds on. You can still open this block whenever you like.</span></p>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Prerequisites</h4>
        {node.prerequisites.length ? <div className="flex flex-wrap gap-2">{node.prerequisites.map((p) => <PrereqChip key={p} node={byName.get(p)} onSelect={onSelect} />)}</div> : <p className="text-sm text-muted">None. This is a starting point.</p>}
      </div>

      {info && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Learning objectives</h4>
          <ul className="space-y-1.5 text-sm">{info.objectives.map((o) => <li key={o} className="flex gap-2"><Target className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{o}</li>)}</ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <a href={`#block-${node.blockIndex}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong px-3 text-sm font-semibold transition-colors hover:bg-raised">Go to focus area</a>
        <Link to={`${ROUTES.mastery}?view=list&concept=${encodeURIComponent(node.concept)}`} className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-primary hover:underline">Open in concept mastery</Link>
      </div>
    </div>
  )
}

export function RoadmapSection() {
  const { graph, concepts, nodes } = useJourney()
  const [selected, setSelected] = useState<string | null>(null)
  const wide = useMediaQuery('(min-width: 1024px)')
  const node = nodes.find((n) => n.concept === selected)
  const blockName = (i: number) => graph.data?.blocks[i]?.name ?? `Block ${i + 1}`

  const detail = node && <RoadmapDetail node={node} nodes={nodes} blockName={blockName(node.blockIndex)} onSelect={setSelected} onClose={wide ? () => setSelected(null) : undefined} />

  return (
    <section aria-labelledby="roadmap-h">
      <div className="mb-3 flex items-center gap-2"><MapIcon className="size-5 text-primary" aria-hidden /><h3 id="roadmap-h" className="text-base font-semibold">Your learning roadmap</h3></div>
      <QueryBoundary query={{ ...graph, isPending: graph.isPending || concepts.isPending, isError: graph.isError || concepts.isError, error: graph.error ?? concepts.error, refetch: () => { void graph.refetch(); void concepts.refetch() } }} lines={8}>
        {() => (
          <div className={cn('grid gap-5', node && wide && 'lg:grid-cols-[1fr_360px]')}>
            <div className="min-w-0">
              <RoadmapGraph graph={graph.data as Graph} nodes={nodes} selected={selected} onSelect={setSelected} />
              <p className="mt-2 text-xs text-muted">Select a concept for its details. Lines point from a prerequisite to the concept that builds on it.</p>
            </div>
            {node && wide && <aside aria-label="Concept details" className="lg:sticky lg:top-24 lg:self-start"><Card><CardBody>{detail}</CardBody></Card></aside>}
          </div>
        )}
      </QueryBoundary>
      {!wide && <Dialog open={!!node} onOpenChange={(o) => !o && setSelected(null)} title={node?.concept ?? 'Concept'} variant="sheet">{detail}</Dialog>}
    </section>
  )
}

// ------------------------------------------------------------------ recently completed, milestones, badges
const BLOCK_STROKE = ['stroke-block-0', 'stroke-block-1', 'stroke-block-2', 'stroke-block-3', 'stroke-block-4']

function milestones(blocks: BlockProgress[], concepts: ConceptDetail[], threshold: number) {
  const atTarget = new Set(concepts.filter((c) => c.attempts > 0 && c.belief >= threshold).map((c) => c.concept))
  return blocks
    .filter((b) => !b.complete)
    .map((b) => ({ block: b, done: b.concepts.filter((c) => atTarget.has(c)).length, total: b.concepts.length }))
    .sort((a, b) => (b.done / b.total) - (a.done / a.total) || a.block.index - b.block.index)
    .slice(0, 3)
}

export function JourneyExtras() {
  const id = useStudentId()
  const { concepts, nodes, cfg } = useJourney()
  const blocks = useBlocks(id)
  const summary = useSummary(id)
  const status = useStatus(id)

  const recent = [...nodes].filter((n) => n.state === 'completed')
    .map((n) => ({ n, at: concepts.data?.find((c) => c.concept === n.concept)?.last_attempt_at ?? null }))
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')).slice(0, 4)
  const ms = blocks.data && concepts.data ? milestones(blocks.data, concepts.data, cfg.mastery_threshold) : []
  const badges = buildBadges({ summary: summary.data, status: status.data, blocks: blocks.data, concepts: concepts.data, threshold: cfg.mastery_threshold })

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recently completed" description="Concepts you have brought up to target." />
          <CardBody>
            {recent.length ? (
              <ul className="space-y-2.5">{recent.map(({ n, at }) => (
                <li key={n.concept} className="flex items-center gap-3 text-sm">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-good-soft text-good"><STATE_STYLE.completed.icon className="size-4" aria-hidden /></span>
                  <span className="flex-1 font-medium">{n.concept}</span>
                  <span className="text-xs text-muted">{pct(n.belief)} · {at ? relativeTime(at) : ''}</span>
                </li>))}</ul>
            ) : <EmptyState compact title="No completed concepts yet" description="A concept counts once you have answered it and reached the target." />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-2"><Flag className="size-4 text-accent" aria-hidden />Upcoming milestones</span>} description="The blocks closest to completion." />
          <CardBody>
            {ms.length ? (
              <ul className="space-y-4">{ms.map(({ block, done, total }) => (
                <li key={block.index} className="flex items-center gap-4">
                  <RadialProgress value={done / total} size={52} stroke={6} label={`${block.name}: ${done} of ${total} concepts at target`} barClassName={BLOCK_STROKE[block.index]} trackClassName="stroke-raised">
                    <span className="text-xs font-bold tabular-nums">{done}/{total}</span>
                  </RadialProgress>
                  <div className="min-w-0 flex-1 text-sm"><p className="font-semibold">{block.name}</p><p className="text-xs text-muted">{total - done} more concept{total - done === 1 ? '' : 's'} to reach the target</p></div>
                  <span className="size-2.5 rounded-full" style={{ background: BLOCK_COLORS[block.index] }} aria-hidden />
                </li>))}</ul>
            ) : <EmptyState compact title="Every block is complete" description="You have finished the curriculum." />}
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="badges-h">
        <div className="mb-3 flex items-center gap-2"><Award className="size-5 text-mid" aria-hidden /><h3 id="badges-h" className="text-base font-semibold">Achievement badges</h3>
          <span className="text-xs text-muted">{badges.filter((b) => b.earned).length} of {badges.length} earned</span></div>
        <Stagger inView className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" gap={0.05}>
          {badges.map((b) => (
            <StaggerItem key={b.id}>
              <div className={cn('h-full rounded-xl border p-4 text-center transition-colors', b.earned ? 'border-mid/40 bg-mid-soft/50' : 'border-border bg-surface')}>
                <span className={cn('mx-auto flex size-11 items-center justify-center rounded-full', b.earned ? 'bg-mid text-white' : 'bg-raised text-muted')}>
                  {b.earned ? <Award className="size-5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                </span>
                <p className="mt-2 text-sm font-semibold">{b.title}</p>
                <p className="mt-0.5 text-xs text-muted">{b.description}</p>
                <p className={cn('mt-2 text-xs font-semibold tabular-nums', b.earned ? 'text-mid' : 'text-muted')}>{b.earned ? 'Earned' : `${b.current} / ${b.target}`}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  )
}

export function FocusAreasHeading() {
  return <div className="mb-3 mt-2 flex items-center gap-2"><Target className="size-5 text-primary" aria-hidden /><h3 className="text-base font-semibold">Focus areas</h3></div>
}
