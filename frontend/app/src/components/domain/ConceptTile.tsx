import { useTierFor } from '@/app/providers/MetaProvider'
import { TIER_STYLES, pct } from '@/lib/tiers'
import { cn } from '@/lib/cn'

interface Props {
  concept: string
  belief: number
  attempts?: number
  selected?: boolean
  dimmed?: boolean
  onClick?: () => void
}

/** One concept: name, estimated mastery, tier (icon + label) and, when known, how many questions back it up. */
export function ConceptTile({ concept, belief, attempts, selected, dimmed, onClick }: Props) {
  const tier = useTierFor()(belief)
  const s = TIER_STYLES[tier]
  const Icon = s.icon
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight">{concept}</span>
        <Icon className={cn('size-4 shrink-0', s.text)} aria-hidden />
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums">{pct(belief)}</span>
        <span className={cn('text-xs font-medium', s.text)}>{s.label}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden>
        <div className={cn('h-full rounded-full', s.solid)} style={{ width: `${Math.min(100, belief * 100)}%` }} />
      </div>
      {attempts !== undefined && (
        <p className="mt-2 text-xs text-muted">{attempts === 0 ? 'No answers yet' : `${attempts} answer${attempts === 1 ? '' : 's'}`}</p>
      )}
    </>
  )
  const cls = cn(
    'block w-full rounded-lg border bg-surface p-3.5 text-left transition',
    s.border,
    selected && 'ring-2 ring-primary',
    dimmed && 'opacity-40',
    onClick && 'hover:shadow-raised',
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} aria-label={`${concept}: ${pct(belief)}, ${s.label}`} aria-pressed={selected}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}
