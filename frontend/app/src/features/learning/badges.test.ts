import { describe, expect, it } from 'vitest'
import type { Summary } from '@/api/types'
import { buildBadges } from './badges'

const summary = (p: Partial<Summary>): Summary => ({
  answered_questions: 0, correct_answers: 0, accuracy: null, practice_questions: 0, videos_viewed: 0, deep_dives_read: 0, concepts_attempted: 0,
  concepts_total: 25, answering_time_seconds: 0, active_days: 0, current_streak_days: 0, longest_streak_days: 0, first_activity_at: null, last_activity_at: null, ...p,
})

describe('buildBadges', () => {
  it('earns nothing without records and caps progress at the target', () => {
    const b = buildBadges({ threshold: 0.65 })
    expect(b.every((x) => !x.earned)).toBe(true)
    expect(buildBadges({ summary: summary({ answered_questions: 80 }), threshold: 0.65 }).find((x) => x.id === 'answers-50')).toMatchObject({ earned: true, current: 50, target: 50 })
  })
  it('accuracy badge needs 20+ answers and 80%', () => {
    const get = (s: Partial<Summary>) => buildBadges({ summary: summary(s), threshold: 0.65 }).find((x) => x.id === 'sharp')!.earned
    expect(get({ answered_questions: 10, accuracy: 1 })).toBe(false)
    expect(get({ answered_questions: 25, accuracy: 0.79 })).toBe(false)
    expect(get({ answered_questions: 25, accuracy: 0.8 })).toBe(true)
  })
  it('streak badges use the best streak', () => {
    const e = (id: string) => buildBadges({ summary: summary({ longest_streak_days: 4, current_streak_days: 1 }), threshold: 0.65 }).find((x) => x.id === id)!.earned
    expect(e('streak-3')).toBe(true)
    expect(e('streak-7')).toBe(false)
  })
})
