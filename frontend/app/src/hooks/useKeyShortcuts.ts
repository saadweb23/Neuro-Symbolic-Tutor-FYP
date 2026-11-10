import { useEffect, useRef } from 'react'
import { usePreferences } from '@/app/providers/PreferencesProvider'

type Handlers = Record<string, () => void>

/** Registers single-key shortcuts ("1".."4", "Enter", "?") unless the user disabled shortcuts in
 *  Settings or is typing in a field. Handlers can change every render without re-subscribing. */
export function useKeyShortcuts(handlers: Handlers, active = true) {
  const { shortcuts } = usePreferences()
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })
  useEffect(() => {
    if (!shortcuts || !active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const fn = ref.current[e.key]
      if (fn) {
        // Enter on a focused button/link must keep its native behaviour.
        if (e.key === 'Enter' && t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts, active])
}
