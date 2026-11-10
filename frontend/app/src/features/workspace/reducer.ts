import type { ActiveStep, BlockCompleteStep, CompleteStep, McqResult, SessionPausedStep, ViewedResult } from '@/api/types'

export type TerminalStep = CompleteStep | BlockCompleteStep | SessionPausedStep

/** The workspace is a small finite-state machine:
 *  loading -> active(step) -> [submitting -> answered | viewed] -> loading -> ... -> terminal */
export type WorkspaceState =
  | { phase: 'loading' }
  | { phase: 'error'; error: unknown }
  | {
      phase: 'active'
      step: ActiveStep
      selected: number | null
      submitting: boolean
      result: McqResult | null
      viewed: ViewedResult | null
      actionError: unknown
      /** when the student first saw this step (the time_taken sent to the backend) */
      startedAt: number
    }
  | { phase: 'terminal'; step: TerminalStep }

export type WorkspaceAction =
  | { type: 'load' }
  | { type: 'loadFailed'; error: unknown }
  | { type: 'active'; step: ActiveStep; now: number }
  | { type: 'terminal'; step: TerminalStep }
  | { type: 'select'; index: number }
  | { type: 'submitStart' }
  | { type: 'answered'; result: McqResult }
  | { type: 'viewed'; result: ViewedResult }
  | { type: 'actionFailed'; error: unknown }

export const initialState: WorkspaceState = { phase: 'loading' }

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'load':
      return { phase: 'loading' }
    case 'loadFailed':
      return { phase: 'error', error: action.error }
    case 'active':
      return { phase: 'active', step: action.step, selected: null, submitting: false, result: null, viewed: null, actionError: null, startedAt: action.now }
    case 'terminal':
      return { phase: 'terminal', step: action.step }
    case 'select':
      // a choice can only change before the answer is graded
      return state.phase === 'active' && !state.result && !state.submitting ? { ...state, selected: action.index } : state
    case 'submitStart':
      // the disabled-while-submitting guard: a second submit while one is in flight is ignored
      return state.phase === 'active' && !state.submitting ? { ...state, submitting: true, actionError: null } : state
    case 'answered':
      return state.phase === 'active' ? { ...state, submitting: false, result: action.result } : state
    case 'viewed':
      return state.phase === 'active' ? { ...state, submitting: false, viewed: action.result } : state
    case 'actionFailed':
      return state.phase === 'active' ? { ...state, submitting: false, actionError: action.error } : state
    default:
      return state
  }
}

/** Can the student submit right now? (a practice question with a choice, not already submitted) */
export function canSubmitAnswer(s: WorkspaceState): boolean {
  return s.phase === 'active' && s.step.content_type === 'practice_problem' && s.selected !== null && !s.submitting && !s.result
}
