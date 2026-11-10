import { Minus, Plus, Scan } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConceptDetail, Graph } from '@/api/types'
import { useTierFor } from '@/app/providers/MetaProvider'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { BLOCK_COLORS, TIER_STYLES, pct, type Tier } from '@/lib/tiers'
import { layoutGraph, NODE_H, NODE_W, relatives } from './layout'

const STROKE: Record<Tier, string> = { mastered: 'var(--good)', developing: 'var(--mid)', weak: 'var(--bad)' }

interface Props {
  graph: Pick<Graph, 'nodes' | 'edges'>
  concepts: ConceptDetail[]
  selected: string | null
  /** concepts that pass the current filters; the rest are dimmed */
  visible: Set<string>
  onSelect: (concept: string) => void
}

/** The prerequisite DAG as layered SVG: prerequisites on the left, dependents on the right.
 *  Hover / focus / select a node to light up everything it builds on and everything that builds on it. */
export function ConceptGraph({ graph, concepts, selected, visible, onSelect }: Props) {
  const tierFor = useTierFor()
  const layout = useMemo(() => layoutGraph(graph), [graph])
  const detail = useMemo(() => new Map(concepts.map((c) => [c.concept, c])), [concepts])
  const idByName = useMemo(() => new Map(layout.nodes.map((n) => [n.concept, n.id])), [layout])
  const [hover, setHover] = useState<number | null>(null)
  const [scale, setScale] = useState(1)
  const box = useRef<HTMLDivElement>(null)

  /** `readable`: never start smaller than 0.8 (text stays legible; the canvas scrolls instead). */
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
          {(Object.keys(TIER_STYLES) as Tier[]).map((t) => {
            const S = TIER_STYLES[t]
            return <li key={t} className="flex items-center gap-1.5"><S.icon className={cn('size-3.5', S.text)} aria-hidden />{S.label}</li>
          })}
          <li className="flex items-center gap-1.5"><span className="h-px w-6 bg-muted" aria-hidden />builds on</li>
        </ul>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <Button variant="secondary" size="sm" aria-label="Zoom out" onClick={() => setScale((s) => Math.max(0.45, +(s - 0.15).toFixed(2)))}><Minus className="size-4" /></Button>
          <Button variant="secondary" size="sm" aria-label="Fit to view" onClick={() => fit()}><Scan className="size-4" /></Button>
          <Button variant="secondary" size="sm" aria-label="Zoom in" onClick={() => setScale((s) => Math.min(1.6, +(s + 0.15).toFixed(2)))}><Plus className="size-4" /></Button>
        </div>
      </div>

      <div ref={box} className="overflow-auto rounded-lg border border-border bg-surface" style={{ maxHeight: '70svh' }} tabIndex={0} aria-label="Prerequisite graph (scrollable)">
        <svg width={layout.width * scale} height={layout.height * scale} viewBox={`0 0 ${layout.width} ${layout.height}`} role="group" aria-label="Concept prerequisite graph">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-border-strong" />
            </marker>
            <marker id="arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
            </marker>
          </defs>
          {layout.edges.map((e) => {
            const hot = related !== null && related.has(e.source) && related.has(e.target)
            return (
              <path key={`${e.source}-${e.target}`} d={e.path} fill="none" markerEnd={hot ? 'url(#arrow-hot)' : 'url(#arrow)'}
                className={hot ? 'stroke-primary' : 'stroke-border-strong'} strokeWidth={hot ? 2 : 1.2} opacity={related && !hot ? 0.25 : 1} />
            )
          })}
          {layout.nodes.map((n) => {
            const d = detail.get(n.concept)
            const belief = d?.belief ?? 0
            const tier = tierFor(belief)
            const S = TIER_STYLES[tier]
            const dim = (related !== null && !related.has(n.id)) || !visible.has(n.concept)
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`} role="button" tabIndex={0} opacity={dim ? 0.3 : 1} className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-primary [&:focus-visible>rect:first-child]:stroke-[3]"
                aria-label={`${n.concept}: ${pct(belief)}, ${S.label}${selected === n.concept ? ', selected' : ''}`} aria-pressed={selected === n.concept}
                onClick={() => onSelect(n.concept)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.concept) } }}
                onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}>
                <rect width={NODE_W} height={NODE_H} rx={10} className="fill-surface" stroke={selected === n.concept ? 'var(--primary)' : STROKE[tier]} strokeWidth={selected === n.concept ? 3 : 1.6} strokeDasharray={tier === 'developing' ? '5 3' : undefined} />
                <circle cx={NODE_W - 12} cy={12} r={4} fill={BLOCK_COLORS[n.blockIndex]} />
                <text aria-hidden x={12} y={21} className="fill-text text-[12px] font-semibold">{n.concept}</text>
                <text aria-hidden x={12} y={38} className="fill-muted text-[11px]">{pct(belief)} · {S.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
