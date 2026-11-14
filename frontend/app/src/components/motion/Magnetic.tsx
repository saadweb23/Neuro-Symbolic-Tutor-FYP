import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import type { ReactNode } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/** Wraps an important button so it drifts a few pixels toward the cursor (spring-damped) and
 *  settles back on leave. Mouse / trackpad only; a plain wrapper otherwise. */
export function Magnetic({ children, strength = 0.28, className }: { children: ReactNode; strength?: number; className?: string }) {
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)')
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 })
  if (!fine || reduce) return <span className={className}>{children}</span>
  return (
    <motion.span
      className={className}
      style={{ x: sx, y: sy, display: 'inline-flex' }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - (r.left + r.width / 2)) * strength)
        y.set((e.clientY - (r.top + r.height / 2)) * strength)
      }}
      onPointerLeave={() => { x.set(0); y.set(0) }}
    >
      {children}
    </motion.span>
  )
}
