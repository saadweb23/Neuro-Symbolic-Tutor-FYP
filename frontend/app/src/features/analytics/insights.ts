import type { Analytics, Summary } from '@/api/types'
import { pct } from '@/lib/tiers'

export interface Insight {
  id: string
  tone: 'good' | 'mid' | 'primary'
  text: string
}

/** Deterministic, rule-based sentences computed from the student's real analytics. No model
 *  generates these: each rule fires only when the data that backs it exists. */
export function buildInsights(analytics: Analytics | undefined, summary: Summary | undefined): Insight[] {
  const out: Insight[] = []
  if (!analytics) return out

  const improved = analytics.concepts.find((c) => c.attempts >= 2 && c.delta >= 0.05)
  if (improved) {
    out.push({
      id: 'improved',
      tone: 'good',
      text: `Your estimated mastery of ${improved.concept} rose from ${pct(improved.first_belief)} to ${pct(improved.current_belief)} over ${improved.attempts} answers.`,
    })
  }

  const slipped = [...analytics.concepts].reverse().find((c) => c.attempts >= 2 && c.delta <= -0.05)
  if (slipped) {
    out.push({
      id: 'slipped',
      tone: 'mid',
      text: `${slipped.concept} is lower than when you started it (${pct(slipped.first_belief)} to ${pct(slipped.current_belief)}). It is worth another look.`,
    })
  }

  const answeredBlocks = analytics.blocks.filter((b) => b.answered >= 3 && b.accuracy !== null)
  if (answeredBlocks.length >= 2) {
    const best = answeredBlocks.reduce((a, b) => ((b.accuracy ?? 0) > (a.accuracy ?? 0) ? b : a))
    const worst = answeredBlocks.reduce((a, b) => ((b.accuracy ?? 1) < (a.accuracy ?? 1) ? b : a))
    if (best.index !== worst.index && (best.accuracy ?? 0) - (worst.accuracy ?? 0) >= 0.15) {
      out.push({
        id: 'blocks',
        tone: 'primary',
        text: `You answer ${best.name} questions correctly ${pct(best.accuracy ?? 0)} of the time, versus ${pct(worst.accuracy ?? 0)} in ${worst.name}.`,
      })
    }
  }

  const trend = analytics.accuracy_trend
  if (trend.length >= 2) {
    const first = trend[0]!
    const last = trend[trend.length - 1]!
    const delta = last.rolling_accuracy - first.rolling_accuracy
    if (Math.abs(delta) >= 0.2) {
      out.push({
        id: 'trend',
        tone: delta > 0 ? 'good' : 'mid',
        text: `Over your last ${analytics.window.accuracy_window} answers you got ${pct(last.rolling_accuracy)} right, ${delta > 0 ? 'up' : 'down'} from ${pct(first.rolling_accuracy)} at the start.`,
      })
    }
  }

  if (summary && summary.current_streak_days >= 2) {
    out.push({ id: 'streak', tone: 'good', text: `You have practised ${summary.current_streak_days} days in a row.` })
  }
  return out
}
