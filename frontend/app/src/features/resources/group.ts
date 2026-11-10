import type { ResourceItem } from '@/api/types'

export type ResourceKind = 'video' | 'doc'

export interface ResourceGroup {
  key: string
  kind: ResourceKind
  title: string
  url: string
  source: string
  /** every concept this source covers (several concepts share one video / page) */
  concepts: string[]
  blockIndex: number
  /** the student has viewed it inside a session under at least one of those concepts */
  seen: boolean
}

/** One card per distinct source URL (not per concept), listing every concept it covers. */
export function groupResources(items: ResourceItem[]): ResourceGroup[] {
  const map = new Map<string, ResourceGroup>()
  for (const it of items) {
    for (const [kind, link] of [['video', it.video], ['doc', it.deep_dive]] as const) {
      const key = `${kind}:${link.url}`
      const g = map.get(key)
      if (g) {
        g.concepts.push(it.concept)
        g.seen ||= link.seen
      } else {
        map.set(key, { key, kind, title: link.title, url: link.url, source: link.source, concepts: [it.concept], blockIndex: it.block_index, seen: link.seen })
      }
    }
  }
  return [...map.values()]
}

export interface ResourceFilters {
  kind: ResourceKind | null
  seen: 'seen' | 'unseen' | null
  block: number | null
  query: string
}

export function filterResources(groups: ResourceGroup[], f: ResourceFilters): ResourceGroup[] {
  const q = f.query.trim().toLowerCase()
  return groups.filter(
    (g) =>
      (f.kind === null || g.kind === f.kind) &&
      (f.seen === null || (f.seen === 'seen') === g.seen) &&
      (f.block === null || g.blockIndex === f.block) &&
      (!q || g.title.toLowerCase().includes(q) || g.concepts.some((c) => c.toLowerCase().includes(q))),
  )
}
