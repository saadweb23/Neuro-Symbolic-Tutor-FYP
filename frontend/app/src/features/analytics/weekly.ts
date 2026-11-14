import type { Analytics } from '@/api/types'

export interface DayBucket {
  date: string
  label: string
  answered: number
  lessons: number
  minutes: number
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The last `n` calendar days ending today (local), each filled from the activity records.
 *  A day with no record is genuinely 0: nothing was answered or viewed. */
export function lastDays(activity: Analytics['activity'], n = 7, today: Date = new Date()): DayBucket[] {
  const byDate = new Map(activity.map((a) => [a.date, a]))
  const out: DayBucket[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const a = byDate.get(iso(d))
    out.push({
      date: iso(d),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      answered: a?.answered ?? 0,
      lessons: (a?.videos ?? 0) + (a?.deep_dives ?? 0),
      minutes: Math.round(((a?.answering_seconds ?? 0) / 60) * 10) / 10,
    })
  }
  return out
}

/** One number per day for the consistency calendar: everything the student did that day. */
export const activityHeat = (activity: Analytics['activity']) =>
  activity.map((a) => ({ date: a.date, value: a.answered + a.videos + a.deep_dives }))
