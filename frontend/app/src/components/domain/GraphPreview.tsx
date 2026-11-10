import { useMemo } from 'react'
import type { Graph } from '@/api/types'
import { layoutGraph, NODE_H, NODE_W } from '@/features/mastery/layout'
import { BLOCK_COLORS } from '@/lib/tiers'

/** A static, non-interactive picture of the real prerequisite graph (GET /graph): every concept and every
 *  "builds on" link, coloured by curriculum block. Structure only: it shows no student data. */
export function GraphPreview({ graph }: { graph: Pick<Graph, 'nodes' | 'edges'> }) {
  const layout = useMemo(() => layoutGraph(graph), [graph])
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="block h-auto w-full min-w-[760px]"
      role="img"
      aria-label={`Prerequisite graph of ${graph.nodes.length} Python concepts joined by ${graph.edges.length} "builds on" links`}
    >
      {layout.edges.map((e) => (
        <path key={`${e.source}-${e.target}`} d={e.path} fill="none" className="stroke-border-strong" strokeWidth={1.4} />
      ))}
      {layout.nodes.map((n) => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`}>
          <rect width={NODE_W} height={NODE_H} rx={10} className="fill-surface stroke-border" strokeWidth={1.2} />
          <rect width={5} height={NODE_H - 16} x={0} y={8} rx={2.5} fill={BLOCK_COLORS[n.blockIndex]} />
          <text x={16} y={NODE_H / 2 + 4.5} className="fill-text text-[13px] font-medium">
            {n.concept}
          </text>
        </g>
      ))}
    </svg>
  )
}
