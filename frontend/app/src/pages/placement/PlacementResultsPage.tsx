import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Info } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useRecommendation } from '@/api/queries/hooks'
import type { Beliefs } from '@/api/types'
import { useMetaConfig } from '@/app/providers/MetaProvider'
import { useTierFor } from '@/app/providers/MetaProvider'
import { useStudentContext, useStudentId } from '@/app/providers/StudentProvider'
import { DonutChart } from '@/components/charts/DonutChart'
import { AnimatedNumber } from '@/components/motion/AnimatedNumber'
import { Stagger, StaggerItem } from '@/components/motion/Stagger'
import { countTiers } from '@/features/dashboard/tiers'
import { LEVEL_COLORS } from '@/lib/chartTheme'
import { BrandMark, Wordmark } from '@/components/brand/BrandMark'
import { ConceptMap } from '@/components/domain/ConceptMap'
import { LinkButton } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { RadialProgress } from '@/components/ui/RadialProgress'
import { ROUTES } from '@/constants/routes'
import { pct } from '@/lib/tiers'
import { placementResultKey } from './PlacementPage'

/** Shown once, right after placement: the starting point derived from the quiz. The data is the
 *  response of POST /placement/submit, kept in the query cache; opening this URL directly (no fresh
 *  result) just goes to the dashboard -- the same baseline stays visible later in Analytics. */
export function PlacementResultsPage() {
  const id = useStudentId()
  const cfg = useMetaConfig()
  const qc = useQueryClient()
  const beliefs = qc.getQueryData<Beliefs>(placementResultKey(id))
  const rec = useRecommendation(id)
  const { user } = useStudentContext()
  const tierFor = useTierFor()

  if (!beliefs) return <Navigate to={ROUTES.dashboard} replace />

  const values = Object.values(beliefs)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const counts = countTiers(beliefs, tierFor)
  const levels = [
    { name: 'Strong', value: counts.mastered, color: LEVEL_COLORS.strong },
    { name: 'Intermediate', value: counts.developing, color: LEVEL_COLORS.intermediate },
    { name: 'Weak', value: counts.weak, color: LEVEL_COLORS.weak },
  ]
  const weakest = Object.entries(beliefs).sort((a, b) => a[1] - b[1]).slice(0, 3)

  return (
    <div className="min-h-svh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <BrandMark size={24} />
          <Wordmark className="text-base" />
        </div>
      </header>
      <Stagger className="mx-auto max-w-5xl space-y-6 px-4 py-8" gap={0.1}>
        <StaggerItem>
        <Card className="overflow-hidden">
          <div aria-hidden className="h-1" style={{ background: 'var(--grad-brand)' }} />
          <CardBody className="grid items-center gap-6 sm:grid-cols-[auto_1fr_auto] sm:p-8">
            <RadialProgress value={avg} size={120} stroke={11} label="Estimated overall mastery">
              <div><div className="font-display text-2xl font-bold tabular-nums"><AnimatedNumber value={Math.round(avg * 100)} format={(n) => `${Math.round(n)}%`} /></div><div className="text-[11px] text-muted">estimated</div></div>
            </RadialProgress>
            <div>
              <h1 className="text-2xl font-bold">Placement complete{user ? `, ${user.name}` : ''}. Here&apos;s your starting point</h1>
              <p className="mt-2 text-muted">
                Your weakest areas right now are{' '}
                {weakest.map(([c, b], i) => (
                  <span key={c}><strong className="text-text">{c}</strong> ({pct(b)}){i < weakest.length - 1 ? ', ' : ''}</span>
                ))}
                . The tutor will start by building those up.
              </p>
              {rec.data?.state === 'ready' && rec.data.block_name && (
                <p className="mt-2 text-sm text-muted">Suggested first focus area: <strong className="text-text">{rec.data.block_name}</strong>.</p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <LinkButton to={ROUTES.dashboard} size="lg" magnetic icon={<ArrowRight className="size-5" />}>Go to my dashboard</LinkButton>
                <LinkButton to={ROUTES.learn} size="lg" variant="secondary">Choose a focus area</LinkButton>
              </div>
            </div>
            <div className="flex items-center gap-4 sm:flex-col">
              <DonutChart data={levels} size={120} unit=" concepts" label={levels.map((d) => `${d.name}: ${d.value}`).join(', ')} />
              <ul className="space-y-1 text-xs">
                {levels.map((l) => <li key={l.name} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: l.color }} aria-hidden />{l.name} <b className="ml-auto tabular-nums">{l.value}</b></li>)}
              </ul>
            </div>
          </CardBody>
        </Card>
        </StaggerItem>

        <StaggerItem>
        <p className="flex items-start gap-2 rounded-lg bg-primary-soft p-3.5 text-sm text-primary">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Only {cfg.placement_concepts.length} of {cfg.concept_count} concepts were actually quizzed. The rest are estimated through the knowledge graph: each answer informs concepts up to two hops away on the prerequisite graph. Concepts far from every quizzed one stay near a neutral starting value until you reach them.
          </span>
        </p>
        </StaggerItem>

        <StaggerItem>
        <Card>
          <CardBody>
            <h2 className="mb-4 text-lg font-semibold">All {cfg.concept_count} concepts</h2>
            <ConceptMap beliefs={beliefs} />
          </CardBody>
        </Card>
        </StaggerItem>
      </Stagger>
    </div>
  )
}
