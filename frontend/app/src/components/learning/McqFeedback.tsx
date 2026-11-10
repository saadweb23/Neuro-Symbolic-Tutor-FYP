import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { McqResult } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { useKeyShortcuts } from '@/hooks/useKeyShortcuts'
import { cn } from '@/lib/cn'
import { BeliefDelta } from './BeliefDelta'
import { RichText } from './RichText'

/** Instant feedback after grading: result (icon + text), the explanation, the belief change. */
export function McqFeedback({ result, concept, before, onContinue, busy }: { result: McqResult; concept: string; before: number; onContinue: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => ref.current?.focus(), []) // move focus so keyboard / screen-reader users land on the result
  useKeyShortcuts({ Enter: onContinue }, !busy)
  const ok = result.passed
  return (
    <div ref={ref} tabIndex={-1} role="region" aria-label="Answer feedback" className={cn('rounded-lg border p-5 outline-none', ok ? 'border-good/40 bg-good-soft' : 'border-bad/40 bg-bad-soft')}>
      <p className={cn('flex items-center gap-2 text-lg font-semibold', ok ? 'text-good' : 'text-bad')}>
        {ok ? <CheckCircle2 className="size-5" aria-hidden /> : <XCircle className="size-5" aria-hidden />}
        {ok ? 'Correct' : 'Not quite'}
      </p>
      <div className="mt-2 text-sm text-text/90"><RichText text={result.explanation} /></div>
      <BeliefDelta className="mt-4" concept={concept} before={before} after={result.updated_belief} />
      <Button className="mt-5 w-full sm:w-auto" onClick={onContinue} loading={busy} icon={<ArrowRight className="size-4" />}>Continue</Button>
    </div>
  )
}
