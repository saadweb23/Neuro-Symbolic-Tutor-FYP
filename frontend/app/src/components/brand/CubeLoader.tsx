import { AnimatedCubeLogo } from './AnimatedCubeLogo'
import { cn } from '@/lib/cn'

/** Small inline waiting indicator for a REAL wait (model call, scoring). Full-screen intro is
 *  BootGate's job and only runs on cold start -- never use this for ordinary route changes. */
export function CubeLoader({ label, className, size = 40 }: { label: string; className?: string; size?: number }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col items-center gap-5 py-10 text-center', className)}>
      <div className="pb-4">
        <AnimatedCubeLogo size={size} bare />
      </div>
      <p className="text-sm text-muted">{label}</p>
    </div>
  )
}
