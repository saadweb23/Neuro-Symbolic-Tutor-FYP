import type { Analytics, ConceptDetail } from '@/api/types'
import type { Tier } from '@/lib/tiers'

export interface StrongestBlock { index: number; name: string; average: number }

/** Highest current average among blocks the student has actually answered in. */
export function strongestBlock(blocks: Analytics['blocks']): StrongestBlock | null {
  const answered = blocks.filter((b) => b.answered > 0)
  if (answered.length === 0) return null
  const best = answered.reduce((a, b) => (b.current_average > a.current_average ? b : a))
  return { index: best.index, name: best.name, average: best.current_average }
}

export interface StudyTip { concept: string; belief: number; text: string }

/** Specific, checkable recommendations from the student's own estimates: the lowest concepts that are
 *  below the "strong" tier, and the prerequisite that is holding each one back when it is also low. */
export function studyTips(concepts: ConceptDetail[], tierFor: (b: number) => Tier, n = 3): StudyTip[] {
  const byName = new Map(concepts.map((c) => [c.concept, c]))
  return [...concepts]
    .filter((c) => tierFor(c.belief) !== 'mastered')
    .sort((a, b) => a.belief - b.belief)
    .slice(0, n)
    .map((c) => {
      const pre = c.weakest_prerequisite ? byName.get(c.weakest_prerequisite) : undefined
      const preLow = pre && pre.belief <= c.belief + 0.1 && tierFor(pre.belief) !== 'mastered'
      const text = c.attempts === 0
        ? `You have not answered a question on ${c.concept} yet.${preLow ? ` Start with its prerequisite, ${pre.concept}.` : ''}`
        : `${c.concept} is at ${Math.round(c.belief * 100)}%.${preLow ? ` Revisit its prerequisite, ${pre.concept}, first.` : ' More practice here will lift it.'}`
      return { concept: c.concept, belief: c.belief, text }
    })
}

/** Concepts whose estimate rose since the student first met them, biggest gain first. */
export const topImprovements = (concepts: Analytics['concepts'], n = 2) =>
  concepts.filter((c) => c.attempts >= 2 && c.delta >= 0.03).sort((a, b) => b.delta - a.delta).slice(0, n)
