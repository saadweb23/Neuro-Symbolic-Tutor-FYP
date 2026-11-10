import { useConcepts } from '@/api/queries/hooks'
import { useTierFor } from '@/app/providers/MetaProvider'
import { useStudentId } from '@/app/providers/StudentProvider'
import { TierBadge } from '@/components/domain/TierBadge'
import { Card, CardBody } from '@/components/ui/Card'
import { RadialProgress } from '@/components/ui/RadialProgress'
import { cn } from '@/lib/cn'
import { TIER_STYLES, pct } from '@/lib/tiers'

/** Side panel: the current concept, its estimated mastery, how much evidence stands behind it, and
 *  the state of its direct prerequisites (from GET /concepts, read-only). */
export function ConceptPanel({ concept, belief, attemptNumber }: { concept: string; belief: number; attemptNumber: number }) {
  const id = useStudentId()
  const concepts = useConcepts(id)
  const tierFor = useTierFor()
  const detail = concepts.data?.find((c) => c.concept === concept)
  const byName = new Map(concepts.data?.map((c) => [c.concept, c]))
  const tier = TIER_STYLES[tierFor(belief)]
  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-center gap-4">
          <RadialProgress value={belief} size={76} stroke={8} barClassName={tier.text.replace('text-', 'stroke-')} label={`${concept} estimated mastery`}>
            <span className="text-base font-semibold tabular-nums">{pct(belief)}</span>
          </RadialProgress>
          <div className="min-w-0">
            <p className="truncate font-semibold">{concept}</p>
            <TierBadge belief={belief} className="mt-1" />
          </div>
        </div>
        <p className="text-sm text-muted">
          {attemptNumber === 0 ? 'First time on this concept.' : `Visit ${attemptNumber + 1} to this concept.`} The percentage is the tracker&apos;s estimate built from all your answers, not a single pass or fail.
        </p>
        {detail && detail.prerequisites.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Builds on</p>
            <ul className="space-y-2">
              {detail.prerequisites.map((p) => {
                const b = byName.get(p)?.belief ?? 0
                const weakest = detail.weakest_prerequisite === p
                return (
                  <li key={p} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{p}{weakest && <span className="ml-1.5 text-xs font-semibold text-mid">weakest</span>}</span>
                    <span className={cn('tabular-nums text-xs font-medium', TIER_STYLES[tierFor(b)].text)}>{pct(b)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {detail && detail.prerequisites.length === 0 && <p className="text-sm text-muted">A foundational concept: it has no prerequisites.</p>}
      </CardBody>
    </Card>
  )
}
