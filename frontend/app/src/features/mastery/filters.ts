import type { ConceptDetail } from '@/api/types'
import type { Tier } from '@/lib/tiers'

export type SortKey = 'order' | 'low' | 'high' | 'attempts'
export const SORT_LABELS: Record<SortKey, string> = {
  order: 'Curriculum order',
  low: 'Lowest mastery first',
  high: 'Highest mastery first',
  attempts: 'Most answered first',
}

export interface MasteryFilters {
  block: number | null
  tier: Tier | null
  query: string
  sort: SortKey
}

export function applyFilters(concepts: ConceptDetail[], f: MasteryFilters, tierFor: (b: number) => Tier): ConceptDetail[] {
  const q = f.query.trim().toLowerCase()
  const out = concepts.filter(
    (c) => (f.block === null || c.block_index === f.block) && (f.tier === null || tierFor(c.belief) === f.tier) && (!q || c.concept.toLowerCase().includes(q)),
  )
  const sorters: Record<SortKey, (a: ConceptDetail, b: ConceptDetail) => number> = {
    order: (a, b) => a.id - b.id,
    low: (a, b) => a.belief - b.belief || a.id - b.id,
    high: (a, b) => b.belief - a.belief || a.id - b.id,
    attempts: (a, b) => b.attempts - a.attempts || a.id - b.id,
  }
  return [...out].sort(sorters[f.sort])
}
