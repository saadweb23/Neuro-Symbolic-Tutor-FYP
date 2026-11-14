import { motion, useReducedMotion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'

const container = (gap: number, delay: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
})
const item: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

/** Children marked <StaggerItem> rise in one after another. `inView` waits for scroll; otherwise it
 *  plays on mount. Static for reduced-motion users. */
export function Stagger({ children, className, gap = 0.07, delay = 0, inView = false }: {
  children: ReactNode; className?: string; gap?: number; delay?: number; inView?: boolean
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={container(gap, delay)}
      initial="hidden"
      {...(inView ? { whileInView: 'show', viewport: { once: true, margin: '-50px' } } : { animate: 'show' })}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return <motion.div className={className} variants={item}>{children}</motion.div>
}
