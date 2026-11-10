import { describe, expect, it } from 'vitest'
import type { Analytics, Trajectory } from '@/api/types'
import { activityTotals, improvedCount, progressionRows } from './series'

describe('analytics series', () => {
  it('prefixes the starting estimate and numbers interactions from 1', () => {
    const t = {
      model_version: '1', initial: { average: 0.46, blocks: [0.4, 0.4, 0.5, 0.5, 0.5] },
      steps: [{ step_index: 0, at: '2026-01-01T10:00:00Z', concept: 'A', content_type: 'placement', passed: true, average: 0.5, blocks: [0.5, 0.5, 0.5, 0.5, 0.5] }],
    } as Trajectory
    const rows = progressionRows(t)
    expect(rows.map((r) => r.n)).toEqual([0, 1])
    expect(rows[0]).toMatchObject({ t: null, overall: 0.46 })
    expect(rows[1]!.t).toBe(Date.parse('2026-01-01T10:00:00Z'))
  })
  it('totals activity and counts real improvements only', () => {
    const a = {
      activity: [{ date: 'd1', answered: 4, correct: 3, videos: 0, deep_dives: 0, answering_seconds: 1 }, { date: 'd2', answered: 6, correct: 3, videos: 1, deep_dives: 0, answering_seconds: 1 }],
      concepts: [{ attempts: 3, delta: 0.2 }, { attempts: 1, delta: 0.5 }, { attempts: 4, delta: 0.01 }],
    } as unknown as Analytics
    expect(activityTotals(a)).toEqual({ answered: 10, correct: 6, accuracy: 0.6, activeDays: 2 })
    expect(improvedCount(a)).toBe(1)
    expect(activityTotals({ activity: [] } as unknown as Analytics).accuracy).toBeNull()
  })
})
