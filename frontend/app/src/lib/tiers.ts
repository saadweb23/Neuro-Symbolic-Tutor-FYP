import { CheckCircle2, CircleDashed, AlertCircle, type LucideIcon } from 'lucide-react'
import type { MetaConfig } from '@/api/types'

export type Tier = 'mastered' | 'developing' | 'weak'

/** Tier cut-offs come from GET /meta (the same numbers the backend uses to pick question
 *  difficulty), never from constants in the UI. */
export function tierFor(belief: number, cutoffs: MetaConfig['difficulty_cutoffs']): Tier {
  if (belief >= cutoffs.medium_below) return 'mastered'
  if (belief >= cutoffs.easy_below) return 'developing'
  return 'weak'
}

interface TierStyle {
  label: string
  icon: LucideIcon
  /** text colour */ text: string
  /** soft background */ soft: string
  /** solid fill (bars, dots) */ solid: string
  /** outline treatment: dashed for "developing" so tier is not colour-only */ border: string
}

export const TIER_STYLES: Record<Tier, TierStyle> = {
  mastered: { label: 'Mastered', icon: CheckCircle2, text: 'text-good', soft: 'bg-good-soft', solid: 'bg-good', border: 'border-good/40' },
  developing: { label: 'Developing', icon: CircleDashed, text: 'text-mid', soft: 'bg-mid-soft', solid: 'bg-mid', border: 'border-mid/50 border-dashed' },
  weak: { label: 'Needs work', icon: AlertCircle, text: 'text-bad', soft: 'bg-bad-soft', solid: 'bg-bad', border: 'border-bad/40' },
}

export const pct = (v: number) => `${Math.round(v * 100)}%`

export const BLOCK_COLORS = ['var(--block-0)', 'var(--block-1)', 'var(--block-2)', 'var(--block-3)', 'var(--block-4)']
