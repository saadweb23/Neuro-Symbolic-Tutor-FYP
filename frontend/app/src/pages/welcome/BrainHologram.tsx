import { BarChart3, BrainCircuit, GraduationCap } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Atom } from './AiVisuals'

/** The hero illustration: a glowing neural brain floating above a holographic platform, with glass tags
 *  that drift around it, an orbiting ring and small science motifs. Everything is vector / CSS and runs on
 *  transform / opacity (reduced motion stops it). It is decorative, so the whole scene is aria-hidden. */

// ---- the brain is generated once, deterministically (no randomness at runtime) --------------------
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CX = 215
const CY = 165
const A = 182
const B = 132

/** Cerebrum outline: an ellipse whose edge ripples like gyri, flatter underneath. */
function outlinePoint(t: number): [number, number] {
  const bump = 1 + 0.032 * Math.sin(11 * t + 0.6) + 0.02 * Math.sin(19 * t + 1.3) + 0.012 * Math.sin(29 * t)
  const lower = Math.sin(t) > 0
  const squash = lower ? 0.8 : 1
  const front = Math.cos(t) < 0 ? 1.02 : 0.98     // frontal lobe a touch fuller
  return [CX + A * front * Math.cos(t) * bump, CY + B * squash * Math.sin(t) * bump]
}
const OUTLINE = (() => {
  const pts = Array.from({ length: 180 }, (_, i) => outlinePoint((i / 180) * Math.PI * 2))
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`
})()

const inside = (x: number, y: number, k = 0.86) => ((x - CX) / (A * k)) ** 2 + ((y - CY) / (B * k * (y > CY ? 0.8 : 1))) ** 2 < 1

/** Sulci: wavy strokes that follow the surface, like the folds of a cortex. */
const SULCI = (() => {
  const r = rng(7)
  const out: string[] = []
  for (let i = 0; i < 24; i++) {
    let x = CX + (r() - 0.5) * A * 1.6
    let y = CY + (r() - 0.5) * B * 1.5
    if (!inside(x, y, 0.8)) { i--; continue }
    let ang = Math.atan2(y - CY, x - CX) + Math.PI / 2 + (r() - 0.5) * 1.1
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`
    for (let s = 0; s < 4; s++) {
      ang += (r() - 0.5) * 1.5
      const nx = x + Math.cos(ang) * (22 + r() * 16)
      const ny = y + Math.sin(ang) * (22 + r() * 16)
      d += ` Q${(x + (nx - x) / 2 + (r() - 0.5) * 20).toFixed(1)} ${(y + (ny - y) / 2 + (r() - 0.5) * 20).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`
      x = nx; y = ny
    }
    out.push(d)
  }
  return out
})()

/** Neurons and the synapses between near neighbours. */
const MESH = (() => {
  const r = rng(21)
  const nodes: { x: number; y: number; d: number }[] = []
  while (nodes.length < 44) {
    const x = CX + (r() - 0.5) * A * 1.9
    const y = CY + (r() - 0.5) * B * 1.9
    if (inside(x, y, 0.8) && nodes.every((n) => Math.hypot(n.x - x, n.y - y) > 26)) nodes.push({ x, y, d: r() * 3.5 })
  }
  const links: [number, number, number, number][] = []
  nodes.forEach((a, i) => nodes.forEach((b, j) => { if (j > i && Math.hypot(a.x - b.x, a.y - b.y) < 58) links.push([a.x, a.y, b.x, b.y]) }))
  return { nodes, links }
})()

const CEREBELLUM = { cx: CX + 100, cy: CY + 112, rx: 60, ry: 30 }

function Brain() {
  return (
    <svg viewBox="0 0 430 360" className="nt-brain-svg w-full" fill="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id="nt-brain-fill" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.7" /><stop offset="0.45" stopColor="#3b82f6" stopOpacity="0.55" /><stop offset="1" stopColor="#a855f7" stopOpacity="0.65" />
        </linearGradient>
        <linearGradient id="nt-brain-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#67e8f9" /><stop offset="0.55" stopColor="#818cf8" /><stop offset="1" stopColor="#c084fc" />
        </linearGradient>
        <radialGradient id="nt-brain-core" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stopColor="#bae6fd" stopOpacity="0.5" /><stop offset="1" stopColor="#4f46e5" stopOpacity="0" /></radialGradient>
        <clipPath id="nt-brain-clip"><path d={OUTLINE} /></clipPath>
      </defs>

      {/* brainstem + cerebellum sit behind the cerebrum */}
      <path d={`M${CX + 18} ${CY + 98} C${CX + 22} ${CY + 140} ${CX + 36} ${CY + 170} ${CX + 44} ${CY + 196} L${CX + 76} ${CY + 196} C${CX + 78} ${CY + 160} ${CX + 70} ${CY + 130} ${CX + 62} ${CY + 98}Z`} fill="url(#nt-brain-fill)" stroke="url(#nt-brain-line)" strokeWidth="1.6" opacity="0.8" />
      <g>
        <ellipse {...CEREBELLUM} fill="url(#nt-brain-fill)" stroke="url(#nt-brain-line)" strokeWidth="1.8" />
        {[-18, -9, 0, 9, 18].map((o) => <path key={o} d={`M${CEREBELLUM.cx - 52 + Math.abs(o) * 0.4} ${CEREBELLUM.cy + o} Q${CEREBELLUM.cx} ${CEREBELLUM.cy + o + 9} ${CEREBELLUM.cx + 52 - Math.abs(o) * 0.4} ${CEREBELLUM.cy + o}`} stroke="#a5b4fc" strokeOpacity="0.55" strokeWidth="1.2" />)}
      </g>

      {/* cerebrum */}
      <path d={OUTLINE} fill="url(#nt-brain-fill)" />
      <path d={OUTLINE} fill="url(#nt-brain-core)" />
      <g clipPath="url(#nt-brain-clip)">
        <g stroke="#67e8f9" strokeOpacity="0.28" strokeWidth="6" strokeLinecap="round">{SULCI.map((d, i) => <path key={`g${i}`} d={d} />)}</g>
        <g stroke="#cffafe" strokeOpacity="0.9" strokeWidth="2.2" strokeLinecap="round">{SULCI.map((d, i) => <path key={i} d={d} />)}</g>
        <g stroke="#e0f2fe" strokeOpacity="0.2" strokeWidth="0.8">{MESH.links.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}</g>
        <g fill="#e0f2fe">{MESH.nodes.map((n, i) => <circle key={i} className="nt-neuron" cx={n.x} cy={n.y} r={2.6} style={{ '--d': `${n.d}s` } as CSSProperties} />)}</g>
      </g>
      <path d={OUTLINE} stroke="url(#nt-brain-line)" strokeWidth="2.6" strokeLinejoin="round" />
      <path d={OUTLINE} stroke="#fff" strokeOpacity="0.35" strokeWidth="0.8" transform="translate(0 -1.5)" />
    </svg>
  )
}

function Platform() {
  return (
    <svg viewBox="0 0 640 200" className="w-full" fill="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id="nt-ring" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6366f1" /><stop offset="0.5" stopColor="#22d3ee" /><stop offset="1" stopColor="#a855f7" /></linearGradient>
        <radialGradient id="nt-disc" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#7dd3fc" stopOpacity="0.95" /><stop offset="0.5" stopColor="#3b82f6" stopOpacity="0.5" /><stop offset="1" stopColor="#4f46e5" stopOpacity="0" /></radialGradient>
        <radialGradient id="nt-halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#4f46e5" stopOpacity="0.5" /><stop offset="1" stopColor="#4f46e5" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="320" cy="120" rx="318" ry="74" fill="url(#nt-halo)" />
      <ellipse cx="320" cy="118" rx="300" ry="66" stroke="url(#nt-ring)" strokeOpacity="0.45" strokeWidth="1.5" className="nt-ring-a" />
      <ellipse cx="320" cy="116" rx="250" ry="54" stroke="url(#nt-ring)" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="3 9" className="nt-ring-dash" />
      <ellipse cx="320" cy="112" rx="200" ry="42" fill="#0b1240" stroke="url(#nt-ring)" strokeWidth="2.4" />
      <ellipse cx="320" cy="108" rx="150" ry="30" fill="#101a5c" stroke="#38bdf8" strokeOpacity="0.9" strokeWidth="2" />
      <ellipse cx="320" cy="104" rx="104" ry="20" fill="url(#nt-disc)" className="nt-ring-b" />
      <ellipse cx="320" cy="102" rx="64" ry="11" fill="#bae6fd" fillOpacity="0.85" />
    </svg>
  )
}

const TAG = 'nt-tag flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[13px] font-medium leading-tight text-sky-50 sm:text-sm'

function Tag({ className, delay, children, tilt }: { className: string; delay: string; children: ReactNode; tilt: string }) {
  return (
    <div className={`${className} nt-bob absolute`} style={{ '--delay': delay } as CSSProperties}>
      <div className={TAG} style={{ transform: tilt }}>{children}</div>
    </div>
  )
}

export function BrainHologram() {
  return (
    <div className="relative mx-auto aspect-[1/1.02] w-full max-w-[640px] select-none sm:aspect-[1/0.95]" aria-hidden>
      {/* atmosphere + beam */}
      <div className="absolute inset-x-[10%] bottom-[8%] top-[10%] rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="nt-beam absolute bottom-[16%] left-[28%] h-[46%] w-[44%]" />

      {/* platform */}
      <div className="absolute inset-x-[-2%] bottom-[-2%]" style={{ transform: 'translate3d(calc(var(--px, 0) * 6px), calc(var(--py, 0) * 4px), 0)' }}><Platform /></div>

      {/* orbit ring with a travelling light, behind and in front of the brain */}
      <svg viewBox="0 0 640 520" className="absolute inset-0 h-full w-full" fill="none" focusable="false">
        <defs><linearGradient id="nt-orbit-ring" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#a855f7" stopOpacity="0" /><stop offset="0.45" stopColor="#818cf8" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
        <g transform="translate(320 205) rotate(-24) scale(1 0.34)">
          <circle r="290" stroke="url(#nt-orbit-ring)" strokeWidth="3" opacity="0.9" />
          <g className="nt-orbit" style={{ '--dur': '14s' } as CSSProperties}><circle r="290" stroke="none" /><circle cx="290" cy="0" r="9" fill="#e0f2fe" /><circle cx="290" cy="0" r="22" fill="#22d3ee" opacity="0.3" /></g>
        </g>
      </svg>

      {/* brain */}
      <div className="nt-float absolute left-[14%] top-[2%] w-[72%]" style={{ filter: 'drop-shadow(0 0 22px rgb(99 102 241 / 0.75)) drop-shadow(0 0 60px rgb(56 189 248 / 0.35))' }}>
        <div style={{ transform: 'translate3d(calc(var(--px, 0) * 12px), calc(var(--py, 0) * 8px), 0)' }}><Brain /></div>
      </div>

      {/* floating glass tags */}
      <div style={{ transform: 'translate3d(calc(var(--px, 0) * 20px), calc(var(--py, 0) * 14px), 0)' }} className="absolute inset-0">
        <Tag className="left-[-1%] top-[22%]" delay="-1s" tilt="perspective(700px) rotateY(18deg) rotateX(4deg) rotateZ(-5deg)">
          <GraduationCap className="size-7 shrink-0 text-cyan-300" strokeWidth={1.6} />Personalized<br />Learning
        </Tag>
        <Tag className="right-[-2%] top-[36%]" delay="-3s" tilt="perspective(700px) rotateY(-18deg) rotateX(4deg) rotateZ(5deg)">
          <BarChart3 className="size-7 shrink-0 text-cyan-300" strokeWidth={1.6} />Track<br />Progress
        </Tag>
        <Tag className="right-[2%] top-[60%] hidden sm:block" delay="-5s" tilt="perspective(700px) rotateY(-18deg) rotateX(4deg) rotateZ(4deg)">
          <BrainCircuit className="size-7 shrink-0 text-cyan-300" strokeWidth={1.6} />Fill Knowledge<br />Gaps
        </Tag>
      </div>

      {/* science motifs */}
      <span className="nt-bob absolute right-[1%] top-[2%] font-serif text-xl italic text-indigo-300/70 sm:text-2xl" style={{ '--delay': '-2s' } as CSSProperties}>E = mc²</span>
      <span className="nt-bob absolute left-[34%] top-[0%] hidden font-serif text-5xl text-indigo-300/60 sm:block" style={{ '--delay': '-4s' } as CSSProperties}>∑</span>
      <Atom className="nt-bob absolute right-[-3%] top-[14%] hidden w-[17%] opacity-90 sm:block" />
      <svg className="nt-bob absolute left-[26%] top-[50%] hidden w-[8%] text-cyan-300/70 sm:block" viewBox="0 0 48 52" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" style={{ '--delay': '-1.5s' } as CSSProperties}>
        <path d="M24 4 44 15v22L24 48 4 37V15Z" /><path d="M24 26 44 15M24 26 4 15M24 26v22" />
      </svg>
      <svg className="absolute bottom-[26%] right-[-2%] hidden w-[9%] text-indigo-300/60 md:block" viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M10 4v46h46" /><path d="M10 50 30 30" strokeDasharray="2 3" /><text x="2" y="12" fontSize="8" fill="currentColor" stroke="none">y</text><text x="50" y="58" fontSize="8" fill="currentColor" stroke="none">x</text>
      </svg>
    </div>
  )
}
