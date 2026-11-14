import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
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
import { FloatingBackdrop } from '@/pages/welcome/FloatingBackdrop'

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
  const { signOut, user } = useStudentContext()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const status = useStatus(id)
  const start = usePlacementStart(id)
  const submit = usePlacementSubmit(id)

  const [saved] = useState(() => readSaved(id))
  const [questions, setQuestions] = useState<PlacementQuestion[] | null>(saved?.questions ?? null)
  const [answers, setAnswers] = useState<PlacementAnswer[]>(saved?.answers ?? [])
  // Which question is on screen. Answers form a prefix: a refresh resumes at the first unanswered
  // question, and "Previous" can revisit (and change) any answered one before the final submit.
  const [cursor, setCursor] = useState(() => (saved ? Math.min(saved.answers.length, saved.questions.length - 1) : 0))
  const [direction, setDirection] = useState(1)
  const [picked, setPicked] = useState<number | null>(() => (saved ? saved.answers[Math.min(saved.answers.length, saved.questions.length - 1)]?.selected_index ?? null : null))
  const shownAt = useRef(Date.now())
  const spent = useRef<Record<number, number>>({})   // seconds already spent on each question (revisits add up)
  const startedRef = useRef(false) // StrictMode runs effects twice in dev: never generate two quizzes
  const finishingRef = useRef(false) // ... or submit twice
  const [submitted, setSubmitted] = useState(false) // set while/after this page submits, so a refreshed status does not bounce us
  const [error, setError] = useState<unknown>(null)

  const alreadyPlaced = !!status.data?.placement_completed && !submitted

  // Generate the quiz once (POST that stores the questions server-side).
  useEffect(() => {
    if (!status.data || alreadyPlaced || questions || startedRef.current) return
    startedRef.current = true
    start.mutate(undefined, {
      onSuccess: (data) => {
        setQuestions(data.questions)
        safeStorage.set(progressKey(id), JSON.stringify({ questions: data.questions, answers: [] }), sessionStorage)
        shownAt.current = Date.now()
      },
      onError: (e) => setError(e),
    })
  }, [status.data, alreadyPlaced, questions, start, id])

  const total = questions?.length ?? 0
  const current = questions?.[cursor]

  const finish = async (all: PlacementAnswer[]) => {
    if (finishingRef.current) return
    finishingRef.current = true
    setSubmitted(true)
    setError(null)
    try {
      const result = await submit.mutateAsync(all)
      qc.setQueryData<Beliefs>(placementResultKey(id), result.beliefs)
      safeStorage.remove(progressKey(id), sessionStorage)
      navigate(ROUTES.placementResults, { replace: true })
    } catch (e) {
      finishingRef.current = false
      setSubmitted(false)
      if (e instanceof ApiError && e.status === 409) {
        navigate(ROUTES.dashboard, { replace: true }) // already placed elsewhere: nothing to redo
        return
      }
      setError(e)
    }
  }

  // A refresh after the last answer but before scoring finished: send what was saved (the server refuses a second placement).
  useEffect(() => {
    if (questions && questions.length > 0 && answers.length === questions.length && !submitted && error == null) void finish(answers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions])

  const persist = (all: PlacementAnswer[]) => {
    if (questions) safeStorage.set(progressKey(id), JSON.stringify({ questions, answers: all }), sessionStorage)
  }
  const leave = () => { spent.current[cursor] = (spent.current[cursor] ?? 0) + (Date.now() - shownAt.current) / 1000 }
  const goTo = (index: number, all: PlacementAnswer[], dir: number) => {
    setDirection(dir)
    setCursor(index)
    setPicked(all[index]?.selected_index ?? null)
    shownAt.current = Date.now()
  }

  const next = () => {
    if (picked === null || !current || !questions || submit.isPending || submitted) return
    leave()
    const answer: PlacementAnswer = { content_id: current.content_id, selected_index: picked, time_taken: spent.current[cursor] ?? 0 }
    const all = cursor < answers.length ? answers.map((a, i) => (i === cursor ? answer : a)) : [...answers, answer]
    setAnswers(all)
    persist(all)
    if (cursor + 1 === total && all.length === total) void finish(all)
    else goTo(cursor + 1, all, 1)
  }

  const prev = () => {
    if (cursor === 0 || submit.isPending || submitted) return
    leave()
    goTo(cursor - 1, answers, -1)
  }

  const jump = (index: number) => {
    if (index === cursor || index > answers.length || submit.isPending || submitted) return
    leave()
    goTo(index, answers, index > cursor ? 1 : -1)
  }

  useKeyShortcuts({ Enter: next, ArrowLeft: prev }, !!current && !submit.isPending && !submitted)

  if (status.isPending) return <BrandLoader label="Loading…" className="min-h-svh justify-center" />
  if (status.isError) return <div className="mx-auto max-w-lg p-6"><ErrorState error={status.error} onRetry={() => status.refetch()} /></div>
  if (alreadyPlaced) return <Navigate to={ROUTES.dashboard} replace />

  const allAnswered = !!questions && answers.length === questions.length
  const isLast = cursor + 1 === total
  const firstName = user?.name.split(' ')[0]

  return (
    <FloatingBackdrop className="flex min-h-svh flex-col">
      <h1 className="sr-only">Placement quiz</h1>
      <header className="nt-glass border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <BrandMark size={24} />
          <Wordmark className="text-base" />
          <span className="ml-2 hidden text-sm text-muted sm:inline">Placement quiz{firstName ? ` · ${firstName}` : ''}</span>
          <button
            onClick={() => { void signOut().then(() => navigate(ROUTES.login, { replace: true })) }}
            className="ml-auto text-sm text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Sign out
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
        {allAnswered && (submit.isPending || submitted) && <BrandLoader label="Scoring your placement quiz…" />}

        {current && !submit.isPending && !submitted && (
          <Card className="overflow-hidden bg-surface/90 shadow-raised backdrop-blur-sm">
            <div className="h-1 w-full bg-raised" aria-hidden>
              <motion.div className="h-full origin-left" style={{ background: 'var(--grad-brand)' }} initial={false} animate={{ scaleX: answers.length / total }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
            </div>
            <div className="p-5 sm:p-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={current.concept} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                    {current.concept}
                  </motion.span>
                </AnimatePresence>
                <span className="text-sm text-muted" aria-live="polite">Question <b className="text-text tabular-nums">{cursor + 1}</b> of {total}</span>
              </div>

              <ol className="mb-6 flex gap-1.5" aria-label="Placement progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answers.length}>
                {Array.from({ length: total }, (_, i) => {
                  const reachable = i <= answers.length && i !== cursor
                  return (
                    <li key={i} className="flex-1">
                      <button
                        type="button" tabIndex={reachable ? 0 : -1} disabled={!reachable} onClick={() => jump(i)}
                        aria-label={`Question ${i + 1}${i < answers.length ? ' (answered)' : ''}`} aria-current={i === cursor ? 'step' : undefined}
                        className={cn('block h-2 w-full rounded-full transition-all duration-300', i === cursor ? 'scale-y-150 bg-primary' : i < answers.length ? 'bg-primary/60 hover:bg-primary' : 'bg-raised', !reachable && 'cursor-default')}
                      />
                    </li>
                  )
                })}
              </ol>

              {/* enter-only transition: the next question is interactive immediately, so a fast 1-4 + Enter never lands on a frozen exiting question */}
              <motion.div key={current.content_id} initial={{ opacity: 0, x: 36 * direction }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                <McqQuestion question={current.question} choices={current.choices} selected={picked} onSelect={setPicked} />
              </motion.div>

              <div className="mt-7 flex items-center justify-between gap-3">
                <Button variant="secondary" size="lg" onClick={prev} disabled={cursor === 0} icon={<ArrowLeft className="size-5" />}>Previous</Button>
                <p className="hidden text-xs text-muted md:block">Press 1-4 to choose, Enter for next, ← for previous.</p>
                <Button size="lg" onClick={next} disabled={picked === null} icon={isLast ? <Check className="size-5" /> : <ArrowRight className="size-5" />}>
                  {isLast ? 'Finish placement' : 'Next'}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </FloatingBackdrop>
  )
}
