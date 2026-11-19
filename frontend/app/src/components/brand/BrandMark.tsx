import { cn } from '@/lib/cn'

export type MarkMotion = 'pulse' | 'none'

/** The Neuro Symbolic Tutor mark: a brain wired as a small neural graph (neuroscience + AI) resting on an
 *  open book (education), on a rounded square. Static by default; `pulse` lights the nodes in sequence for loading states
 *  (transform / opacity only, and switched off by prefers-reduced-motion and the in-app override). */
export function BrandMark({ size = 32, motion = 'none', className }: { size?: number; motion?: MarkMotion; className?: string }) {
  return (
    <svg className={cn('nt-mark shrink-0', className)} data-motion={motion} width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <defs>
        <linearGradient id="nt-mark-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#nt-mark-gradient)" />
      <g fill="#fff">
        <path d="M31 12.5C27.5 8.5 19.5 10.5 19.5 17.5C15.5 19.5 15.5 26.5 20 28.5C21 33.5 28 35.5 31 31.5Z" fillOpacity=".16" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M33 12.5C36.5 8.5 44.5 10.5 44.5 17.5C48.5 19.5 48.5 26.5 44 28.5C43 33.5 36 35.5 33 31.5Z" fillOpacity=".16" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M23 19.5 26 26.5M41 19.5 38 26.5M26 26.5H38" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.3" strokeLinecap="round" />
        <circle className="nt-node" cx="23" cy="19.5" r="2.4" /><circle className="nt-node" cx="41" cy="19.5" r="2.4" />
        <circle className="nt-node" cx="26" cy="26.5" r="2.4" /><circle className="nt-node" cx="38" cy="26.5" r="2.4" />
        <path d="M32 44.5C27 40.5 18.5 40 10.5 42.5V52C18.5 50 27 50.5 32 54.5Z" fillOpacity=".95" />
        <path d="M32 44.5C37 40.5 45.5 40 53.5 42.5V52C45.5 50 37 50.5 32 54.5Z" fillOpacity=".78" />
      </g>
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('whitespace-nowrap text-lg font-semibold tracking-tight', className)}>
      Neuro Symbolic <span className="text-primary">Tutor</span>
    </span>
  )
}
