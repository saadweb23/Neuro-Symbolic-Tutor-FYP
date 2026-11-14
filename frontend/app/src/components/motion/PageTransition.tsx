import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/** Enter animation for a routed page: re-mounted by `routeKey`, so every navigation fades and
 *  slides the new page in (no exit phase, so navigation is never delayed). */
export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div key={routeKey} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  )
}
