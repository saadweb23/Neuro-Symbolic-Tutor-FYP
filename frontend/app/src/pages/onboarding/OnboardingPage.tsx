import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, History as HistoryIcon, ListChecks, Target, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchStatus } from '@/api/queries/hooks'
import { keys } from '@/api/queries/keys'
import { useMetaConfig } from '@/app/providers/MetaProvider'
import { useStudentContext } from '@/app/providers/StudentProvider'
import { AnimatedCubeLogo } from '@/components/brand/AnimatedCubeLogo'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ROUTES } from '@/constants/routes'
import { checkStudentId, STUDENT_ID_MAX } from '@/lib/studentId'
import type { StudentStatus } from '@/api/types'

/** Where a student with this status should land. Decided by the server's record, not localStorage. */
export function destinationFor(status: StudentStatus): string {
  if (!status.placement_completed) return ROUTES.placement
  return status.has_active_session ? ROUTES.session : ROUTES.dashboard
}

export function OnboardingPage() {
  const cfg = useMetaConfig()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { studentId, recentIds, setStudent, clearStudent } = useStudentContext()
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [welcome, setWelcome] = useState<string | null>(null)

  const check = checkStudentId(value)
  const invalidMessage = touched && !check.ok ? check.reason : null

  const enter = async (rawId: string) => {
    const result = checkStudentId(rawId)
    if (!result.ok) {
      setTouched(true)
      return
    }
    setChecking(true)
    setError(null)
    try {
      const status = await qc.fetchQuery({ queryKey: keys.status(result.id), queryFn: () => fetchStatus(result.id), staleTime: 0 })
      setStudent(result.id)
      if (status.exists && status.placement_completed) setWelcome(result.id)
      navigate(destinationFor(status), { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setChecking(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void enter(value)
  }

  const steps = [
    { icon: UserRound, text: 'Enter a name or student ID. It is only a label; there is no password.' },
    { icon: ListChecks, text: `New here? A ${cfg.placement_concepts.length}-question placement quiz (about 5 minutes) sets your starting point.` },
    { icon: Target, text: 'Choose a focus area and start learning. Everything is saved under your ID.' },
  ]

  return (
    <div className="mx-auto grid min-h-[calc(100svh-8rem)] max-w-5xl items-center gap-10 px-4 py-10 md:grid-cols-2 md:px-6">
      <div className="hidden md:block">
        <AnimatedCubeLogo size={72} motion="hover" />
        <h1 className="mt-10 text-3xl font-semibold">Let&apos;s find your starting point</h1>
        <ul className="mt-6 space-y-4">
          {steps.map((s) => (
            <li key={s.text} className="flex gap-3 text-sm text-muted">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><s.icon className="size-4" aria-hidden /></span>
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <Card className="p-6 sm:p-8">
        <h2 className="text-2xl font-semibold md:text-xl">Get started</h2>
        <p className="mt-1 text-sm text-muted md:hidden">Enter an ID to begin. New students take a short placement quiz first.</p>

        {studentId && (
          <div className="mt-5 rounded-lg border border-primary/30 bg-primary-soft p-4">
            <p className="text-sm">
              You&apos;re signed in on this device as <strong>{studentId}</strong>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" loading={checking} onClick={() => void enter(studentId)} icon={<ArrowRight className="size-4" />}>Continue</Button>
              <Button size="sm" variant="secondary" onClick={clearStudent}>Use a different ID</Button>
            </div>
          </div>
        )}

        {!studentId && (
          <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
            <div>
              <label htmlFor="student-id" className="mb-1.5 block text-sm font-medium">Your name or student ID</label>
              <Input
                id="student-id"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="e.g. alex_khan"
                maxLength={STUDENT_ID_MAX + 10}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                invalid={!!invalidMessage}
                aria-describedby="student-id-help"
              />
              <p id="student-id-help" className={invalidMessage ? 'mt-1.5 text-sm text-bad' : 'mt-1.5 text-xs text-muted'}>
                {invalidMessage ?? 'IDs are case-sensitive: "Alex" and "alex" are different students.'}
              </p>
            </div>
            <Button type="submit" size="lg" className="w-full" loading={checking} icon={!checking ? <ArrowRight className="size-5" /> : undefined}>
              {checking ? 'Checking…' : 'Continue'}
            </Button>
          </form>
        )}

        {error != null && <ErrorState compact className="mt-4" error={error} onRetry={() => void enter(studentId ?? value)} />}
        {welcome && <p className="sr-only" role="status">Welcome back, {welcome}</p>}

        {!studentId && recentIds.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <HistoryIcon className="size-3.5" aria-hidden /> Recent on this device
            </p>
            <div className="flex flex-wrap gap-2">
              {recentIds.map((id) => (
                <button key={id} type="button" onClick={() => void enter(id)} disabled={checking} className="rounded-full border border-border px-3 py-1 text-sm hover:bg-raised disabled:opacity-50">
                  {id}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
