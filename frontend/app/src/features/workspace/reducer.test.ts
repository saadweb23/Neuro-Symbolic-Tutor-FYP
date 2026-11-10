import { describe, expect, it } from 'vitest'
import type { McqResult, PracticeStep, VideoStep } from '@/api/types'
import { canSubmitAnswer, initialState, workspaceReducer, type WorkspaceState } from './reducer'

const block = { index: 0, name: 'Fundamentals', average_mastery: 0.5, round_count: 1, round_cap: 15 }
const practice: PracticeStep = {
  concept: 'Lists', content_type: 'practice_problem', explanation: 'why', mastery_belief: 0.4, attempt_number: 0, block,
  content: { id: 'lists-mcq-1', type: 'mcq', question: 'q', choices: ['a', 'b', 'c', 'd'], difficulty: 'easy', source: 'bank' },
}
const video: VideoStep = {
  concept: 'Syntax', content_type: 'video', explanation: 'why', mastery_belief: 0.4, attempt_number: 0, block,
  content: { id: 'syntax-video', title: 't', url: 'https://www.youtube.com/watch?v=abc', source: 'YouTube' },
}
const result: McqResult = { concept: 'Lists', passed: true, correct_index: 1, explanation: 'e', updated_belief: 0.5 }

const active = (step = practice): WorkspaceState => workspaceReducer(initialState, { type: 'active', step, now: 1000 })

describe('workspace reducer', () => {
  it('starts loading and becomes active with a fresh step', () => {
    expect(initialState.phase).toBe('loading')
    const s = active()
    expect(s).toMatchObject({ phase: 'active', selected: null, submitting: false, result: null, startedAt: 1000 })
  })

  it('selects a choice, then allows submitting once', () => {
    let s = workspaceReducer(active(), { type: 'select', index: 2 })
    expect(canSubmitAnswer(s)).toBe(true)
    s = workspaceReducer(s, { type: 'submitStart' })
    expect(canSubmitAnswer(s)).toBe(false) // double-tap guard
    const again = workspaceReducer(s, { type: 'submitStart' })
    expect(again).toBe(s)
  })

  it('cannot submit without a choice or for non-practice steps', () => {
    expect(canSubmitAnswer(active())).toBe(false)
    expect(canSubmitAnswer(active(video as never))).toBe(false)
  })

  it('locks the choice once graded and records the result', () => {
    let s = workspaceReducer(active(), { type: 'select', index: 1 })
    s = workspaceReducer(s, { type: 'submitStart' })
    s = workspaceReducer(s, { type: 'answered', result })
    expect(s).toMatchObject({ submitting: false, result })
    expect(workspaceReducer(s, { type: 'select', index: 3 })).toBe(s)
  })

  it('keeps the step and allows a retry after a failed submission', () => {
    let s = workspaceReducer(active(), { type: 'select', index: 1 })
    s = workspaceReducer(s, { type: 'submitStart' })
    s = workspaceReducer(s, { type: 'actionFailed', error: new Error('net') })
    expect(s).toMatchObject({ phase: 'active', submitting: false, selected: 1 })
    expect(canSubmitAnswer(s)).toBe(true)
  })

  it('records a viewed result for videos', () => {
    let s = active(video as never)
    s = workspaceReducer(s, { type: 'submitStart' })
    s = workspaceReducer(s, { type: 'viewed', result: { concept: 'Syntax', updated_belief: 0.55 } })
    expect(s).toMatchObject({ viewed: { updated_belief: 0.55 }, submitting: false })
  })

  it('moves to loading on the next request and to error on failure', () => {
    expect(workspaceReducer(active(), { type: 'load' }).phase).toBe('loading')
    expect(workspaceReducer(initialState, { type: 'loadFailed', error: 'x' }).phase).toBe('error')
  })
})
