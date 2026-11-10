import type { Analytics, Trajectory } from '@/api/types'

export interface ProgressionRow {
  /** interaction number; 0 = the starting estimate before any interaction */
  n: number
  /** epoch ms of the interaction (null for the starting point) */
  t: number | null
  overall: number
  blocks: number[]
}

/** The tracker's replayed estimates over time: one row per interaction, preceded by the start. */
export function progressionRows(t: Trajectory): ProgressionRow[] {
  return [
    { n: 0, t: null, overall: t.initial.average, blocks: t.initial.blocks },
    ...t.steps.map((s, i) => ({ n: i + 1, t: new Date(s.at).getTime(), overall: s.average, blocks: s.blocks })),
  ]
}

/** Totals for the selected range, from the activity series. */
export function activityTotals(a: Analytics) {
  const answered = a.activity.reduce((n, d) => n + d.answered, 0)
  const correct = a.activity.reduce((n, d) => n + d.correct, 0)
  return { answered, correct, accuracy: answered ? correct / answered : null, activeDays: a.activity.length }
}

export const improvedCount = (a: Analytics) => a.concepts.filter((c) => c.attempts >= 2 && c.delta >= 0.05).length
