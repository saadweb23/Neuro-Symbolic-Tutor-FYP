import { describe, expect, it } from 'vitest'
import type { ConceptDetail } from '@/api/types'
import { tierFor } from '@/lib/tiers'
import { applyFilters } from './filters'

const mk = (id: number, concept: string, block_index: number, belief: number, attempts = 0): ConceptDetail => ({
  concept, id, block_index, belief, attempts, correct: 0, accuracy: null, last_attempt_at: null, prerequisites: [], dependents: [], weakest_prerequisite: null,
})
const data = [mk(0, 'Syntax', 0, 0.8, 3), mk(1, 'Variables', 0, 0.3, 1), mk(2, 'Lists', 2, 0.5, 5)]
const t = (b: number) => tierFor(b, { easy_below: 0.4, medium_below: 0.7 })
const base = { block: null, tier: null, query: '', sort: 'order' as const }

describe('applyFilters', () => {
  it('filters by block, tier and search text', () => {
    expect(applyFilters(data, { ...base, block: 0 }, t).map((c) => c.concept)).toEqual(['Syntax', 'Variables'])
    expect(applyFilters(data, { ...base, tier: 'weak' }, t).map((c) => c.concept)).toEqual(['Variables'])
    expect(applyFilters(data, { ...base, query: ' LIST ' }, t).map((c) => c.concept)).toEqual(['Lists'])
  })
  it('sorts', () => {
    expect(applyFilters(data, { ...base, sort: 'low' }, t).map((c) => c.concept)).toEqual(['Variables', 'Lists', 'Syntax'])
    expect(applyFilters(data, { ...base, sort: 'high' }, t)[0]!.concept).toBe('Syntax')
    expect(applyFilters(data, { ...base, sort: 'attempts' }, t)[0]!.concept).toBe('Lists')
  })
})
