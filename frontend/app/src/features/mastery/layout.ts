import type { Graph } from '@/api/types'

export const NODE_W = 156
export const NODE_H = 50
// layoutGraph accepts other node sizes (the learning roadmap uses wider nodes)
const COL_GAP = 84
const ROW_GAP = 18
const PAD = 24

export interface LaidOutNode {
  id: number
  concept: string
  blockIndex: number
  depth: number
  x: number
  y: number
}
export interface LaidOutEdge {
  source: number
  target: number
  /** SVG path from the right side of the source to the left side of the target */
  path: string
}
export interface GraphLayout {
  nodeW: number
  nodeH: number
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
  width: number
  height: number
}

/** Layered DAG layout: one column per depth (longest path from a root, supplied by the API), rows
 *  ordered to reduce edge crossings (two barycentre sweeps), so prerequisites read left to right. */
export function layoutGraph(graph: Pick<Graph, 'nodes' | 'edges'>, dims: { w: number; h: number } = { w: NODE_W, h: NODE_H }): GraphLayout {
  const NODE_W = dims.w
  const NODE_H = dims.h
  const maxDepth = Math.max(0, ...graph.nodes.map((n) => n.depth))
  const layers: number[][] = Array.from({ length: maxDepth + 1 }, () => [])
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  for (const n of [...graph.nodes].sort((a, b) => a.block_index - b.block_index || a.id - b.id)) layers[n.depth]!.push(n.id)

  const preds = new Map<number, number[]>()
  const succs = new Map<number, number[]>()
  for (const e of graph.edges) {
    preds.set(e.target, [...(preds.get(e.target) ?? []), e.source])
    succs.set(e.source, [...(succs.get(e.source) ?? []), e.target])
  }
  const pos = new Map<number, number>()
  const reindex = () => layers.forEach((l) => l.forEach((id, i) => pos.set(id, i)))
  reindex()
  const bary = (id: number, nbrs: Map<number, number[]>) => {
    const ns = nbrs.get(id) ?? []
    return ns.length ? ns.reduce((a, n) => a + (pos.get(n) ?? 0), 0) / ns.length : (pos.get(id) ?? 0)
  }
  for (let sweep = 0; sweep < 2; sweep++) {
    for (let d = 1; d < layers.length; d++) {
      layers[d]!.sort((a, b) => bary(a, preds) - bary(b, preds) || a - b)
      reindex()
    }
    for (let d = layers.length - 2; d >= 0; d--) {
      layers[d]!.sort((a, b) => bary(a, succs) - bary(b, succs) || a - b)
      reindex()
    }
  }

  const tallest = Math.max(...layers.map((l) => l.length))
  const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP
  const nodes: LaidOutNode[] = []
  layers.forEach((layer, d) => {
    // centre each column vertically so short columns do not hug the top
    const colH = layer.length * NODE_H + (layer.length - 1) * ROW_GAP
    const top = PAD + (height - PAD * 2 - colH) / 2
    layer.forEach((id, i) => {
      const n = byId.get(id)!
      nodes.push({ id, concept: n.concept, blockIndex: n.block_index, depth: d, x: PAD + d * (NODE_W + COL_GAP), y: top + i * (NODE_H + ROW_GAP) })
    })
  })
  const at = new Map(nodes.map((n) => [n.id, n]))
  const edges: LaidOutEdge[] = graph.edges.map((e) => {
    const s = at.get(e.source)!
    const t = at.get(e.target)!
    const x1 = s.x + NODE_W, y1 = s.y + NODE_H / 2, x2 = t.x, y2 = t.y + NODE_H / 2
    const dx = Math.max(32, (x2 - x1) / 2)
    return { source: e.source, target: e.target, path: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}` }
  })
  return { nodeW: NODE_W, nodeH: NODE_H, nodes, edges, width: PAD * 2 + (maxDepth + 1) * NODE_W + maxDepth * COL_GAP, height }
}

/** Every concept reachable by following edges backwards (prerequisites) or forwards (dependents). */
export function relatives(edges: { source: number; target: number }[], id: number) {
  const walk = (from: 'source' | 'target') => {
    const to = from === 'source' ? 'target' : 'source'
    const seen = new Set<number>()
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      for (const e of edges) if (e[from] === cur && !seen.has(e[to])) { seen.add(e[to]); stack.push(e[to]) }
    }
    return seen
  }
  return { ancestors: walk('target'), descendants: walk('source') }
}
