import { motion, useScroll, useSpring } from 'motion/react'

/** Thin brand-gradient bar at the very top showing how far the page is scrolled. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 })
  return <motion.div aria-hidden className="nt-scroll-progress fixed inset-x-0 top-0 z-[59] h-[3px]" style={{ scaleX }} />
}
