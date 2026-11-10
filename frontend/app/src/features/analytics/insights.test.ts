import { describe, expect, it } from 'vitest'
import type { Analytics, Summary } from '@/api/types'
import { buildInsights } from './insights'

const base: Analytics = {
  model_version: '1',
  window: { days: null, accuracy_window: 5 },
  activity: [],
  blocks: [],
  concepts: [],
  content_mix: { practice: 0, placement: 0, video: 0, deep_dive: 0 },
  difficulty: { placement: { answered: 0, correct: 0 }, easy: { answered: 0, correct: 0 }, medium: { answered: 0, correct: 0 }, hard: { answered: 0, correct: 0 } },
  accuracy_trend: [],
}

describe('buildInsights', () => {
  it('returns nothing when there is no data to support a statement', () => {
    expect(buildInsights(undefined, undefined)).toEqual([])
    expect(buildInsights(base, undefined)).toEqual([])
  })

  it('reports a real improvement with its numbers', () => {
    const a: Analytics = { ...base, concepts: [{ concept: 'Lists', block_index: 2, attempts: 4, accuracy: 0.75, first_belief: 0.4, current_belief: 0.7, delta: 0.3 }] }
    const [i] = buildInsights(a, undefined)
    expect(i?.text).toBe('Your estimated mastery of Lists rose from 40% to 70% over 4 answers.')
  })

  it('ignores a single attempt and tiny changes', () => {
    const a: Analytics = { ...base, concepts: [
      { concept: 'Syntax', block_index: 0, attempts: 1, accuracy: 1, first_belief: 0.4, current_belief: 0.9, delta: 0.5 },
      { concept: 'Sets', block_index: 2, attempts: 5, accuracy: 0.6, first_belief: 0.5, current_belief: 0.52, delta: 0.02 },
    ] }
    expect(buildInsights(a, undefined)).toEqual([])
  })

  it('mentions a streak only from two days', () => {
    const s = { current_streak_days: 1 } as Summary
    expect(buildInsights(base, s)).toEqual([])
    expect(buildInsights(base, { ...s, current_streak_days: 3 })[0]?.text).toContain('3 days in a row')
  })
})
