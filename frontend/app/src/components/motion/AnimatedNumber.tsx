import { animate, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

interface Props {
  value: number
  /** formats the (possibly fractional) in-flight value, e.g. (n) => `${Math.round(n)}%` */
  format?: (n: number) => string
  duration?: number
  className?: string
}

/** Counts up from 0 to `value` the first time it scrolls into view, and tweens between later values.
 *  The element always holds the real value as text first, so tests, screen readers and
 *  reduced-motion users see the right number immediately; the count-up only decorates it. */
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), duration = 0.9, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useRef(false)
  const from = useRef(0)
  const reduce = useReducedMotion()
  const inView = useInView(ref, { once: true, margin: '-40px' })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce || !inView) {
      el.textContent = format(value)
      from.current = value
      return
    }
    const start = seen.current ? from.current : 0
    seen.current = true
    const controls = animate(start, value, {
      duration: seen.current && start !== 0 ? 0.5 : duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => { el.textContent = format(n); from.current = n },
      onComplete: () => { el.textContent = format(value); from.current = value },
    })
    return () => controls.stop()
    // `format` is intentionally excluded: callers pass inline arrows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView, reduce, duration])

  return <span ref={ref} className={className}>{format(value)}</span>
}
