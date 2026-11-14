import { describe, expect, it } from 'vitest'
import type { ConceptDetail } from '@/api/types'
import { buildRoadmap, difficultyOf, journeyCompletion } from './roadmap'

const graph = { nodes: [
  { id: 0, concept: 'Syntax', block_index: 0, depth: 0 },
  { id: 1, concept: 'Variables', block_index: 0, depth: 1 },
  { id: 2, concept: 'Conditionals', block_index: 1, depth: 2 },
  { id: 3, concept: 'Recursion', block_index: 3, depth: 3 },
] }
const d = (concept: string, belief: number, attempts: number, prerequisites: string[] = []): ConceptDetail => ({
  concept, id: 0, block_index: 0, belief, attempts, correct: 0, accuracy: null, last_attempt_at: null, prerequisites, dependents: [], weakest_prerequisite: null,
})

describe('buildRoadmap', () => {
  const concepts = [d('Syntax', 0.9, 3), d('Variables', 0.55, 2, ['Syntax']), d('Conditionals', 0.3, 0, ['Variables', 'Syntax']), d('Recursion', 0.4, 0, ['Conditionals'])]
  const base = { graph, concepts, threshold: 0.65, floor: 0.5 }

  it('marks completed, current, locked and upcoming from the student record', () => {
    const states = Object.fromEntries(buildRoadmap({ ...base, current: 'Variables' }).map((n) => [n.concept, n.state]))
    expect(states).toEqual({ Syntax: 'completed', Variables: 'current', Conditionals: 'upcoming', Recursion: 'locked' })
  })
  it('a prerequisite under the floor locks a concept and is named', () => {
    const nodes = buildRoadmap({ ...base, concepts: [d('Syntax', 0.9, 3), d('Variables', 0.2, 1, ['Syntax']), d('Conditionals', 0.3, 0, ['Variables']), d('Recursion', 0.4, 0, ['Conditionals'])] })
    const cond = nodes.find((n) => n.concept === 'Conditionals')!
    expect(cond.state).toBe('locked')
    expect(cond.blockedBy).toEqual(['Variables'])
  })
  it('a high estimate without any answer is not "completed"', () => {
    expect(buildRoadmap({ ...base, concepts: [d('Syntax', 0.9, 0), d('Variables', 0.9, 0), d('Conditionals', 0.9, 0), d('Recursion', 0.9, 0)] }).every((n) => n.state !== 'completed')).toBe(true)
  })
  it('the agent-preferred concept stays current even when a prerequisite is low', () => {
    expect(buildRoadmap({ ...base, current: 'Recursion' }).find((n) => n.concept === 'Recursion')!.state).toBe('current')
  })
  it('journey completion is the share of completed concepts', () => {
    expect(journeyCompletion(buildRoadmap(base))).toBe(0.25)
  })
})

describe('difficultyOf', () => {
  it('derives difficulty from graph depth', () => {
    expect([0, 1, 2, 3, 4].map((x) => difficultyOf(x, 4))).toEqual(['Foundation', 'Foundation', 'Core', 'Advanced', 'Advanced'])
  })
})
