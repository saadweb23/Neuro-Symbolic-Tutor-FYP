import { cn } from '@/lib/cn'

export type MarkMotion = 'pulse' | 'none'

/** The NeuroTutor mark: an "N" drawn as a small knowledge graph (four concepts joined by prerequisite
 *  links) on a rounded square. Static by default; `pulse` lights the nodes in sequence for loading states
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
      <path d="M20 44V20L44 44V20" fill="none" stroke="#fff" strokeOpacity=".92" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="#fff">
        <circle className="nt-node" cx="20" cy="44" r="5.5" />
        <circle className="nt-node" cx="20" cy="20" r="5.5" />
        <circle className="nt-node" cx="44" cy="44" r="5.5" />
        <circle className="nt-node" cx="44" cy="20" r="5.5" />
      </g>
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-lg font-semibold tracking-tight', className)}>
      Neuro<span className="text-primary">Tutor</span>
    </span>
  )
}
