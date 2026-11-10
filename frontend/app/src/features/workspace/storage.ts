import { isActiveStep, type ActiveStep, type NextStep } from '@/api/types'
import { safeStorage } from '@/constants/storage'

const stepKey = (studentId: string) => `nt_step_${studentId}`

/** The step the student is looking at is saved for the tab session so a reload (or the React
 *  StrictMode double-mount in dev) restores it instead of calling GET /next again -- /next consumes
 *  a learning round. Re-submitting a restored question is safe: /mcq-answer is idempotent. */
export function readStoredStep(studentId: string): ActiveStep | null {
  try {
    const raw = safeStorage.get(stepKey(studentId), sessionStorage)
    if (!raw) return null
    const step = JSON.parse(raw) as NextStep
    return isActiveStep(step) ? step : null
  } catch {
    return null
  }
}
export const clearStoredStep = (studentId: string) => safeStorage.remove(stepKey(studentId), sessionStorage)
export const storeStep = (studentId: string, step: ActiveStep) => safeStorage.set(stepKey(studentId), JSON.stringify(step), sessionStorage)

