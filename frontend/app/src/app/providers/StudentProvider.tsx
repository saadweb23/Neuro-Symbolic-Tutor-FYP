import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { safeStorage, STORAGE_KEYS } from '@/constants/storage'

interface StudentCtx {
  /** The signed-in student id (identity is the id alone; there is no password). */
  studentId: string | null
  recentIds: string[]
  setStudent: (id: string) => void
  /** "Switch student": forgets the id on this device and drops every cached response. Server data is untouched. */
  clearStudent: () => void
}

const Ctx = createContext<StudentCtx | null>(null)

function readRecents(): string[] {
  try {
    const raw = JSON.parse(safeStorage.get(STORAGE_KEYS.recentStudents) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, 5) : []
  } catch {
    return []
  }
}

export function StudentProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [studentId, setId] = useState<string | null>(() => safeStorage.get(STORAGE_KEYS.currentStudent))
  const [recentIds, setRecents] = useState<string[]>(readRecents)

  const setStudent = useCallback((id: string) => {
    safeStorage.set(STORAGE_KEYS.currentStudent, id)
    setId(id)
    setRecents((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 5)
      safeStorage.set(STORAGE_KEYS.recentStudents, JSON.stringify(next))
      return next
    })
  }, [])

  const clearStudent = useCallback(() => {
    safeStorage.remove(STORAGE_KEYS.currentStudent)
    setId(null)
    qc.clear()
  }, [qc])

  const value = useMemo(() => ({ studentId, recentIds, setStudent, clearStudent }), [studentId, recentIds, setStudent, clearStudent])
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
