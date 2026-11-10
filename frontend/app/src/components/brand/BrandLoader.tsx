import { BrandMark } from './BrandMark'
import { cn } from '@/lib/cn'

/** Small inline waiting indicator for a REAL wait (model call, scoring). The full-screen intro is
 *  BootGate's job and only runs on cold start: never use this for ordinary route changes. */
export function BrandLoader({ label, className, size = 40 }: { label: string; className?: string; size?: number }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col items-center gap-4 py-10 text-center', className)}>
      <BrandMark size={size} motion="pulse" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  )
}
