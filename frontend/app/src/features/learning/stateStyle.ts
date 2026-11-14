import { CheckCircle2, Circle, Lock, Play, type LucideIcon } from 'lucide-react'
import type { NodeState } from './roadmap'

interface StateStyle {
  label: string
  icon: LucideIcon
  /** SVG colours (CSS variables) */
  stroke: string
  fill: string
  /** Tailwind chip classes */
  chip: string
  text: string
}

/** One colour per journey state, used by every roadmap element so the legend is learnt once. */
export const STATE_STYLE: Record<NodeState, StateStyle> = {
  completed: { label: 'Completed', icon: CheckCircle2, stroke: 'var(--good)', fill: 'var(--good-soft)', chip: 'bg-good-soft text-good', text: 'text-good' },
  current: { label: 'Current', icon: Play, stroke: 'var(--primary)', fill: 'var(--primary-soft)', chip: 'bg-primary-soft text-primary', text: 'text-primary' },
  upcoming: { label: 'Upcoming', icon: Circle, stroke: 'var(--accent)', fill: 'var(--surface)', chip: 'bg-accent-soft text-accent', text: 'text-accent' },
  locked: { label: 'Locked', icon: Lock, stroke: 'var(--border-strong)', fill: 'var(--raised)', chip: 'bg-raised text-muted', text: 'text-muted' },
}
