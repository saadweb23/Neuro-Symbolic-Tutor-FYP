import { describe, expect, it } from 'vitest'
import type { ResourceItem } from '@/api/types'
import { filterResources, groupResources } from './group'

const link = (id: string, url: string, seen = false) => ({ id, title: `T ${url}`, url, source: 'S', seen })
const items: ResourceItem[] = [
  { concept: 'While Loops', block_index: 1, video: link('while-video', 'v-loops', true), deep_dive: link('while-dd', 'd-flow'), shares_video_with: ['For Loops'], shares_deep_dive_with: ['For Loops'] },
  { concept: 'For Loops', block_index: 1, video: link('for-video', 'v-loops'), deep_dive: link('for-dd', 'd-flow'), shares_video_with: ['While Loops'], shares_deep_dive_with: ['While Loops'] },
  { concept: 'Lists', block_index: 2, video: link('lists-video', 'v-lists'), deep_dive: link('lists-dd', 'd-ds'), shares_video_with: [], shares_deep_dive_with: [] },
]

describe('resource grouping', () => {
  const groups = groupResources(items)
  it('creates one card per distinct source and lists every concept it covers', () => {
    expect(groups).toHaveLength(4)
    const loops = groups.find((g) => g.key === 'video:v-loops')!
    expect(loops.concepts).toEqual(['While Loops', 'For Loops'])
    expect(loops.seen).toBe(true) // seen under one of its concepts counts
  })
  it('filters by kind, seen state, block and text', () => {
    expect(filterResources(groups, { kind: 'doc', seen: null, block: null, query: '' })).toHaveLength(2)
    expect(filterResources(groups, { kind: null, seen: 'seen', block: null, query: '' })).toHaveLength(1)
    expect(filterResources(groups, { kind: null, seen: 'unseen', block: 2, query: '' })).toHaveLength(2)
    expect(filterResources(groups, { kind: null, seen: null, block: null, query: 'for loops' }).map((g) => g.key).sort()).toEqual(['doc:d-flow', 'video:v-loops'])
  })
})
