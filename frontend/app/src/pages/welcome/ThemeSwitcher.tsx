import { motion } from 'motion/react'
import { useRef, type KeyboardEvent } from 'react'
import { THEMES, type WelcomeTheme } from './useWelcomeTheme'

/** Compact three-way theme control (radio group, arrow keys move between themes). */
export function ThemeSwitcher({ theme, onChange }: { theme: WelcomeTheme; onChange: (t: WelcomeTheme) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (i + (e.key === 'ArrowRight' ? 1 : THEMES.length - 1)) % THEMES.length
    onChange(THEMES[next]!.id)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label="Theme" className="nt-themes">
      {THEMES.map((t, i) => {
        const on = t.id === theme
        return (
          <button
            key={t.id} ref={(el) => { refs.current[i] = el }} type="button" role="radio" aria-checked={on} aria-label={t.label} title={t.label}
            tabIndex={on ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}
          >
            {on && <motion.span layoutId="welcome-theme-dot" className="nt-theme-dot" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <t.icon className="relative size-[18px]" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
