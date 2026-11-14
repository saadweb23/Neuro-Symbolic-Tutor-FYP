import { Link } from 'react-router-dom'
import { Stagger, StaggerItem } from '@/components/motion/Stagger'
import { useBlocks, useConcepts, useRecommendation, useSession } from '@/api/queries/hooks'
import { useStudentId } from '@/app/providers/StudentProvider'
import { BlockCard, blockStatus } from '@/components/domain/BlockCard'
import { TierBadge } from '@/components/domain/TierBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { Badge } from '@/components/ui/Badge'
import { Button, LinkButton } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ROUTES } from '@/constants/routes'
import { useLearningAction } from '@/features/dashboard/useLearningAction'
import { cn } from '@/lib/cn'
import { pct } from '@/lib/tiers'

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

