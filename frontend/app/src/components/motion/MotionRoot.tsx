import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { usePreferences } from '@/app/providers/PreferencesProvider'

/** One switch for every motion component: the OS setting ("user") or Settings > Reduce motion ("always"). */
export function MotionRoot({ children }: { children: ReactNode }) {
  const { reduceMotion } = usePreferences()
  return <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>
}
