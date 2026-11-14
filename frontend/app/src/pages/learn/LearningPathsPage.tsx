import { ArrowRight, Eye, Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBlocks, useConcepts, useMastery, useRecommendation, useSession, useStartSession } from '@/api/queries/hooks'
import type { BlockProgress } from '@/api/types'
import { useMetaConfig } from '@/app/providers/MetaProvider'
import { useStudentId } from '@/app/providers/StudentProvider'
import { BlockCard, blockStatus } from '@/components/domain/BlockCard'
import { ErrorState } from '@/components/feedback/ErrorState'
import { QueryBoundary } from '@/components/feedback/QueryBoundary'
import { Button, LinkButton } from '@/components/ui/Button'
import { ConfirmationDialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Reveal } from '@/components/ui/Reveal'
import { FocusAreasHeading, JourneyExtras, JourneyOverview, RoadmapSection } from './Journey'
import { ROUTES } from '@/constants/routes'

export function LearningPathsPage() {
  const id = useStudentId()
  const navigate = useNavigate()
  const cfg = useMetaConfig()
  const blocks = useBlocks(id)
  const mastery = useMastery(id)
  const concepts = useConcepts(id)
  const session = useSession(id)
  const rec = useRecommendation(id)
  const start = useStartSession(id)
  const [pending, setPending] = useState<BlockProgress | null>(null)

  const activeIndex = session.data?.active ? session.data.block_index : null
  const activeBlock = activeIndex !== null ? blocks.data?.[activeIndex] : undefined

  const begin = (b: BlockProgress) =>
    start.mutate(b.index, {
      onSuccess: () => {
        setPending(null)
        navigate(ROUTES.session)
      },
    })

  const choose = (b: BlockProgress) => {
    if (activeIndex === b.index) return navigate(ROUTES.session) // resume: never POST /session/start, it resets the rounds
    if (activeIndex !== null) return setPending(b) // switching: confirm first
    begin(b)
  }

  return (
    <div>
      <PageHeader title="Learning paths" description={`Each focus area is a self-contained session: 5 concepts, up to ${cfg.session_round_cap} rounds. Pick the one that needs the most work, or whichever you'd like to practise. The agent chooses the concept inside it.`} />
      {start.isError && <ErrorState compact className="mb-4" error={start.error} />}
      <div className="mb-8 space-y-8">
        <Reveal><JourneyOverview /></Reveal>
        <Reveal><RoadmapSection /></Reveal>
      </div>
      <FocusAreasHeading />
      <QueryBoundary query={blocks} lines={5}>
        {(bs) => (
          <div className="grid gap-5 lg:grid-cols-2">
            {bs.map((b) => {
              const attempted = b.concepts.filter((c) => (concepts.data?.find((x) => x.concept === c)?.attempts ?? 0) > 0).length
              const active = activeIndex === b.index
              const status = blockStatus(b, { attempted, active })
              const suggested = rec.data?.suggested === true && rec.data.block_index === b.index
              return (
                <div key={b.index} id={`block-${b.index}`} className="scroll-mt-24">
                <BlockCard
                  block={b}
                  status={status}
                  active={active}
                  suggested={suggested}
                  beliefs={mastery.data}
                  footer={
                    b.complete ? (
                      <LinkButton to={`${ROUTES.mastery}?block=${b.index}`} variant="secondary" icon={<Eye className="size-4" />}>Review concepts</LinkButton>
                    ) : active ? (
                      <Button onClick={() => choose(b)} icon={<ArrowRight className="size-4" />}>Resume session</Button>
                    ) : (
                      <Button variant={suggested ? 'primary' : 'secondary'} onClick={() => choose(b)} loading={start.isPending && start.variables === b.index} disabled={start.isPending}
                        icon={status === 'in_progress' ? <RotateCcw className="size-4" /> : <Play className="size-4" />}>
                        {status === 'in_progress' ? 'Continue learning' : 'Start learning'}
                      </Button>
                    )
                  }
                />
                </div>
              )
            })}
          </div>
        )}
      </QueryBoundary>

      <div className="mt-10"><Reveal><JourneyExtras /></Reveal></div>

      <ConfirmationDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Switch to ${pending?.name ?? 'this block'}?`}
        description={`You have a session in progress in ${activeBlock?.name ?? 'another block'}. Starting ${pending?.name ?? 'this one'} ends it and resets the round count. Your mastery progress in every block is kept.`}
        confirmLabel="Switch focus area"
        loading={start.isPending}
        onConfirm={() => pending && begin(pending)}
      />
    </div>
  )
}
