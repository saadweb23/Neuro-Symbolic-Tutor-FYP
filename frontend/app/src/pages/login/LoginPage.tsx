import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { login } from '@/api/auth'
import { fetchStatus } from '@/api/queries/hooks'
import { keys } from '@/api/queries/keys'
import { ApiError } from '@/api/client'
import type { StudentStatus } from '@/api/types'
import { useStudentContext } from '@/app/providers/StudentProvider'
import { BrandMark } from '@/components/brand/BrandMark'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ROUTES } from '@/constants/routes'

/** Where a student with this status should land. Decided by the server's record. */
export function destinationFor(status: StudentStatus): string {
  if (!status.placement_completed) return ROUTES.placement
  return status.has_active_session ? ROUTES.session : ROUTES.dashboard
}

export function LoginPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { studentId, loading, setUser } = useStudentContext()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  // Already signed in: skip the form.
  if (!loading && studentId && !busy) return <Navigate to={ROUTES.root} replace />

  const missing = touched && (!username.trim() || !password)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!username.trim() || !password || busy) return
    setBusy(true)
    setError(null)
    try {
      const user = await login(username.trim(), password, remember)
      setUser(user)
      const status = await qc.fetchQuery({ queryKey: keys.status(user.student_id), queryFn: () => fetchStatus(user.student_id), staleTime: 0 })
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== ROUTES.login && status.placement_completed ? from : destinationFor(status), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={56} />
          <h1 className="mt-4 text-2xl font-semibold">Sign in to NeuroTutor</h1>
          <p className="mt-1 text-sm text-muted">Enter your username and password to continue.</p>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium">Username</label>
            <Input
              id="username" name="username" value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus
              invalid={missing && !username.trim()} aria-describedby={error ? 'login-error' : undefined}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
            <div className="relative">
              <Input
                id="password" name="password" type={show ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                invalid={missing && !password} className="pr-11" aria-describedby={error ? 'login-error' : undefined}
              />
              <button
                type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-text"
              >
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
            Keep me signed in for 30 days
          </label>

          {missing && <p className="text-sm text-bad" role="alert">Enter your username and password.</p>}
          {error && <p id="login-error" className="rounded-md border border-bad/40 bg-bad-soft p-3 text-sm text-bad" role="alert">{error}</p>}

          <Button type="submit" size="lg" className="w-full" loading={busy} icon={!busy ? <LogIn className="size-5" /> : undefined}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
