import type { ReactNode } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useChartMotion } from '@/hooks/useChartMotion'
import { TIP } from '@/lib/chartTheme'

export interface DonutSlice {
  name: string
  value: number
  color: string
}

/** Donut with a centre label. `unit` is used in the tooltip ("3 concepts"). */
export function DonutChart({ data, size = 160, center, unit = '', label }: {
  data: DonutSlice[]
  size?: number
  center?: ReactNode
  unit?: string
  label: string
}) {
  const motion = useChartMotion()
  const total = data.reduce((a, d) => a + d.value, 0)
  const shown = total === 0 ? [{ name: 'No data', value: 1, color: 'var(--raised)' }] : data
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={shown} dataKey="value" innerRadius="66%" outerRadius="100%" paddingAngle={total === 0 ? 0 : 2} stroke="none" startAngle={90} endAngle={-270} {...motion}>
            {shown.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          {total > 0 && <Tooltip {...TIP} formatter={(v, n) => [`${v}${unit}`, n]} />}
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">{center}</div>}
    </div>
  )
}
