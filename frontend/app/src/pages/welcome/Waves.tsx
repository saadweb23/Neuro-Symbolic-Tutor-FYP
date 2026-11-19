import type { CSSProperties } from 'react'

/** Flowing purple-blue waves along the bottom edge. Each layer is two copies of a seamless sine path in a
 *  200%-wide strip that slides by exactly one copy (transform only), at its own speed. */
const wave = (amp: number, mid: number) => {
  const pts: string[] = []
  for (let x = 0; x <= 1440; x += 40) pts.push(`${x} ${(mid + Math.sin((x / 1440) * Math.PI * 2) * amp).toFixed(1)}`)
  return `M${pts.join('L')}`
}

const LAYERS = [
  { amp: 26, mid: 92, dur: 26, color: 'url(#nt-w1)', width: 2, opacity: 0.9 },
  { amp: 18, mid: 106, dur: 19, color: 'url(#nt-w2)', width: 1.6, opacity: 0.7 },
  { amp: 32, mid: 84, dur: 34, color: 'url(#nt-w1)', width: 1.2, opacity: 0.5 },
]

export function Waves({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <svg width="0" height="0" className="absolute" focusable="false">
        <defs>
          <linearGradient id="nt-w1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={{ stopColor: 'var(--w-wave-1)' }} /><stop offset="0.5" style={{ stopColor: 'var(--w-wave-2)' }} /><stop offset="1" style={{ stopColor: 'var(--w-wave-3)' }} /></linearGradient>
          <linearGradient id="nt-w2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={{ stopColor: 'var(--w-wave-3)' }} /><stop offset="0.5" style={{ stopColor: 'var(--w-wave-1)' }} /><stop offset="1" style={{ stopColor: 'var(--w-wave-2)' }} /></linearGradient>
          <linearGradient id="nt-wfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--w-wave-fill)', stopOpacity: 0.35 }} /><stop offset="1" style={{ stopColor: 'var(--w-wave-fill)', stopOpacity: 0 }} /></linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 overflow-hidden">
        {LAYERS.map((l, i) => (
          <svg key={i} className="nt-wave absolute bottom-0 left-0 h-full w-[200%]" style={{ '--dur': `${l.dur}s`, opacity: l.opacity } as CSSProperties} viewBox="0 0 2880 160" preserveAspectRatio="none" fill="none" focusable="false">
            {[0, 1440].map((dx) => (
              <g key={dx} transform={`translate(${dx} 0)`}>
                {i === 0 && <path d={`${wave(l.amp, l.mid)}L1440 160L0 160Z`} fill="url(#nt-wfill)" />}
                <path d={wave(l.amp, l.mid)} stroke={l.color} strokeWidth={l.width} strokeLinecap="round" />
              </g>
            ))}
          </svg>
        ))}
      </div>
    </div>
  )
}
