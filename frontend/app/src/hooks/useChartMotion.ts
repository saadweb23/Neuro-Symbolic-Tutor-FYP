import { useReducedMotion } from 'motion/react'

/** Recharts animation props that honour reduced motion (spread onto <Line>, <Bar>, <Pie>). */
export function useChartMotion() {
  const reduce = useReducedMotion()
  return { isAnimationActive: !reduce, animationDuration: 900, animationEasing: 'ease-out' as const }
}
