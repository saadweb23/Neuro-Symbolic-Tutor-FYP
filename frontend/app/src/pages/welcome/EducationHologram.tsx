import { BarChart3, BookOpenCheck, GraduationCap } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Atom } from './AiVisuals'

/** The hero illustration: a glowing 3D open book floating over a holographic platform. A knowledge graph of
 *  real curriculum concepts rises from its pages, glass cards drift around it, formulas and an atom orbit
 *  in the space, and faint neural links tie everything together. Vector + CSS only (transform / opacity),
 *  recoloured entirely by the active theme's variables; decorative, so the whole scene is aria-hidden. */

const stop = (v: string, o = 1): CSSProperties => ({ stopColor: `var(${v})`, stopOpacity: o })
const ink = 'var(--w-page-ink)'

// ---- the book ----------------------------------------------------------------------------------------
const LEFT_PAGE = 'M280 214C206 150 112 146 40 164L34 266C112 250 206 256 280 318Z'
const RIGHT_PAGE = 'M280 214C354 150 448 146 520 164L526 266C448 250 354 256 280 318Z'

function Book() {
  return (
    <svg viewBox="0 0 560 360" className="w-full" fill="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id="nt-page" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={stop('--w-page-1', 0.95)} /><stop offset="1" style={stop('--w-page-2', 0.72)} /></linearGradient>
        <linearGradient id="nt-cover" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('--w-cover-1')} /><stop offset="1" style={stop('--w-cover-2')} /></linearGradient>
        <linearGradient id="nt-spine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('--w-edge', 0)} /><stop offset="0.5" style={stop('--w-edge', 1)} /><stop offset="1" style={stop('--w-edge', 0)} /></linearGradient>
        <radialGradient id="nt-pageglow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" style={stop('--w-spark', 0.85)} /><stop offset="1" style={stop('--w-spark', 0)} /></radialGradient>
      </defs>

      {/* cover, seen from slightly above */}
      <path d="M280 330C196 282 78 280 24 304L24 276C78 252 196 254 280 300C364 254 482 252 536 276L536 304C482 280 364 282 280 330Z" fill="url(#nt-cover)" stroke="var(--w-edge)" strokeOpacity="0.8" strokeWidth="2" />
      {/* page stacks: thickness */}
      {[0, 5, 10].map((o) => <path key={o} d={`M34 ${266 + o}C112 ${250 + o} 206 ${256 + o} 280 ${318 + o} C354 ${256 + o} 448 ${250 + o} 526 ${266 + o}`} stroke="var(--w-edge)" strokeOpacity={0.55 - o * 0.03} strokeWidth="1.4" />)}

      {/* left page: text + a concept map */}
      <path d={LEFT_PAGE} fill="url(#nt-page)" stroke="var(--w-edge)" strokeWidth="2.2" strokeLinejoin="round" />
      <g transform="matrix(1 0.2 0 1 0 -56)" style={{ color: ink }}>
        <rect x="58" y="190" width="78" height="7" rx="3.5" fill="currentColor" opacity="0.85" />
        {[206, 218, 230].map((y, i) => <rect key={y} x="58" y={y} width={150 - i * 22} height="4" rx="2" fill="currentColor" opacity="0.4" />)}
        <g stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.3">
          <path d="M96 276 126 252 168 266 200 242M126 252 152 232" />
        </g>
        <g fill="currentColor">{[[96, 276], [126, 252], [168, 266], [200, 242], [152, 232]].map(([x, y], i) => <circle key={i} className="nt-neuron" cx={x} cy={y} r="4.2" style={{ '--d': `${i * 0.5}s` } as CSSProperties} />)}</g>
      </g>

      {/* right page: formula + progress */}
      <g className="nt-page-sway">
        <path d={RIGHT_PAGE} fill="url(#nt-page)" stroke="var(--w-edge)" strokeWidth="2.2" strokeLinejoin="round" />
        <g transform="matrix(1 -0.2 0 1 0 56)" style={{ color: ink }}>
          <text x="318" y="204" fontSize="17" fontFamily="Georgia, serif" fontStyle="italic" fill="currentColor" opacity="0.95">f(x) = ∑ wᵢxᵢ + b</text>
          {[218, 229].map((y, i) => <rect key={y} x="318" y={y} width={150 - i * 34} height="4" rx="2" fill="currentColor" opacity="0.38" />)}
          <g fill="currentColor">{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={322 + i * 22} y={286 - (14 + i * 8)} width="12" height={14 + i * 8} rx="2" opacity={0.35 + i * 0.12} />)}</g>
          <path d="M322 272 L344 262 L366 266 L388 250 L410 240 L432 226" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
        </g>
      </g>

      {/* spine light */}
      <path d="M280 214V318" stroke="url(#nt-spine)" strokeWidth="3" />
      <ellipse cx="280" cy="262" rx="34" ry="60" fill="url(#nt-pageglow)" opacity="0.5" />
    </svg>
  )
}

// ---- knowledge graph hologram rising from the book (real curriculum concepts and prerequisite links) -----
const NODES: { id: string; x: number; y: number; w: number; done?: boolean }[] = [
  { id: 'Variables', x: 150, y: 168, w: 70, done: true },
  { id: 'Relational Ops', x: 52, y: 124, w: 90, done: true },
  { id: 'Conditionals', x: 66, y: 66, w: 78, done: true },
  { id: 'For Loops', x: 244, y: 122, w: 66 },
  { id: 'Functions', x: 246, y: 62, w: 66 },
  { id: 'Recursion', x: 150, y: 20, w: 70 },
]
const LINKS: [number, number][] = [[0, 1], [1, 2], [0, 3], [0, 4], [4, 5], [2, 5]]

function KnowledgeGraph() {
  return (
    <svg viewBox="0 0 300 190" className="w-full" fill="none" aria-hidden focusable="false">
      <g strokeWidth="1.6" stroke="var(--w-edge)" strokeOpacity="0.55">{LINKS.map(([a, b], i) => <line key={i} x1={NODES[a]!.x} y1={NODES[a]!.y} x2={NODES[b]!.x} y2={NODES[b]!.y} />)}</g>
      <g strokeWidth="2.4" strokeLinecap="round" stroke="var(--w-spark)">{LINKS.map(([a, b], i) => <line key={i} className="nt-signal" x1={NODES[a]!.x} y1={NODES[a]!.y} x2={NODES[b]!.x} y2={NODES[b]!.y} style={{ '--d': `${i * 0.8}s` } as CSSProperties} />)}</g>
      {NODES.map((n, i) => (
        <g key={n.id} transform={`translate(${n.x - n.w / 2} ${n.y - 11})`}>
          <rect className="nt-neuron" width={n.w} height="22" rx="11" style={{ fill: n.done ? 'var(--w-a)' : 'var(--w-tag-bg-solid)', stroke: 'var(--w-edge)', strokeWidth: 1.4, '--d': `${i * 0.55}s` } as CSSProperties} fillOpacity={n.done ? 0.85 : 0.9} />
          <text x={n.w / 2} y="15" textAnchor="middle" fontSize="9.5" fontWeight="600" style={{ fill: n.done ? '#fff' : 'var(--w-tag-text)' }}>{n.id}</text>
        </g>
      ))}
    </svg>
  )
}

function Platform() {
  return (
    <svg viewBox="0 0 640 200" className="w-full" fill="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id="nt-ring" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop('--w-plat-1')} /><stop offset="0.5" style={stop('--w-plat-2')} /><stop offset="1" style={stop('--w-plat-3')} /></linearGradient>
        <radialGradient id="nt-disc" cx="0.5" cy="0.5" r="0.5"><stop offset="0" style={stop('--w-plat-core', 0.95)} /><stop offset="0.5" style={stop('--w-plat-2', 0.5)} /><stop offset="1" style={stop('--w-plat-1', 0)} /></radialGradient>
        <radialGradient id="nt-halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" style={stop('--w-plat-1', 0.5)} /><stop offset="1" style={stop('--w-plat-1', 0)} /></radialGradient>
      </defs>
      <ellipse cx="320" cy="120" rx="318" ry="74" fill="url(#nt-halo)" />
      <ellipse cx="320" cy="118" rx="300" ry="66" stroke="url(#nt-ring)" strokeOpacity="0.45" strokeWidth="1.5" className="nt-ring-a" />
      <ellipse cx="320" cy="116" rx="250" ry="54" stroke="url(#nt-ring)" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="3 9" className="nt-ring-dash" />
      <ellipse cx="320" cy="112" rx="200" ry="42" style={{ fill: 'var(--w-plat-fill)' }} stroke="url(#nt-ring)" strokeWidth="2.4" />
      <ellipse cx="320" cy="108" rx="150" ry="30" style={{ fill: 'var(--w-plat-fill-2)', stroke: 'var(--w-plat-2)' }} strokeOpacity="0.9" strokeWidth="2" />
      <ellipse cx="320" cy="104" rx="104" ry="20" fill="url(#nt-disc)" className="nt-ring-b" />
      <ellipse cx="320" cy="102" rx="64" ry="11" style={{ fill: 'var(--w-plat-core)' }} fillOpacity="0.85" />
    </svg>
  )
}

function Tag({ className, delay, children, tilt }: { className: string; delay: string; children: ReactNode; tilt: string }) {
  return (
    <div className={`${className} nt-bob absolute`} style={{ '--delay': delay } as CSSProperties}>
      <div className="nt-tag flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[13px] font-medium leading-tight sm:text-sm" style={{ transform: tilt }}>{children}</div>
    </div>
  )
}

const SPARKS = Array.from({ length: 14 }, (_, i) => ({ x: 36 + ((i * 29) % 28), s: 2 + (i % 3), dur: 5 + (i % 5), delay: -((i * 1.3) % 6) }))

export function EducationHologram() {
  return (
    <div className="relative mx-auto aspect-[1/1.02] w-full max-w-[640px] select-none sm:aspect-[1/0.95]" aria-hidden>
      <div className="absolute inset-x-[10%] bottom-[8%] top-[10%] rounded-full blur-3xl" style={{ background: 'var(--w-halo)' }} />
      <div className="nt-beam absolute bottom-[16%] left-[28%] h-[46%] w-[44%]" />

      <div className="absolute inset-x-[-2%] bottom-[-2%]" style={{ transform: 'translate3d(calc(var(--px, 0) * 6px), calc(var(--py, 0) * 4px), 0)' }}><Platform /></div>

      {/* orbit ring with a travelling light */}
      <svg viewBox="0 0 640 520" className="absolute inset-0 h-full w-full" fill="none" focusable="false">
        <defs><linearGradient id="nt-orbit-ring" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={stop('--w-b', 0)} /><stop offset="0.45" style={stop('--w-a')} /><stop offset="1" style={stop('--w-c')} /></linearGradient></defs>
        <g transform="translate(320 270) rotate(-22) scale(1 0.3)">
          <circle r="296" stroke="url(#nt-orbit-ring)" strokeWidth="3" opacity="0.9" />
          <g className="nt-orbit" style={{ '--dur': '14s' } as CSSProperties}><circle r="296" stroke="none" /><circle cx="296" cy="0" r="9" style={{ fill: 'var(--w-spark)' }} /><circle cx="296" cy="0" r="22" style={{ fill: 'var(--w-c)' }} opacity="0.3" /></g>
        </g>
      </svg>

      {/* neural links from the book out to the cards */}
      <svg viewBox="0 0 640 608" className="pointer-events-none absolute inset-0 h-full w-full" fill="none" focusable="false">
        <g stroke="var(--w-edge)" strokeOpacity="0.28" strokeWidth="1.2" strokeDasharray="2 6">
          <path d="M300 330 130 150M340 330 560 220M340 350 540 380M300 350 100 420" />
        </g>
        <g stroke="var(--w-spark)" strokeWidth="2" strokeLinecap="round">
          {['M300 330 130 150', 'M340 330 560 220', 'M340 350 540 380'].map((d, i) => <path key={d} className="nt-signal" d={d} style={{ '--d': `${i * 1.4}s` } as CSSProperties} />)}
        </g>
      </svg>

      {/* knowledge graph rising from the pages */}
      <div className="nt-float absolute left-[32%] top-[3%] w-[50%]" style={{ filter: 'drop-shadow(0 0 16px rgb(var(--w-glow) / 0.55))' }}>
        <div style={{ transform: 'translate3d(calc(var(--px, 0) * 10px), calc(var(--py, 0) * 6px), 0) perspective(700px) rotateX(10deg)' }}><KnowledgeGraph /></div>
      </div>

      {/* the open book */}
      <div className="absolute left-[8%] top-[34%] w-[84%]" style={{ filter: 'drop-shadow(0 0 26px rgb(var(--w-glow) / 0.65)) drop-shadow(0 0 70px rgb(var(--w-glow) / 0.28))' }}>
        <div className="nt-float" style={{ animationDuration: '8s' }}>
          <div style={{ transform: 'translate3d(calc(var(--px, 0) * 12px), calc(var(--py, 0) * 8px), 0)' }}><Book /></div>
        </div>
      </div>
      {/* light motes leaving the pages */}
      <div className="absolute inset-x-0 top-[44%] h-[18%]">
        {SPARKS.map((p, i) => <span key={i} className="nt-rise absolute rounded-full" style={{ left: `${p.x * 1.15}%`, bottom: 0, width: p.s, height: p.s, background: 'var(--w-spark)', boxShadow: '0 0 8px var(--w-spark)', '--dur': `${p.dur}s`, '--delay': `${p.delay}s` } as CSSProperties} />)}
      </div>

      {/* floating glass cards */}
      <div style={{ transform: 'translate3d(calc(var(--px, 0) * 20px), calc(var(--py, 0) * 14px), 0)' }} className="absolute inset-0">
        <Tag className="left-[-1%] top-[22%]" delay="-1s" tilt="perspective(700px) rotateY(18deg) rotateX(4deg) rotateZ(-5deg)">
          <GraduationCap className="nt-tag-icon size-7 shrink-0" strokeWidth={1.6} />Personalized<br />Learning
        </Tag>
        <Tag className="right-[-2%] top-[36%]" delay="-3s" tilt="perspective(700px) rotateY(-18deg) rotateX(4deg) rotateZ(5deg)">
          <BarChart3 className="nt-tag-icon size-7 shrink-0" strokeWidth={1.6} />Track<br />Progress
        </Tag>
        <Tag className="right-[2%] top-[60%] hidden sm:block" delay="-5s" tilt="perspective(700px) rotateY(-18deg) rotateX(4deg) rotateZ(4deg)">
          <BookOpenCheck className="nt-tag-icon size-7 shrink-0" strokeWidth={1.6} />Fill Knowledge<br />Gaps
        </Tag>
      </div>

      {/* formulas and science motifs */}
      <span className="nt-bob absolute right-[1%] top-[2%] font-serif text-xl italic sm:text-2xl" style={{ '--delay': '-2s', color: 'var(--w-muted)' } as CSSProperties}>E = mc²</span>
      <span className="nt-bob absolute left-[8%] top-[6%] hidden font-serif text-4xl sm:block" style={{ '--delay': '-4s', color: 'var(--w-muted)' } as CSSProperties}>∑</span>
      <span className="nt-bob absolute left-[2%] top-[56%] hidden font-serif text-2xl italic sm:block" style={{ '--delay': '-1s', color: 'var(--w-muted)' } as CSSProperties}>∫ f(x)dx</span>
      <Atom className="nt-bob absolute right-[-3%] top-[14%] hidden w-[17%] opacity-90 sm:block" />
      <svg className="nt-bob absolute left-[3%] top-[42%] hidden w-[7%] sm:block" viewBox="0 0 48 52" fill="none" stroke="var(--w-c)" strokeWidth="1.4" strokeLinejoin="round" style={{ '--delay': '-1.5s' } as CSSProperties}>
        <path d="M24 4 44 15v22L24 48 4 37V15Z" /><path d="M24 26 44 15M24 26 4 15M24 26v22" />
      </svg>
    </div>
  )
}
