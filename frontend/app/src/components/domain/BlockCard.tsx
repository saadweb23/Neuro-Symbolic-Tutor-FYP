import type { ReactNode } from 'react'
import { useMetaConfig, useTierFor } from '@/app/providers/MetaProvider'
import type { BlockProgress } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { BLOCK_ICONS } from '@/constants/blocks'
import { cn } from '@/lib/cn'
import { BLOCK_COLORS, TIER_STYLES, pct } from '@/lib/tiers'

export type BlockStatus = 'not_started' | 'in_progress' | 'complete'

export function blockStatus(block: BlockProgress, opts: { attempted: number; active: boolean }): BlockStatus {
  if (block.complete) return 'complete'
  return opts.active || opts.attempted > 0 ? 'in_progress' : 'not_started'
}

const STATUS_BADGE: Record<BlockStatus, { label: string; tone: 'good' | 'primary' | 'neutral' }> = {
  complete: { label: 'Complete', tone: 'good' },
  in_progress: { label: 'In progress', tone: 'primary' },
  not_started: { label: 'Not started', tone: 'neutral' },
}

interface Props {
  block: BlockProgress
  status: BlockStatus
  /** per-concept beliefs, to list the concepts with a mini bar (omit for the compact variant) */
  beliefs?: Record<string, number>
  suggested?: boolean
  active?: boolean
  compact?: boolean
  footer?: ReactNode
  className?: string
}

/** A curriculum block: status, average against the target, weakest concept, and an action slot. */
export function BlockCard({ block, status, beliefs, suggested, active, compact, footer, className }: Props) {
  const { mastery_threshold } = useMetaConfig()
  const tierFor = useTierFor()
  const Icon = BLOCK_ICONS[block.index] ?? BLOCK_ICONS[0]!
  const badge = STATUS_BADGE[status]
  const tier = TIER_STYLES[tierFor(block.average_mastery)]
  return (
    <div className={cn('flex flex-col rounded-lg border bg-surface p-5 shadow-card', active ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: BLOCK_COLORS[block.index] }}>
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{block.name}</h3>
            <p className="text-xs text-muted">Block {block.index + 1} of 5</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {suggested && <Badge tone="accent">Suggested</Badge>}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-semibold tabular-nums">{pct(block.average_mastery)} average</span>
          <span className="text-xs text-muted">target {pct(mastery_threshold)}</span>
        </div>
        <ProgressBar value={block.average_mastery} target={mastery_threshold} barClassName={tier.solid} label={`${block.name} average mastery`} />
        <p className="mt-2 text-xs text-muted">
          Weakest: <span className="font-medium text-text">{block.weakest_concept}</span> ({pct(block.weakest_belief)})
        </p>
      </div>

      {!compact && beliefs && (
        <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
          {block.concepts.map((c) => {
            const b = beliefs[c] ?? 0
            return (
              <li key={c} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-muted sm:w-44">{c}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised" aria-hidden>
                  <div className={cn('h-full rounded-full', TIER_STYLES[tierFor(b)].solid)} style={{ width: `${Math.min(100, b * 100)}%` }} />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-muted">{pct(b)}</span>
              </li>
            )
          })}
        </ul>
      )}
      {footer && <div className="mt-auto pt-4">{footer}</div>}
    </div>
  )
}
