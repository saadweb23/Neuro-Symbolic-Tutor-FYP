import { describe, expect, it } from 'vitest'
import { activityHeat, lastDays } from './weekly'

const day = (date: string, answered: number, videos = 0, deep_dives = 0, answering_seconds = 0) => ({ date, answered, correct: 0, videos, deep_dives, answering_seconds })

describe('lastDays', () => {
  it('returns n consecutive days ending today and fills gaps with zero', () => {
    const out = lastDays([day('2026-03-10', 4, 1, 0, 90), day('2026-03-08', 2)], 5, new Date(2026, 2, 10))
    expect(out.map((d) => d.date)).toEqual(['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'])
    expect(out.map((d) => d.answered)).toEqual([0, 0, 2, 0, 4])
    expect(out[4]).toMatchObject({ lessons: 1, minutes: 1.5 })
  })
  it('crosses month boundaries', () => {
    expect(lastDays([], 3, new Date(2026, 2, 1)).map((d) => d.date)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01'])
  })
})

describe('activityHeat', () => {
  it('counts answers, videos and deep-dives together', () => {
    expect(activityHeat([day('2026-03-10', 3, 1, 2)])).toEqual([{ date: '2026-03-10', value: 6 }])
  })
})
