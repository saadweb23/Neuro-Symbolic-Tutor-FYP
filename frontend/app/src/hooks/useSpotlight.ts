import { useEffect } from 'react'

/** Cursor-follow glow for every `[data-spotlight]` element (see `.nt-card` in index.css).
 *  ONE delegated, rAF-throttled pointermove listener writes two CSS variables on the hovered card;
 *  no React state, so moving the mouse never re-renders anything. Fine pointers only. */
export function useSpotlight() {
  useEffect(() => {
    if (!globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
    let frame = 0
    let last: PointerEvent | null = null
    const paint = () => {
      frame = 0
      const e = last
      if (!e) return
      const card = (e.target as Element | null)?.closest?.<HTMLElement>('[data-spotlight]')
      if (!card) return
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${e.clientX - r.left}px`)
      card.style.setProperty('--my', `${e.clientY - r.top}px`)
    }
    const onMove = (e: PointerEvent) => {
      last = e
      if (!frame) frame = requestAnimationFrame(paint)
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
}
