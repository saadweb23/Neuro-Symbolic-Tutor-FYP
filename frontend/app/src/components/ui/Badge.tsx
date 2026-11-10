import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'primary' | 'good' | 'mid' | 'bad' | 'accent'
const TONES: Record<Tone, string> = {
  neutral: 'bg-raised text-muted',
  primary: 'bg-primary-soft text-primary',
  good: 'bg-good-soft text-good',
  mid: 'bg-mid-soft text-mid',
  bad: 'bg-bad-soft text-bad',
  accent: 'bg-accent-soft text-accent',
}

export function Badge({ tone = 'neutral', className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}
      {...rest}
    />
  )
}
