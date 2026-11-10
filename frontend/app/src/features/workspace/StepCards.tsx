import { Check, ExternalLink } from 'lucide-react'
import type { EscalationStep, PracticeStep, ViewedResult, VideoStep, McqResult } from '@/api/types'
import { BeliefDelta } from '@/components/learning/BeliefDelta'
import { McqFeedback } from '@/components/learning/McqFeedback'
import { McqQuestion } from '@/components/learning/McqQuestion'
import { VideoPlayer } from '@/components/learning/VideoPlayer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { useKeyShortcuts } from '@/hooks/useKeyShortcuts'
import { ArrowRight } from 'lucide-react'


export function PracticeStepCard({ step, selected, onSelect, submitting, result, onSubmit, onContinue, error, continuing }: {
  step: PracticeStep
  selected: number | null
  onSelect: (i: number) => void
  submitting: boolean
  result: McqResult | null
  onSubmit: () => void
  onContinue: () => void
  error: unknown
  continuing: boolean
}) {
  useKeyShortcuts({ Enter: onSubmit }, !result && selected !== null && !submitting)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Practice question</h3>
        <span className="rounded-full bg-raised px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted">{step.content.difficulty}</span>
      </div>
      <McqQuestion question={step.content.question} choices={step.content.choices} selected={selected} onSelect={onSelect} disabled={submitting} reveal={result ? { correctIndex: result.correct_index } : undefined} />
      {error != null && !result && <ErrorState compact className="mt-4" error={error} onRetry={onSubmit} title="Could not submit your answer" />}
      {!result ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="hidden text-xs text-muted sm:block">Press 1-4 to choose, Enter to submit.</p>
          <Button size="lg" className="ml-auto w-full sm:w-auto" onClick={onSubmit} disabled={selected === null} loading={submitting}>
            {submitting ? 'Submitting…' : 'Submit answer'}
          </Button>
        </div>
      ) : (
        <div className="mt-5">
          <McqFeedback result={result} concept={step.concept} before={step.mastery_belief} onContinue={onContinue} busy={continuing} />
        </div>
      )}
    </div>
  )
}

export function VideoStepCard({ step, submitting, viewed, onDone, onContinue, error, continuing }: {
  step: VideoStep
  submitting: boolean
  viewed: ViewedResult | null
  onDone: () => void
  onContinue: () => void
  error: unknown
  continuing: boolean
}) {
  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold">{step.content.title}</h3>
      <VideoPlayer title={step.content.title} url={step.content.url} source={step.content.source} />
      <ViewedFooter label="Mark watched" busyLabel="Saving…" submitting={submitting} viewed={viewed} before={step.mastery_belief} concept={step.concept} onDone={onDone} onContinue={onContinue} error={error} continuing={continuing} />
    </div>
  )
}

export function DeepDiveStepCard({ step, submitting, viewed, onDone, onContinue, error, continuing }: {
  step: EscalationStep
  submitting: boolean
  viewed: ViewedResult | null
  onDone: () => void
  onContinue: () => void
  error: unknown
  continuing: boolean
}) {
  return (
    <div>
      <h3 className="mb-1 text-lg font-semibold">{step.content.title}</h3>
      <p className="mb-4 text-sm text-muted">Open the official documentation, read the section, then come back and mark it as read.</p>
      <a href={step.content.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-primary hover:bg-raised">
        Open on {step.content.source} <ExternalLink className="size-4" aria-hidden />
      </a>
      <ViewedFooter label="Mark read" busyLabel="Saving…" submitting={submitting} viewed={viewed} before={step.mastery_belief} concept={step.concept} onDone={onDone} onContinue={onContinue} error={error} continuing={continuing} />
    </div>
  )
}

function ViewedFooter({ label, busyLabel, submitting, viewed, before, concept, onDone, onContinue, error, continuing }: {
  label: string
  busyLabel: string
  submitting: boolean
  viewed: ViewedResult | null
  before: number
  concept: string
  onDone: () => void
  onContinue: () => void
  error: unknown
  continuing: boolean
}) {
  useKeyShortcuts({ Enter: viewed ? onContinue : onDone }, !submitting && !continuing)
  return (
    <div className="mt-5">
      {error != null && !viewed && <ErrorState compact className="mb-3" error={error} onRetry={onDone} title="Could not save" />}
      {viewed ? (
        <div className="rounded-lg border border-border bg-raised/60 p-4">
          <BeliefDelta concept={concept} before={before} after={viewed.updated_belief} />
          <Button className="mt-4" onClick={onContinue} loading={continuing} icon={<ArrowRight className="size-4" />}>Continue</Button>
        </div>
      ) : (
        <Button size="lg" className="w-full" onClick={onDone} loading={submitting} icon={!submitting ? <Check className="size-5" /> : undefined}>
          {submitting ? busyLabel : label}
        </Button>
      )}
    </div>
  )
}
