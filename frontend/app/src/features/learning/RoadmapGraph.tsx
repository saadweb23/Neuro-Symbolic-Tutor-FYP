import { motion, useReducedMotion } from 'motion/react'
import { Minus, Plus, Scan } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Graph } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { layoutGraph, relatives } from '@/features/mastery/layout'
import { cn } from '@/lib/cn'
import { BLOCK_COLORS, pct } from '@/lib/tiers'
import type { NodeState, RoadmapNode } from './roadmap'
import { STATE_STYLE } from './stateStyle'

interface Props {
  graph: Pick<Graph, 'nodes' | 'edges'>
  nodes: RoadmapNode[]
  selected: string | null
  onSelect: (concept: string) => void
}

const NODE_W = 196
const NODE_H = 56
const ORDER: NodeState[] = ['completed', 'current', 'upcoming', 'locked']

/** The curriculum as a journey: prerequisites flow left to right, each concept is styled by its state
 *  for THIS student, the current concept pulses, and hovering a concept lights up its whole chain. */
export function RoadmapGraph({ graph, nodes, selected, onSelect }: Props) {
  const reduce = useReducedMotion()
  const layout = useMemo(() => layoutGraph(graph, { w: NODE_W, h: NODE_H }), [graph])
  const byName = useMemo(() => new Map(nodes.map((n) => [n.concept, n])), [nodes])
  const idByName = useMemo(() => new Map(layout.nodes.map((n) => [n.concept, n.id])), [layout])
  const stateById = useMemo(() => new Map(layout.nodes.map((n) => [n.id, byName.get(n.concept)?.state ?? 'upcoming'])), [layout, byName])
  const [hover, setHover] = useState<number | null>(null)
  const [scale, setScale] = useState(1)
  const box = useRef<HTMLDivElement>(null)

  const fit = (readable = false) => {
    const w = box.current?.clientWidth
    if (w) setScale(Math.max(readable ? 0.8 : 0.45, Math.min(1.15, (w - 8) / layout.width)))
  }
  useEffect(() => fit(true), [layout]) // eslint-disable-line react-hooks/exhaustive-deps

  const focusId = hover ?? (selected ? idByName.get(selected) ?? null : null)
  const related = useMemo(() => {
    if (focusId === null) return null
    const { ancestors, descendants } = relatives(graph.edges, focusId)
    return new Set([focusId, ...ancestors, ...descendants])
  }, [focusId, graph.edges])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
          {ORDER.map((s) => { const S = STATE_STYLE[s]; return <li key={s} className="flex items-center gap-1.5"><S.icon className={cn('size-3.5', S.text)} aria-hidden />{S.label}</li> })}
        </ul>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <Button variant="secondary" size="sm" aria-label="Zoom out" onClick={() => setScale((s) => Math.max(0.45, +(s - 0.15).toFixed(2)))}><Minus className="size-4" /></Button>
          <Button variant="secondary" size="sm" aria-label="Fit to view" onClick={() => fit()}><Scan className="size-4" /></Button>
          <Button variant="secondary" size="sm" aria-label="Zoom in" onClick={() => setScale((s) => Math.min(1.6, +(s + 0.15).toFixed(2)))}><Plus className="size-4" /></Button>
        </div>
      </div>

      <div ref={box} className="overflow-auto rounded-xl border border-border bg-surface [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px]" style={{ maxHeight: '68svh' }} tabIndex={0} aria-label="Learning roadmap (scrollable)">
        <svg width={layout.width * scale} height={layout.height * scale} viewBox={`0 0 ${layout.width} ${layout.height}`} role="group" aria-label="Learning roadmap">
          {layout.edges.map((e, i) => {
            const hot = related !== null && related.has(e.source) && related.has(e.target)
            const done = stateById.get(e.source) === 'completed'
            return (
              <motion.path
                key={`${e.source}-${e.target}`} d={e.path} fill="none" strokeLinecap="round"
                stroke={hot ? 'var(--primary)' : done ? 'var(--good)' : 'var(--border-strong)'}
                strokeWidth={hot ? 2.6 : done ? 2.2 : 1.4} opacity={related && !hot ? 0.18 : done || hot ? 0.95 : 0.7}
                initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.2 + i * 0.015, ease: 'easeOut' }}
              />
            )
          })}
          {layout.nodes.map((n) => {
            const r = byName.get(n.concept)
            const state = r?.state ?? 'upcoming'
            const S = STATE_STYLE[state]
            const dim = related !== null && !related.has(n.id)
            const isSel = selected === n.concept
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                <motion.g
                  initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: dim ? 0.3 : 1, y: 0 }} transition={{ duration: 0.45, delay: n.depth * 0.07 }}
                  role="button" tabIndex={0} aria-pressed={isSel}                   className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-primary [&:focus-visible>rect]:stroke-[3px]"
                  onClick={() => onSelect(n.concept)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.concept) } }}
                  onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
                  whileHover={reduce ? undefined : { scale: 1.05 }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                >
                  <title>{`${n.concept} ${pct(r?.belief ?? 0)} · ${S.label}`}</title>
                  {state === 'current' && <rect className="nt-node-ping" width={NODE_W} height={NODE_H} rx={12} fill="none" stroke="var(--primary)" strokeWidth={2} />}
                  <rect width={NODE_W} height={NODE_H} rx={12} fill={S.fill} stroke={isSel ? 'var(--text)' : S.stroke} strokeWidth={isSel ? 3 : state === 'current' ? 2.4 : 1.6} strokeDasharray={state === 'locked' ? '5 4' : undefined} />
                  <S.icon x={12} y={NODE_H / 2 - 9} width={18} height={18} color={S.stroke} strokeWidth={2.2} />
                  <text x={38} y={24} className="fill-text text-[13px] font-semibold">{n.concept}</text>
                  <text x={38} y={42} className="fill-muted text-[11px]">{pct(r?.belief ?? 0)} · {S.label}</text>
                  <circle cx={NODE_W - 11} cy={11} r={4} fill={BLOCK_COLORS[n.blockIndex]} />
                </motion.g>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
