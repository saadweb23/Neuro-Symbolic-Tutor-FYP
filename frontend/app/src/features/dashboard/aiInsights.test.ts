import { describe, expect, it } from 'vitest'
import type { ConceptDetail } from '@/api/types'
import { strongestBlock, studyTips, topImprovements } from './aiInsights'

const tierFor = (b: number) => (b >= 0.7 ? 'mastered' : b >= 0.4 ? 'developing' : 'weak')
const c = (concept: string, belief: number, attempts = 3, weakest_prerequisite: string | null = null): ConceptDetail => ({
  concept, id: 0, block_index: 0, belief, attempts, correct: 1, accuracy: 0.5, last_attempt_at: null, prerequisites: [], dependents: [], weakest_prerequisite,
})

describe('strongestBlock', () => {
  it('ignores blocks with no answers', () => {
    const blocks = [
      { index: 0, name: 'A', answered: 0, correct: 0, accuracy: null, current_average: 0.9 },
      { index: 1, name: 'B', answered: 5, correct: 3, accuracy: 0.6, current_average: 0.6 },
      { index: 2, name: 'C', answered: 4, correct: 4, accuracy: 1, current_average: 0.8 },
    ]
    expect(strongestBlock(blocks)).toEqual({ index: 2, name: 'C', average: 0.8 })
    expect(strongestBlock([])).toBeNull()
  })
})

describe('studyTips', () => {
  it('lists the lowest non-mastered concepts and names a low prerequisite', () => {
    const tips = studyTips([c('Loops', 0.3, 2, 'Variables'), c('Variables', 0.35), c('Lists', 0.9), c('Sets', 0.5, 0)], tierFor, 3)
    expect(tips.map((t) => t.concept)).toEqual(['Loops', 'Variables', 'Sets'])
    expect(tips[0]!.text).toContain('prerequisite, Variables')
    expect(tips[2]!.text).toContain('not answered a question')
  })
})

describe('topImprovements', () => {
  it('needs at least two answers and a real gain', () => {
    const rows = [
      { concept: 'A', block_index: 0, attempts: 1, accuracy: 1, first_belief: 0.4, current_belief: 0.9, delta: 0.5 },
      { concept: 'B', block_index: 0, attempts: 4, accuracy: 0.8, first_belief: 0.4, current_belief: 0.7, delta: 0.3 },
      { concept: 'C', block_index: 0, attempts: 4, accuracy: 0.5, first_belief: 0.5, current_belief: 0.51, delta: 0.01 },
    ]
    expect(topImprovements(rows).map((r) => r.concept)).toEqual(['B'])
  })
})
