import { cn } from '@/lib/cn'

interface Props {
  /** 0..1 */ value: number
  /** optional 0..1 marker, e.g. the mastery target */ target?: number
  className?: string
  barClassName?: string
  label?: string
}

export function ProgressBar({ value, target, className, barClassName, label }: Props) {
  const v = Math.min(1, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-raised', className)}
    >
      <div className={cn('h-full rounded-full bg-primary transition-[width] duration-500', barClassName)} style={{ width: `${v * 100}%` }} />
      {target !== undefined && (
        <div className="absolute inset-y-0 w-0.5 bg-text/60" style={{ left: `${Math.min(1, Math.max(0, target)) * 100}%` }} aria-hidden />
      )}
    </div>
  )
}
