import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContinueSession, useMarkViewed, useNextStep, useSubmitMcq } from '@/api/queries/hooks'
import { keys } from '@/api/queries/keys'
import { isActiveStep, type SessionState } from '@/api/types'
import { ROUTES } from '@/constants/routes'
import { initialState, workspaceReducer, type TerminalStep } from './reducer'
import { clearStoredStep, readStoredStep, storeStep } from './storage'

export function useWorkspace(studentId: string, session: SessionState) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(workspaceReducer, initialState)
  const nextStep = useNextStep(studentId)
  const submitMcq = useSubmitMcq(studentId)
  const markViewed = useMarkViewed(studentId)
  const continueSession = useContinueSession(studentId)
  const inFlight = useRef(false)
  const booted = useRef(false)

  const refreshSession = useCallback(() => {
    void qc.invalidateQueries({ queryKey: keys.session(studentId) })
    void qc.invalidateQueries({ queryKey: keys.blocks(studentId) })
  }, [qc, studentId])

  /** The ONLY place GET /next is called, and only from an explicit start / continue. */
  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    clearStoredStep(studentId)
    dispatch({ type: 'load' })
    try {
      const step = await nextStep.mutateAsync()
      if (step.content_type === 'no_session') {
        navigate(ROUTES.learn, { replace: true })
        return
      }
      if (isActiveStep(step)) {
        storeStep(studentId, step)
        dispatch({ type: 'active', step, now: Date.now() })
      } else {
        dispatch({ type: 'terminal', step: step as TerminalStep })
      }
      refreshSession()
    } catch (error) {
      dispatch({ type: 'loadFailed', error })
    } finally {
      inFlight.current = false
    }
  }, [studentId, nextStep, navigate, refreshSession])

  // Restore a saved step for this session, otherwise ask for the first one -- once (StrictMode-safe).
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const stored = readStoredStep(studentId)
    if (stored && session.active && stored.block.index === session.block_index) {
      dispatch({ type: 'active', step: stored, now: Date.now() })
    } else {
      void load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitAnswer = useCallback(async () => {
    if (state.phase !== 'active' || state.step.content_type !== 'practice_problem' || state.selected === null || state.submitting || state.result) return
    dispatch({ type: 'submitStart' })
    try {
      const result = await submitMcq.mutateAsync({ contentId: state.step.content.id, selectedIndex: state.selected, timeTaken: (Date.now() - state.startedAt) / 1000 })
      dispatch({ type: 'answered', result })
    } catch (error) {
      dispatch({ type: 'actionFailed', error })
    }
  }, [state, submitMcq])

  const markDone = useCallback(async () => {
    if (state.phase !== 'active' || state.step.content_type === 'practice_problem' || state.submitting || state.viewed) return
    dispatch({ type: 'submitStart' })
    try {
      const result = await markViewed.mutateAsync({ concept: state.step.concept, contentId: state.step.content.id, timeTaken: (Date.now() - state.startedAt) / 1000 })
      dispatch({ type: 'viewed', result })
    } catch (error) {
      dispatch({ type: 'actionFailed', error })
    }
  }, [state, markViewed])

  const extendSession = useCallback(async () => {
    try {
      await continueSession.mutateAsync()
      await load()
    } catch (error) {
      dispatch({ type: 'loadFailed', error })
    }
  }, [continueSession, load])

  return { state, dispatch, load, submitAnswer, markDone, extendSession, extending: continueSession.isPending }
}
