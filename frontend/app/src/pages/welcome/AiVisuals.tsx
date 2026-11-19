import type { CSSProperties } from 'react'

/** Decorative, aria-hidden atom with orbiting electrons for the welcome page. SVG + CSS only,
 *  transform animations, switched off by prefers-reduced-motion. */

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
