import { describe, expect, it } from 'vitest'
import { tierFor } from '@/lib/tiers'
import { averageBelief, countTiers, weakestConcepts } from './tiers'

const cut = { easy_below: 0.4, medium_below: 0.7 }
const t = (b: number) => tierFor(b, cut)
const beliefs = { A: 0.9, B: 0.5, C: 0.2, D: 0.7 }

describe('dashboard maths', () => {
  it('counts tiers with the backend cut-offs', () => expect(countTiers(beliefs, t)).toEqual({ mastered: 2, developing: 1, weak: 1 }))
  it('averages', () => expect(averageBelief(beliefs)).toBeCloseTo(0.575))
  it('orders the weakest first', () => expect(weakestConcepts(beliefs, 2)).toEqual([['C', 0.2], ['B', 0.5]]))
  it('handles empty input', () => expect(averageBelief({})).toBe(0))
})
