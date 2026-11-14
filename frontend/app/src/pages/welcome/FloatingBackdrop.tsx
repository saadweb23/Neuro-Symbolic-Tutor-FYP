import { Atom, BookOpen, BrainCircuit, Calculator, Code2, GraduationCap, Lightbulb, Network, Puzzle, Rocket, Sparkles, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Decorative layer for the welcome page: maths symbols, formulas, code, AI / education icons and
 *  geometric shapes drifting in different directions, plus slow rising particles. Pure CSS motion
 *  (transform / opacity only); the pointer adds a gentle depth shift. aria-hidden: it carries no content. */

type Item = {
  x: number; y: number          // % position
  depth: number                  // pointer parallax strength (px)
  dur: number; delay: number     // drift timing (s)
  dx: number; dy: number; rot: number  // drift vector (px) and rotation (deg)
  size?: number                  // font / icon size (px)
  tone?: 'primary' | 'accent' | 'violet'
} & ({ text: string } | { icon: LucideIcon } | { shape: 'triangle' | 'hexagon' | 'ring' | 'square' | 'wave' | 'dots' })

const ITEMS: Item[] = [
  { x: 6, y: 14, depth: 14, dur: 14, delay: 0, dx: 26, dy: -30, rot: 12, size: 46, text: '∑', tone: 'primary' },
  { x: 16, y: 70, depth: 20, dur: 17, delay: -4, dx: -22, dy: -26, rot: -10, size: 40, text: 'π', tone: 'violet' },
  { x: 88, y: 18, depth: 16, dur: 16, delay: -2, dx: -28, dy: 24, rot: 14, size: 44, text: '∞', tone: 'accent' },
  { x: 82, y: 72, depth: 22, dur: 19, delay: -7, dx: 20, dy: -34, rot: -16, size: 36, text: '∫', tone: 'primary' },
  { x: 30, y: 10, depth: 10, dur: 15, delay: -5, dx: 22, dy: 18, rot: 8, size: 22, text: 'f(x) = x²', tone: 'violet' },
  { x: 70, y: 8, depth: 12, dur: 18, delay: -9, dx: -24, dy: 20, rot: -6, size: 20, text: 'a² + b² = c²', tone: 'accent' },
  { x: 4, y: 44, depth: 18, dur: 13, delay: -3, dx: 18, dy: 28, rot: 10, size: 26, text: '√x', tone: 'accent' },
  { x: 93, y: 46, depth: 18, dur: 15, delay: -6, dx: -18, dy: -22, rot: -12, size: 28, text: 'Δ', tone: 'violet' },
  { x: 22, y: 88, depth: 12, dur: 20, delay: -8, dx: 30, dy: -16, rot: 6, size: 20, text: 'O(n log n)', tone: 'primary' },
  { x: 62, y: 90, depth: 14, dur: 16, delay: -1, dx: -26, dy: -20, rot: -8, size: 22, text: 'def learn():', tone: 'accent' },
  { x: 40, y: 94, depth: 8, dur: 18, delay: -10, dx: 16, dy: -18, rot: 4, size: 24, text: '{ }', tone: 'violet' },
  { x: 12, y: 30, depth: 16, dur: 17, delay: -11, dx: 20, dy: 22, rot: -14, size: 22, text: 'λ', tone: 'primary' },
  { x: 90, y: 88, depth: 12, dur: 15, delay: -12, dx: -20, dy: -20, rot: 10, size: 22, text: '[ 0, 1 ]', tone: 'accent' },
  { x: 52, y: 4, depth: 10, dur: 19, delay: -13, dx: 14, dy: 22, rot: 6, size: 18, text: 'e^iπ + 1 = 0', tone: 'primary' },

  { x: 10, y: 56, depth: 24, dur: 16, delay: -2, dx: 24, dy: -24, rot: 16, size: 30, icon: BrainCircuit, tone: 'primary' },
  { x: 86, y: 32, depth: 26, dur: 18, delay: -5, dx: -22, dy: 26, rot: -12, size: 30, icon: Sparkles, tone: 'violet' },
  { x: 17, y: 22, depth: 20, dur: 14, delay: -8, dx: 20, dy: 20, rot: 10, size: 26, icon: Lightbulb, tone: 'accent' },
  { x: 76, y: 84, depth: 22, dur: 17, delay: -3, dx: -26, dy: -18, rot: -8, size: 28, icon: GraduationCap, tone: 'primary' },
  { x: 8, y: 86, depth: 18, dur: 19, delay: -6, dx: 22, dy: -22, rot: 12, size: 26, icon: BookOpen, tone: 'violet' },
  { x: 94, y: 60, depth: 20, dur: 15, delay: -9, dx: -18, dy: 26, rot: -10, size: 26, icon: Network, tone: 'accent' },
  { x: 48, y: 82, depth: 16, dur: 21, delay: -4, dx: 18, dy: -24, rot: 8, size: 24, icon: Atom, tone: 'primary' },
  { x: 80, y: 28, depth: 18, dur: 16, delay: -7, dx: -20, dy: 18, rot: -6, size: 24, icon: Code2, tone: 'violet' },
  { x: 34, y: 76, depth: 14, dur: 18, delay: -10, dx: 16, dy: -20, rot: 8, size: 22, icon: Calculator, tone: 'accent' },
  { x: 78, y: 52, depth: 14, dur: 20, delay: -12, dx: -16, dy: 18, rot: -8, size: 22, icon: Puzzle, tone: 'primary' },
  { x: 3, y: 72, depth: 22, dur: 22, delay: -1, dx: 14, dy: -26, rot: 10, size: 24, icon: Rocket, tone: 'violet' },

  { x: 18, y: 8, depth: 22, dur: 20, delay: -3, dx: 26, dy: 24, rot: 40, size: 54, shape: 'triangle', tone: 'primary' },
  { x: 92, y: 8, depth: 18, dur: 23, delay: -6, dx: -22, dy: 22, rot: -30, size: 58, shape: 'hexagon', tone: 'violet' },
  { x: 2, y: 92, depth: 20, dur: 21, delay: -9, dx: 24, dy: -22, rot: 36, size: 50, shape: 'square', tone: 'accent' },
  { x: 96, y: 78, depth: 16, dur: 24, delay: -2, dx: -26, dy: -20, rot: -28, size: 64, shape: 'ring', tone: 'primary' },
  { x: 58, y: 12, depth: 8, dur: 22, delay: -11, dx: 22, dy: 14, rot: 0, size: 84, shape: 'wave', tone: 'accent' },
  { x: 38, y: 62, depth: 8, dur: 26, delay: -5, dx: -14, dy: 16, rot: 0, size: 70, shape: 'dots', tone: 'violet' },
  { x: 74, y: 40, depth: 10, dur: 25, delay: -14, dx: 18, dy: -16, rot: 20, size: 44, shape: 'triangle', tone: 'accent' },
]

const TONE = { primary: 'text-primary', accent: 'text-accent', violet: 'text-[#8b5cf6] dark:text-[#a78bfa]' } as const

function Shape({ kind, size }: { kind: 'triangle' | 'hexagon' | 'ring' | 'square' | 'wave' | 'dots'; size: number }) {
  const common = { width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'triangle': return <svg viewBox="0 0 48 48" {...common}><path d="M24 6 44 40H4Z" /></svg>
    case 'hexagon': return <svg viewBox="0 0 48 48" {...common}><path d="M24 4 42 14v20L24 44 6 34V14Z" /></svg>
    case 'ring': return <svg viewBox="0 0 48 48" {...common}><circle cx="24" cy="24" r="18" /><circle cx="24" cy="24" r="9" /></svg>
    case 'square': return <svg viewBox="0 0 48 48" {...common}><rect x="8" y="8" width="32" height="32" rx="6" /></svg>
    case 'wave': return <svg viewBox="0 0 96 32" width={size} height={size / 3} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M2 16c10-22 20-22 30 0s20 22 30 0 20-22 32 0" /></svg>
    case 'dots': return <svg viewBox="0 0 48 48" width={size} height={size} fill="currentColor">{[8, 24, 40].flatMap((cx) => [8, 24, 40].map((cy) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="2" />))}</svg>
  }
}

const PARTICLES = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  y: (i * 53 + 7) % 100,
  s: 2 + (i % 4),
  dur: 11 + (i % 7) * 2.3,
  delay: -((i * 1.7) % 14),
}))

function Floating({ item }: { item: Item }) {
  const size = item.size ?? 24
  let body: ReactNode
  // glyphs are drawn through a CSS pseudo-element (content: attr(data-g)): purely decorative, so they are not text a screen reader or contrast checker should treat as content
  if ('text' in item) body = <span data-g={item.text} className="nt-glyph block whitespace-nowrap font-mono font-semibold" style={{ fontSize: size }} />
  else if ('icon' in item) { const Icon = item.icon; body = <Icon style={{ width: size, height: size }} strokeWidth={1.6} /> }
  else body = <Shape kind={item.shape} size={size} />
  return (
    <span
      className="absolute"
      style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate3d(calc(var(--px, 0) * ${item.depth}px), calc(var(--py, 0) * ${item.depth}px), 0)`, transition: 'transform 0.6s cubic-bezier(0.22,1,0.36,1)' } as CSSProperties}
    >
      <span
        className={cn('nt-drift block opacity-[0.28] dark:opacity-[0.34]', TONE[item.tone ?? 'primary'])}
        style={{ '--dx': `${item.dx}px`, '--dy': `${item.dy}px`, '--rot': `${item.rot}deg`, '--dur': `${item.dur}s`, '--delay': `${item.delay}s` } as CSSProperties}
      >
        {body}
      </span>
    </span>
  )
}

export function FloatingBackdrop({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  // pointer depth: one throttled listener writes two CSS variables; no React state
  useEffect(() => {
    const el = ref.current
    if (!el || !globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
    let frame = 0
    const onMove = (e: PointerEvent) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const r = el.getBoundingClientRect()
        el.style.setProperty('--px', String(((e.clientX - r.left) / r.width - 0.5) * 2))
        el.style.setProperty('--py', String(((e.clientY - r.top) / r.height - 0.5) * 2))
      })
    }
    el.addEventListener('pointermove', onMove, { passive: true })
    return () => { el.removeEventListener('pointermove', onMove); if (frame) cancelAnimationFrame(frame) }
  }, [])

  return (
    <div ref={ref} className={cn('nt-welcome relative isolate overflow-hidden', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 size-[520px] rounded-full bg-primary/20 blur-3xl nt-glow-a" />
        <div className="absolute -bottom-40 -right-24 size-[560px] rounded-full bg-[#8b5cf6]/20 blur-3xl nt-glow-b" />
        <div className="absolute left-1/2 top-1/3 size-[420px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl nt-glow-a" />
        {ITEMS.map((item, i) => <Floating key={i} item={item} />)}
        {PARTICLES.map((p, i) => (
          <span key={i} className="nt-particle absolute rounded-full bg-primary/50" style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, '--dur': `${p.dur}s`, '--delay': `${p.delay}s` } as CSSProperties} />
        ))}
      </div>
      {children}
    </div>
  )
}
