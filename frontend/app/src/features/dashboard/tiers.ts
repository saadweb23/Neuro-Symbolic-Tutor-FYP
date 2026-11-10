import type { Beliefs } from '@/api/types'
import type { Tier } from '@/lib/tiers'

export type TierCounts = Record<Tier, number>

export function countTiers(beliefs: Beliefs, tierFor: (b: number) => Tier): TierCounts {
  const counts: TierCounts = { mastered: 0, developing: 0, weak: 0 }
  for (const b of Object.values(beliefs)) counts[tierFor(b)] += 1
  return counts
}

export const averageBelief = (beliefs: Beliefs): number => {
  const v = Object.values(beliefs)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0
}

export const weakestConcepts = (beliefs: Beliefs, n = 3): [string, number][] =>
  Object.entries(beliefs).sort((a, b) => a[1] - b[1]).slice(0, n)
