import { motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { cn } from '@/lib/cn'

export interface HeatDay {
  /** local calendar date, YYYY-MM-DD */
  date: string
  value: number
}

const LEVELS = ['bg-raised', 'bg-primary/20', 'bg-primary/40', 'bg-primary/65', 'bg-primary']
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** GitHub-style consistency calendar: one cell per day for the last `weeks` weeks, shaded by activity.
 *  Days with no record are shown as empty (never invented). */
export function CalendarHeatmap({ days, weeks = 14, unit = 'answers', today }: { days: HeatDay[]; weeks?: number; unit?: string; today?: Date }) {
  const reduce = useReducedMotion()
  const { columns, max, active } = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d.value]))
    const now = today ?? new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    // align the last column to the current week (Monday first)
    const lastMonday = new Date(end)
    lastMonday.setDate(end.getDate() - ((end.getDay() + 6) % 7))
    const cols: { date: string; value: number; future: boolean }[][] = []
    let mx = 0
    let act = 0
    for (let w = weeks - 1; w >= 0; w--) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const cell = new Date(lastMonday)
        cell.setDate(lastMonday.getDate() - w * 7 + d)
        const key = iso(cell)
        const value = byDate.get(key) ?? 0
        const future = cell > end
        if (!future) { mx = Math.max(mx, value); if (value > 0) act++ }
        col.push({ date: key, value, future })
      }
      cols.push(col)
    }
    return { columns: cols, max: mx, active: act }
  }, [days, weeks, today])

  const level = (v: number) => (v <= 0 || max === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)))

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="img" aria-label={`Learning consistency: active on ${active} of the last ${weeks * 7} days`}>
        <div className="hidden shrink-0 flex-col justify-between py-0.5 pr-1 text-[10px] leading-3 text-muted sm:flex" aria-hidden>
          {DAY_LABELS.map((l, i) => <span key={i} className="h-4">{l}</span>)}
        </div>
        <div className="flex gap-1">
          {columns.map((col, ci) => (
            <motion.div key={ci} className="flex flex-col gap-1" initial={reduce ? false : { opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: ci * 0.025, duration: 0.35 }}>
              {col.map((c) => (
                <span
                  key={c.date}
                  title={c.future ? undefined : `${c.date}: ${c.value} ${unit}`}
                  className={cn('size-4 rounded-[5px] transition-transform hover:scale-125', c.future ? 'opacity-0' : LEVELS[level(c.value)])}
                />
              ))}
            </motion.div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted" aria-hidden>
        Less {LEVELS.map((l) => <span key={l} className={cn('size-3 rounded-[3px]', l)} />)} More
      </div>
    </div>
  )
}
