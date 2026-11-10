import { describe, expect, it } from 'vitest'
import { layoutGraph, NODE_H, NODE_W, relatives } from './layout'

const graph = {
  nodes: [
    { id: 0, concept: 'A', block_index: 0, depth: 0 },
    { id: 1, concept: 'B', block_index: 0, depth: 0 },
    { id: 2, concept: 'C', block_index: 0, depth: 1 },
    { id: 3, concept: 'D', block_index: 1, depth: 2 },
  ],
  edges: [
    { source: 0, target: 2 },
    { source: 1, target: 2 },
    { source: 2, target: 3 },
  ],
}

describe('layoutGraph', () => {
  const l = layoutGraph(graph)
  it('places prerequisites to the left of dependents', () => {
    const x = new Map(l.nodes.map((n) => [n.id, n.x]))
    for (const e of graph.edges) expect(x.get(e.source)!).toBeLessThan(x.get(e.target)!)
  })
  it('never overlaps two nodes', () => {
    for (const a of l.nodes) for (const b of l.nodes) {
      if (a.id >= b.id) continue
      const apart = Math.abs(a.x - b.x) >= NODE_W || Math.abs(a.y - b.y) >= NODE_H
      expect(apart).toBe(true)
    }
  })
  it('keeps every node inside the canvas and draws every edge', () => {
    for (const n of l.nodes) { expect(n.x + NODE_W).toBeLessThanOrEqual(l.width); expect(n.y + NODE_H).toBeLessThanOrEqual(l.height) }
    expect(l.edges).toHaveLength(3)
    expect(l.edges[0]!.path.startsWith('M ')).toBe(true)
  })
})

describe('relatives', () => {
  it('finds all ancestors and descendants transitively', () => {
    expect([...relatives(graph.edges, 3).ancestors].sort()).toEqual([0, 1, 2])
    expect([...relatives(graph.edges, 0).descendants].sort()).toEqual([2, 3])
    expect(relatives(graph.edges, 1).ancestors.size).toBe(0)
  })
})
