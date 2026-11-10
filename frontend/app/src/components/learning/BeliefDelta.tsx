import { motion, useReducedMotion } from 'motion/react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { pct } from '@/lib/tiers'

/** Estimated mastery before -> after an interaction, as text and an arrow (not colour alone). */
export function BeliefDelta({ concept, before, after, className }: { concept?: string; before: number; after: number; className?: string }) {
  const reduce = useReducedMotion()
  const delta = Math.round(after * 100) - Math.round(before * 100)
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const tone = delta > 0 ? 'text-good' : delta < 0 ? 'text-bad' : 'text-muted'
  return (
    <motion.p
      role="status"
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('flex flex-wrap items-center gap-2 text-sm font-semibold', className)}
    >
      <Icon className={cn('size-4', tone)} aria-hidden />
      <span>{concept ? `${concept} mastery estimate:` : 'Mastery estimate:'}</span>
      <span className="tabular-nums">{pct(before)} → {pct(after)}</span>
      <span className={cn('tabular-nums', tone)}>({delta > 0 ? '+' : ''}{delta}%)</span>
    </motion.p>
  )
}
