import type { CSSProperties } from 'react'

/** Decorative, aria-hidden illustrations for the welcome page: a small neural network whose neurons
 *  pulse and along whose links signals travel, and an atom with orbiting electrons. SVG + CSS only,
 *  transform / opacity animations, switched off by prefers-reduced-motion. */

// layered network: x per layer, y per neuron
const LAYERS: { x: number; ys: number[] }[] = [
  { x: 24, ys: [70, 150, 230, 310] },
  { x: 150, ys: [40, 115, 190, 265, 340] },
  { x: 276, ys: [70, 150, 230, 310] },
  { x: 392, ys: [130, 250] },
]

const EDGES: [number, number, number, number][] = []
for (let l = 0; l < LAYERS.length - 1; l++) {
  const a = LAYERS[l]!
  const b = LAYERS[l + 1]!
  a.ys.forEach((ya, i) => b.ys.forEach((yb, j) => { if ((i + j + l) % 2 === 0 || Math.abs(i / a.ys.length - j / b.ys.length) < 0.3) EDGES.push([a.x, ya, b.x, yb]) }))
}

export function NeuralNetwork({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 420 380" fill="none" aria-hidden focusable="false">
      <g stroke="currentColor" strokeWidth="1">
        {EDGES.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} opacity={0.2} />)}
      </g>
      <g stroke="url(#nt-signal)" strokeWidth="1.8" strokeLinecap="round">
        {EDGES.filter((_, i) => i % 4 === 0).map(([x1, y1, x2, y2], i) => (
          <line key={i} className="nt-signal" x1={x1} y1={y1} x2={x2} y2={y2} style={{ '--d': `${(i * 0.7) % 5}s` } as CSSProperties} />
        ))}
      </g>
      <defs>
        <linearGradient id="nt-signal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <g fill="currentColor">
        {LAYERS.flatMap((l, li) => l.ys.map((y, i) => (
          <circle key={`${li}-${i}`} className="nt-neuron" cx={l.x} cy={y} r={li === 3 ? 6 : 4.5} style={{ '--d': `${((li * 5 + i) * 0.45) % 3.2}s` } as CSSProperties} />
        )))}
      </g>
    </svg>
  )
}

const ORBITS = [
  { rot: 0, dur: 9, delay: 0 },
  { rot: 60, dur: 12, delay: -3 },
  { rot: 120, dur: 15, delay: -6 },
]

export function Atom({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-100 -100 200 200" fill="none" aria-hidden focusable="false">
      <defs>
        <radialGradient id="nt-nucleus"><stop offset="0" stopColor="#c4b5fd" /><stop offset="0.55" stopColor="#8b5cf6" /><stop offset="1" stopColor="#4f46e5" stopOpacity="0" /></radialGradient>
        <linearGradient id="nt-orbit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#38bdf8" /></linearGradient>
      </defs>
      <g className="nt-atom-tilt">
        {ORBITS.map((o) => (
          <g key={o.rot} transform={`rotate(${o.rot}) scale(1 0.36)`}>
            <circle r="80" stroke="url(#nt-orbit)" strokeOpacity="0.55" strokeWidth="1.4" />
            <g className="nt-orbit" style={{ '--dur': `${o.dur}s`, '--delay': `${o.delay}s` } as CSSProperties}>
              <circle r="80" stroke="none" />
              <circle cx="80" cy="0" r="5.5" fill="#a5b4fc" />
              <circle cx="80" cy="0" r="11" fill="#818cf8" opacity="0.25" />
            </g>
          </g>
        ))}
      </g>
      <circle r="22" fill="url(#nt-nucleus)" className="nt-nucleus" />
      <circle r="6" fill="#ede9fe" />
    </svg>
  )
}
