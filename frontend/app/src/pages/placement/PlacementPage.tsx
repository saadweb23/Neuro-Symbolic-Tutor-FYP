import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { useStatus, usePlacementStart, usePlacementSubmit } from '@/api/queries/hooks'
import type { Beliefs, PlacementAnswer, PlacementQuestion } from '@/api/types'
import { useStudentContext, useStudentId } from '@/app/providers/StudentProvider'
import { BrandMark, Wordmark } from '@/components/brand/BrandMark'
import { BrandLoader } from '@/components/brand/BrandLoader'
import { ErrorState } from '@/components/feedback/ErrorState'
import { McqQuestion } from '@/components/learning/McqQuestion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/constants/routes'
import { safeStorage } from '@/constants/storage'
import { useKeyShortcuts } from '@/hooks/useKeyShortcuts'
import { cn } from '@/lib/cn'

export const placementResultKey = (id: string) => ['placement-result', id] as const
const progressKey = (id: string) => `nt_placement_${id}`

interface Saved {
  questions: PlacementQuestion[]
  answers: PlacementAnswer[]
}

/** The quiz survives a page reload (sessionStorage) so a refresh does not regenerate it or lose answers. */
function readSaved(id: string): Saved | null {
  try {
    const raw = safeStorage.get(progressKey(id), sessionStorage)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Saved
    return Array.isArray(parsed.questions) && parsed.questions.length > 0 && Array.isArray(parsed.answers) ? parsed : null
  } catch {
    return null
  }
}

export function PlacementPage() {
  const id = useStudentId()
  const { clearStudent } = useStudentContext()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const status = useStatus(id)
  const start = usePlacementStart(id)
  const submit = usePlacementSubmit(id)

  const [saved] = useState(() => readSaved(id))
  const [questions, setQuestions] = useState<PlacementQuestion[] | null>(saved?.questions ?? null)
  const [answers, setAnswers] = useState<PlacementAnswer[]>(saved?.answers ?? [])
  const [selected, setSelected] = useState<number | null>(null)
  const questionShownAt = useRef(Date.now())
  const startedRef = useRef(false) // StrictMode runs effects twice in dev: never generate two quizzes
  const [submitted, setSubmitted] = useState(false) // set while/after this page submits, so a refreshed status does not bounce us
  const [error, setError] = useState<unknown>(null)

  const alreadyPlaced = !!status.data?.placement_completed && !submitted

  // Generate the quiz once (GET-free POST that stores the questions server-side).
  useEffect(() => {
    if (!status.data || alreadyPlaced || questions || startedRef.current) return
    startedRef.current = true
    start.mutate(undefined, {
      onSuccess: (data) => {
        setQuestions(data.questions)
        safeStorage.set(progressKey(id), JSON.stringify({ questions: data.questions, answers: [] }), sessionStorage)
        questionShownAt.current = Date.now()
      },
      onError: (e) => setError(e),
    })
  }, [status.data, alreadyPlaced, questions, start, id])

  const index = answers.length
  const current = questions?.[index]

  const finish = async (all: PlacementAnswer[]) => {
    setSubmitted(true)
    setError(null)
    try {
      const result = await submit.mutateAsync(all)
      qc.setQueryData<Beliefs>(placementResultKey(id), result.beliefs)
      safeStorage.remove(progressKey(id), sessionStorage)
      navigate(ROUTES.placementResults, { replace: true })
    } catch (e) {
      setSubmitted(false)
      if (e instanceof ApiError && e.status === 409) {
        navigate(ROUTES.dashboard, { replace: true }) // already placed elsewhere: nothing to redo
        return
      }
      setError(e)
    }
  }

  const next = () => {
    if (selected === null || !current || submit.isPending) return
    const answer: PlacementAnswer = {
      content_id: current.content_id,
      selected_index: selected,
      time_taken: (Date.now() - questionShownAt.current) / 1000,
    }
    const all = [...answers, answer]
    setAnswers(all)
    setSelected(null)
    questionShownAt.current = Date.now()
    if (questions) safeStorage.set(progressKey(id), JSON.stringify({ questions, answers: all }), sessionStorage)
    if (questions && all.length === questions.length) void finish(all)
  }

  useKeyShortcuts({ Enter: next }, !!current && !submit.isPending)

  if (status.isPending) return <BrandLoader label="Loading…" className="min-h-svh justify-center" />
  if (status.isError) return <div className="mx-auto max-w-lg p-6"><ErrorState error={status.error} onRetry={() => status.refetch()} /></div>
  if (alreadyPlaced) return <Navigate to={ROUTES.dashboard} replace />

  const total = questions?.length ?? 0
  const allAnswered = questions && answers.length === questions.length

  return (
    <div className="flex min-h-svh flex-col">
      <h1 className="sr-only">Placement quiz</h1>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <BrandMark size={24} />
          <Wordmark className="text-base" />
          <span className="ml-2 hidden text-sm text-muted sm:inline">Placement quiz</span>
          <button
            onClick={() => { clearStudent(); navigate(ROUTES.start) }}
            className="ml-auto text-sm text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Switch student
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-8">
        {error != null && (
          <ErrorState error={error} className="mb-4" onRetry={() => {
            if (allAnswered) void finish(answers)
            else { startedRef.current = false; setError(null); start.reset(); setQuestions(null) }
          }} />
        )}

        {!questions && error == null && <BrandLoader label="Preparing your placement quiz…" />}
        {allAnswered && submit.isPending && <BrandLoader label="Scoring your placement quiz…" />}

        {current && !submit.isPending && (
          <Card className="p-5 sm:p-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">{current.concept}</span>
              <span className="text-sm text-muted" aria-live="polite">Question {index + 1} of {total}</span>
            </div>
            <div className="mb-6 flex gap-1.5" role="progressbar" aria-label="Placement progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index}>
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < index ? 'bg-primary' : i === index ? 'bg-primary/40' : 'bg-raised')} />
              ))}
            </div>

            <McqQuestion key={current.content_id} question={current.question} choices={current.choices} selected={selected} onSelect={setSelected} />

            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="hidden text-xs text-muted sm:block">Tip: press 1-4 to choose, Enter to continue.</p>
              <Button size="lg" onClick={next} disabled={selected === null} className="ml-auto" icon={index + 1 === total ? <Check className="size-5" /> : <ArrowRight className="size-5" />}>
                {index + 1 === total ? 'Finish placement' : 'Next'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
