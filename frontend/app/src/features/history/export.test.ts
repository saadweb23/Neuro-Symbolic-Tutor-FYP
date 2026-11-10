import { describe, expect, it } from 'vitest'
import type { HistoryItem } from '@/api/types'
import { historyToCsv } from './export'

const item = (over: Partial<HistoryItem>): HistoryItem => ({
  step_index: 0, at: '2026-01-01T10:00:00Z', concept: 'Lists', block_index: 2, content_type: 'practice', content_id: 'x', passed: true,
  time_taken: 12.34, difficulty: 'easy', question_text: null, choices: null, correct_index: null, explanation: null, selected_index: null,
  belief_before: 0.4, belief_after: 0.5, ...over,
})

describe('historyToCsv', () => {
  it('writes a header and one row per item, labelling views as "viewed" (not correct)', () => {
    const csv = historyToCsv([item({}), item({ content_type: 'video', passed: null, difficulty: null })])
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('time,concept,type,result,difficulty,seconds,belief_before,belief_after')
    expect(lines[1]).toBe('2026-01-01T10:00:00Z,Lists,practice,correct,easy,12.3,0.4000,0.5000')
    expect(lines[2]).toContain(',video,viewed,')
  })
  it('escapes quotes, commas and formula-looking cells', () => {
    const csv = historyToCsv([item({ concept: '=SUM(A1)' }), item({ concept: 'a,"b"' })])
    expect(csv).toContain("'=SUM(A1)")
    expect(csv).toContain('"a,""b"""')
  })
})
