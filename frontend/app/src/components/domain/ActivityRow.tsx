import { BookOpenText, CheckCircle2, ClipboardCheck, PlayCircle, XCircle, type LucideIcon } from 'lucide-react'
import type { ContentKind, HistoryItem } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { relativeTime } from '@/lib/format'
import { pct } from '@/lib/tiers'

export const KIND_LABEL: Record<ContentKind, string> = {
  placement: 'Placement question',
  practice: 'Practice question',
  video: 'Video',
  deep_dive: 'Documentation deep-dive',
}
export const KIND_ICON: Record<ContentKind, LucideIcon> = {
  placement: ClipboardCheck,
  practice: ClipboardCheck,
  video: PlayCircle,
  deep_dive: BookOpenText,
}

/** Result as text + icon. Videos and deep-dives are "Viewed": the database stores them as passed, but
 *  nobody passed or failed them, so the API reports `passed: null` and we never call them correct. */
export function ResultBadge({ item }: { item: Pick<HistoryItem, 'passed'> }) {
  if (item.passed === null) return <Badge tone="neutral">Viewed</Badge>
  return item.passed ? (
    <Badge tone="good"><CheckCircle2 className="size-3.5" aria-hidden /> Correct</Badge>
  ) : (
    <Badge tone="bad"><XCircle className="size-3.5" aria-hidden /> Incorrect</Badge>
  )
}

export function ActivityRow({ item, now }: { item: HistoryItem; now?: number }) {
  const Icon = KIND_ICON[item.content_type]
  const delta = item.belief_after - item.belief_before
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-raised text-muted"><Icon className="size-4.5" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.concept}</p>
        <p className="truncate text-xs text-muted">{KIND_LABEL[item.content_type]} · {relativeTime(item.at, now)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <ResultBadge item={item} />
        <span className="text-xs tabular-nums text-muted" title="Estimated mastery of this concept, before to after">
          {pct(item.belief_before)} → {pct(item.belief_after)}{Math.abs(delta) >= 0.005 && <span className={delta > 0 ? ' text-good' : ' text-bad'}> ({delta > 0 ? '+' : ''}{Math.round(delta * 100)})</span>}
        </span>
      </div>
    </div>
  )
}
