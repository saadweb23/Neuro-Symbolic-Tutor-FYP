import { GraduationCap, Sparkles, Sun, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { safeStorage, STORAGE_KEYS } from '@/constants/storage'

export type WelcomeTheme = 'neon' | 'education' | 'minimal'

export const THEMES: { id: WelcomeTheme; label: string; icon: LucideIcon; /** classes that scope the design tokens (dark or light base + the theme's own) */ root: string }[] = [
  { id: 'neon', label: 'Original Neon AI', icon: Sparkles, root: 'nt-theme-neon dark' },
  { id: 'education', label: 'Premium Education', icon: GraduationCap, root: 'nt-theme-education dark' },
  { id: 'minimal', label: 'Modern Minimal', icon: Sun, root: 'nt-theme-minimal nt-light' },
]

const read = (): WelcomeTheme => {
  const v = safeStorage.get(STORAGE_KEYS.welcomeTheme)
  return THEMES.some((t) => t.id === v) ? (v as WelcomeTheme) : 'neon'
}

/** The welcome page's visual theme: restored from localStorage on first render (no flash of another theme)
 *  and saved on change. `switching` is true for a moment after a change so colours can glide. */
export function useWelcomeTheme() {
  const [theme, setThemeState] = useState<WelcomeTheme>(read)
  const [switching, setSwitching] = useState(false)
  const timer = useRef<number>(0)

  const setTheme = useCallback((next: WelcomeTheme) => {
    setThemeState((current) => {
      if (current === next) return current
      setSwitching(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setSwitching(false), 800)
      return next
    })
    safeStorage.set(STORAGE_KEYS.welcomeTheme, next)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])
  const root = THEMES.find((t) => t.id === theme)!.root
  return { theme, setTheme, switching, root }
}
