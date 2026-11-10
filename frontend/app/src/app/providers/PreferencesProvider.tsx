import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { safeStorage, STORAGE_KEYS } from '@/constants/storage'

export type ThemePref = 'light' | 'dark' | 'system'

interface Preferences {
  theme: ThemePref
  resolvedTheme: 'light' | 'dark'
  setTheme: (t: ThemePref) => void
  reduceMotion: boolean
  setReduceMotion: (v: boolean) => void
  shortcuts: boolean
  setShortcuts: (v: boolean) => void
}

const Ctx = createContext<Preferences | null>(null)

const systemDark = () => globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => {
    const v = safeStorage.get(STORAGE_KEYS.theme)
    return v === 'light' || v === 'dark' ? v : 'system'
  })
  const [prefersDark, setPrefersDark] = useState(systemDark)
  const [reduceMotion, setReduceMotionState] = useState(() => safeStorage.get(STORAGE_KEYS.reduceMotion) === 'true')
  const [shortcuts, setShortcutsState] = useState(() => safeStorage.get(STORAGE_KEYS.shortcuts) !== 'false')

  useEffect(() => {
    const mq = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = () => setPrefersDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion)
  }, [reduceMotion])

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t)
    safeStorage.set(STORAGE_KEYS.theme, t)
  }, [])
  const setReduceMotion = useCallback((v: boolean) => {
    setReduceMotionState(v)
    safeStorage.set(STORAGE_KEYS.reduceMotion, String(v))
  }, [])
  const setShortcuts = useCallback((v: boolean) => {
    setShortcutsState(v)
    safeStorage.set(STORAGE_KEYS.shortcuts, String(v))
  }, [])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, reduceMotion, setReduceMotion, shortcuts, setShortcuts }),
    [theme, resolvedTheme, setTheme, reduceMotion, setReduceMotion, shortcuts, setShortcuts],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences(): Preferences {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePreferences must be used inside <PreferencesProvider>')
  return v
}
