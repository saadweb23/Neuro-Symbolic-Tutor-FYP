import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Keyboard } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, studentPath } from '@/api/client'
import { keys } from '@/api/queries/keys'
import type { SessionState } from '@/api/types'
import { useMetaConfig } from '@/app/providers/MetaProvider'
import { useStudentId } from '@/app/providers/StudentProvider'
import { BrandMark } from '@/components/brand/BrandMark'
import { BrandLoader } from '@/components/brand/BrandLoader'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ExplanationCallout } from '@/components/learning/ExplanationCallout'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfirmationDialog } from '@/components/ui/Dialog'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ROUTES } from '@/constants/routes'
import { ConceptPanel } from '@/features/workspace/ConceptPanel'
import { BlockCompleteCard, CurriculumCompleteCard, SessionPausedCard } from '@/features/workspace/EndStates'
import { ShortcutSheet } from '@/features/workspace/ShortcutSheet'
import { DeepDiveStepCard, PracticeStepCard, VideoStepCard } from '@/features/workspace/StepCards'
import { useWorkspace } from '@/features/workspace/useWorkspace'
import { useKeyShortcuts } from '@/hooks/useKeyShortcuts'
import { pct } from '@/lib/tiers'

/** Decide ONCE, from a fresh GET /session, whether there is a session to work in. Later session
 *  updates (a completed block clears it server-side) must not bounce the student out of the page
 *  before they have seen the completion card. */
export function WorkspacePage() {
  const id = useStudentId()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [initial, setInitial] = useState<SessionState | null>(null)
  const [error, setError] = useState<unknown>(null)
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true
    qc.fetchQuery({ queryKey: keys.session(id), queryFn: () => get<SessionState>(studentPath(id, '/session')), staleTime: 0 })
      .then((s) => (s.active ? setInitial(s) : navigate(ROUTES.learn, { replace: true })))
      .catch(setError)
  }, [id, qc, navigate])

  if (error != null) return <div className="mx-auto max-w-lg p-6"><ErrorState error={error} onRetry={() => { checked.current = false; setError(null); navigate(0) }} /></div>
  if (!initial) return <BrandLoader label="Opening your session…" className="min-h-svh justify-center" />
  return <Workspace session={initial} />
}

function Workspace({ session }: { session: SessionState }) {
  const id = useStudentId()
  const navigate = useNavigate()
  const { mastery_threshold } = useMetaConfig()
  const { state, dispatch, load, submitAnswer, markDone, extendSession, extending } = useWorkspace(id, session)
  const [confirmExit, setConfirmExit] = useState(false)
  const [help, setHelp] = useState(false)
  useKeyShortcuts({ '?': () => setHelp(true) })

  const step = state.phase === 'active' ? state.step : null
  const block = step?.block
  const terminal = state.phase === 'terminal' ? state.step : null
  const blockName = block?.name ?? (terminal && 'block_name' in terminal.content ? terminal.content.block_name : 'Learning session')
  const round = block ? `Round ${block.round_count} of ${block.round_cap}` : null
  const avg = block?.average_mastery ?? (terminal && 'average_mastery' in terminal.content ? terminal.content.average_mastery : null)

  return (
    <div className="min-h-svh">
      <h1 className="sr-only">Learning session: {blockName}</h1>
      <header className="nt-glass sticky top-0 z-20 border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Button variant="ghost" size="sm" onClick={() => setConfirmExit(true)} icon={<ArrowLeft className="size-4" />} aria-label="Leave session">
            <span className="hidden sm:inline">Exit</span>
          </Button>
          <BrandMark size={22} className="hidden sm:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{blockName}</p>
            {round && <p className="text-xs text-muted">{round}</p>}
          </div>
          {block && (
            <div className="hidden w-56 sm:block">
              <div className="mb-1 flex justify-between text-xs text-muted"><span>{pct(block.average_mastery)} average</span><span>target {pct(mastery_threshold)}</span></div>
              <ProgressBar value={avg ?? 0} target={mastery_threshold} label="Block average mastery" />
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setHelp(true)} aria-label="Keyboard shortcuts"><Keyboard className="size-4" /></Button>
        </div>
        {block && (
          <div className="mx-auto max-w-6xl px-4 pb-2" aria-hidden>
            <div className="flex gap-1">
              {Array.from({ length: block.round_cap }, (_, i) => (
                <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-raised">
                  <motion.span
                    className="block h-full origin-left rounded-full bg-primary"
                    initial={false}
                    animate={{ scaleX: i < block.round_count ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        {state.phase === 'loading' && <BrandLoader label="Consulting the tutoring agent…" className="py-24" />}
        {state.phase === 'error' && <div className="mx-auto max-w-lg"><ErrorState error={state.error} onRetry={() => void load()} title="Could not load the next step" /></div>}

        {terminal?.content_type === 'block_complete' && <div className="mx-auto max-w-2xl"><BlockCompleteCard step={terminal} /></div>}
        {terminal?.content_type === 'session_paused' && <div className="mx-auto max-w-2xl"><SessionPausedCard step={terminal} onContinue={() => void extendSession()} continuing={extending} /></div>}
        {terminal?.content_type === 'complete' && <div className="mx-auto max-w-2xl"><CurriculumCompleteCard step={terminal} /></div>}

        {state.phase === 'active' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <motion.div
              key={`${state.step.content_type}-${state.step.concept}-${state.step.attempt_number}`}
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0 space-y-5"
            >
              <ExplanationCallout text={state.step.explanation} />
              <Card>
                <CardBody className="p-5 sm:p-7">
                  {state.step.content_type === 'practice_problem' && (
                    <PracticeStepCard step={state.step} selected={state.selected} onSelect={(i) => dispatch({ type: 'select', index: i })} submitting={state.submitting} result={state.result}
                      onSubmit={() => void submitAnswer()} onContinue={() => void load()} error={state.actionError} continuing={false} />
                  )}
                  {state.step.content_type === 'video' && (
                    <VideoStepCard step={state.step} submitting={state.submitting} viewed={state.viewed} onDone={() => void markDone()} onContinue={() => void load()} error={state.actionError} continuing={false} />
                  )}
                  {state.step.content_type === 'escalation' && (
                    <DeepDiveStepCard step={state.step} submitting={state.submitting} viewed={state.viewed} onDone={() => void markDone()} onContinue={() => void load()} error={state.actionError} continuing={false} />
                  )}
                </CardBody>
              </Card>
            </motion.div>
            <div className="lg:sticky lg:top-28 lg:self-start">
              <ConceptPanel concept={state.step.concept} belief={state.result?.updated_belief ?? state.viewed?.updated_belief ?? state.step.mastery_belief} attemptNumber={state.step.attempt_number} />
            </div>
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={confirmExit}
        onOpenChange={setConfirmExit}
        title="Leave this session?"
        description="Your progress is saved. You can resume from the dashboard at any time."
        confirmLabel="Leave session"
        onConfirm={() => navigate(ROUTES.dashboard)}
      />
      <ShortcutSheet open={help} onOpenChange={setHelp} />
    </div>
  )
}
