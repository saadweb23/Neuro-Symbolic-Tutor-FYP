import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { logout, useMe, type AuthUser } from '@/api/auth'
import { keys } from '@/api/queries/keys'
import { STORAGE_KEYS } from '@/constants/storage'

/** Cached data that is not about the student, so it survives a sign-out. */
const KEEP = new Set(['auth', 'meta', 'graph'])

/** Half-finished quiz answers and the saved learning step belong to the person who signed out. */
function forgetDeviceState() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('nt_') && k !== STORAGE_KEYS.booted) sessionStorage.removeItem(k)
  } catch {
    /* storage unavailable */
  }
}

interface StudentCtx {
  /** The signed-in account (from the server session), or null when signed out. */
  user: AuthUser | null
  /** The signed-in student's id: always the account's own student id. */
  studentId: string | null
  /** True until the first GET /auth/me answers. */
  loading: boolean
  /** Records a successful sign-in so guards and pages react immediately. */
  setUser: (user: AuthUser) => void
  /** Signs out on the server (revokes the session), then drops every cached response. */
  signOut: () => Promise<void>
}

const Ctx = createContext<StudentCtx | null>(null)

export function StudentProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const me = useMe()
  const user = me.data ?? null

  const setUser = useCallback((u: AuthUser) => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] === 'student' })
    qc.setQueryData(keys.me, u)
  }, [qc])

  /** Order matters. The signed-in pages are still mounted while we sign out, so (1) stop their in-flight
   *  requests, (2) end the server session, (3) mark the account as gone, which makes the route guards
   *  unmount those pages and redirect to /login, and only then (4) drop the cached data. Clearing the
   *  cache first made the mounted pages refetch, get 401, and flash "Sign in to continue". */
  const signOut = useCallback(async () => {
    await qc.cancelQueries()
    try {
      await logout()
    } catch {
      /* the session may already be gone (expired / signed out elsewhere); the local state is cleared either way */
    }
    forgetDeviceState()
    qc.setQueryData(keys.me, null)
    window.setTimeout(() => qc.removeQueries({ predicate: (q) => !KEEP.has(String(q.queryKey[0])) }), 0)
  }, [qc])

  useEffect(() => {
    const onExpired = () => qc.setQueryData(keys.me, null)   // guards then send the visitor to /login
    window.addEventListener('neurotutor:unauthorized', onExpired)
    return () => window.removeEventListener('neurotutor:unauthorized', onExpired)
  }, [qc])

  const value = useMemo(
    () => ({ user, studentId: user?.student_id ?? null, loading: me.isPending, setUser, signOut }),
    [user, me.isPending, setUser, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStudentContext(): StudentCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStudentContext must be used inside <StudentProvider>')
  return v
}

/** For pages behind the RequireStudent guard: the id is guaranteed to exist. */
// eslint-disable-next-line react-refresh/only-export-components
export function useStudentId(): string {
  const { studentId } = useStudentContext()
  if (!studentId) throw new Error('useStudentId called without a signed-in student')
  return studentId
}
