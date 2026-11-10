import { ArrowRight, ExternalLink, X } from 'lucide-react'
import { useResources } from '@/api/queries/hooks'
import type { ConceptDetail } from '@/api/types'
import { useTierFor } from '@/app/providers/MetaProvider'
import { useStudentId } from '@/app/providers/StudentProvider'
import { TierBadge } from '@/components/domain/TierBadge'
import { LinkButton } from '@/components/ui/Button'
import { RadialProgress } from '@/components/ui/RadialProgress'
import { ROUTES } from '@/constants/routes'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { BLOCK_COLORS, TIER_STYLES, pct } from '@/lib/tiers'

interface Props {
  detail: ConceptDetail
  all: ConceptDetail[]
  blockName: string
  onSelect: (concept: string) => void
  onClose?: () => void
}

function Related({ title, names, all, onSelect, highlight }: { title: string; names: string[]; all: ConceptDetail[]; onSelect: (c: string) => void; highlight?: string | null }) {
  const tierFor = useTierFor()
  if (names.length === 0) return null
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul className="space-y-1">
        {names.map((n) => {
          const b = all.find((c) => c.concept === n)?.belief ?? 0
          return (
            <li key={n}>
              <button onClick={() => onSelect(n)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-raised">
                <span className="flex-1 truncate">{n}{highlight === n && <span className="ml-1.5 text-xs font-semibold text-mid">weakest</span>}</span>
                <span className={cn('text-xs font-medium tabular-nums', TIER_STYLES[tierFor(b)].text)}>{pct(b)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Everything known about one concept, all from GET /concepts (+ the curated resources). */
export function ConceptDetailPanel({ detail, all, blockName, onSelect, onClose }: Props) {
  const id = useStudentId()
  const resources = useResources(id)
  const res = resources.data?.find((r) => r.concept === detail.concept)
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <RadialProgress value={detail.belief} size={84} stroke={9} label={`${detail.concept} estimated mastery`}>
          <span className="text-lg font-semibold tabular-nums">{pct(detail.belief)}</span>
        </RadialProgress>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-tight">{detail.concept}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><span className="size-2 rounded-full" style={{ background: BLOCK_COLORS[detail.block_index] }} aria-hidden />{blockName}</p>
          <TierBadge belief={detail.belief} className="mt-2" />
        </div>
        {onClose && <button onClick={onClose} aria-label="Close details" className="rounded-md p-1 text-muted hover:bg-raised hover:text-text"><X className="size-5" /></button>}
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        {[
          ['Answers', String(detail.attempts)],
          ['Accuracy', detail.accuracy === null ? '–' : pct(detail.accuracy)],
          ['Last answered', detail.last_attempt_at ? formatDate(detail.last_attempt_at) : 'never'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-raised/50 p-2.5">
            <dd className="text-sm font-semibold">{v}</dd>
            <dt className="text-[11px] text-muted">{k}</dt>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">
        {detail.attempts === 0
          ? 'No questions answered here yet. This estimate is inferred from related concepts through the knowledge graph.'
          : 'An estimate built from all your answers, including related concepts up to two hops away.'}
      </p>

      <Related title="Builds on" names={detail.prerequisites} all={all} onSelect={onSelect} highlight={detail.weakest_prerequisite} />
      {detail.prerequisites.length === 0 && <p className="text-sm text-muted">A foundational concept: it has no prerequisites.</p>}
      <Related title="Needed for" names={detail.dependents} all={all} onSelect={onSelect} />

      {res && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Learn more</p>
          <ul className="space-y-1.5 text-sm">
            {[res.video, res.deep_dive].map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-primary hover:underline">
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{l.title}</span>{l.seen && <span className="text-xs text-muted">(seen)</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <LinkButton to={ROUTES.learn} variant="secondary" className="w-full" icon={<ArrowRight className="size-4" />}>Practise in {blockName}</LinkButton>
    </div>
  )
}
