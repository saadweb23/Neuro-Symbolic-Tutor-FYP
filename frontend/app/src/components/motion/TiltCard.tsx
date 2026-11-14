import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import type { ReactNode } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'

/** Subtle 3D tilt toward the cursor (max ~6deg) for selected, high-value cards. Transform only. */
export function TiltCard({ children, className, max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)')
  const reduce = useReducedMotion()
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const spring = { stiffness: 200, damping: 20, mass: 0.5 }
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), spring)
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), spring)
  if (!fine || reduce) return <div className={className}>{children}</div>
  return (
    <div className={cn('[perspective:900px]', className)}>
      <motion.div
        className="h-full"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          px.set((e.clientX - r.left) / r.width)
          py.set((e.clientY - r.top) / r.height)
        }}
        onPointerLeave={() => { px.set(0.5); py.set(0.5) }}
      >
        {children}
      </motion.div>
    </div>
  )
}
