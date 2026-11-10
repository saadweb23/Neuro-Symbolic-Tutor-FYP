import { useNavigate } from 'react-router-dom'
import { useGraph, useRecommendation, useSession, useStartSession } from '@/api/queries/hooks'
import { useStudentId } from '@/app/providers/StudentProvider'
import { ROUTES } from '@/constants/routes'

export interface LearningAction {
  label: string
  loading: boolean
  disabled: boolean
  /** navigates; for "start" it first creates the session (POST /session/start) */
  run: () => void
  error: unknown
}

/** The single primary call-to-action: resume the active session, start the server-suggested block,
 *  or (curriculum complete) review mastery. Reads only side-effect-free endpoints. */
export function useLearningAction(): LearningAction {
  const id = useStudentId()
  const navigate = useNavigate()
  const session = useSession(id)
  const rec = useRecommendation(id)
  const graph = useGraph()
  const start = useStartSession(id)

  const blockName = (i: number | null | undefined) => (i == null ? null : graph.data?.blocks[i]?.name ?? null)

  if (session.data?.active) {
    return { label: `Resume ${blockName(session.data.block_index) ?? 'session'}`, loading: false, disabled: false, run: () => navigate(ROUTES.session), error: null }
  }
  if (rec.data?.state === 'complete') {
    return { label: 'Review your mastery', loading: false, disabled: false, run: () => navigate(ROUTES.mastery), error: null }
  }
  const index = rec.data?.block_index
  return {
    label: rec.data?.block_name ? `Start ${rec.data.block_name}` : 'Choose a focus area',
    loading: start.isPending,
    disabled: session.isPending || rec.isPending,
    error: start.error,
    run: () => {
      if (index == null) return navigate(ROUTES.learn)
      start.mutate(index, { onSuccess: () => navigate(ROUTES.session) })
    },
  }
}
