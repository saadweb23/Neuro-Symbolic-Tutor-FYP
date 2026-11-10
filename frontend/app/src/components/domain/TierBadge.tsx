import { useTierFor } from '@/app/providers/MetaProvider'
import { TIER_STYLES, pct } from '@/lib/tiers'
import { cn } from '@/lib/cn'

/** A mastery tier as icon + label (never colour alone), optionally with the percentage. */
export function TierBadge({ belief, showValue = false, className }: { belief: number; showValue?: boolean; className?: string }) {
  const tier = useTierFor()(belief)
  const s = TIER_STYLES[tier]
  const Icon = s.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', s.soft, s.text, className)}>
      <Icon className="size-3.5" aria-hidden />
      {s.label}
      {showValue && <span className="opacity-80">· {pct(belief)}</span>}
    </span>
  )
}
