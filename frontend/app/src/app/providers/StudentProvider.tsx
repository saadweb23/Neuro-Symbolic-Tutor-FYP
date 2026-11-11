import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { logout, useMe, type AuthUser } from '@/api/auth'
import { keys } from '@/api/queries/keys'

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

  const signOut = useCallback(async () => {
    try {
      await logout()
    } finally {
      qc.clear()
      qc.setQueryData(keys.me, null)
    }
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
