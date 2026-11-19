import { useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

/** A phrase is a list of segments so part of it can carry the gradient highlight. */
export type Segment = { text: string; highlight?: boolean }
export type Phrase = Segment[]

const flat = (p: Phrase) => p.map((s) => s.text).join('')

/** Renders the first `chars` characters of a phrase, keeping the highlight on the right segments. */
function renderSlice(phrase: Phrase, chars: number) {
  let left = chars
  return phrase.map((seg, i) => {
    if (left <= 0) return null
    const text = seg.text.slice(0, left)
    left -= seg.text.length
    return seg.highlight ? <span key={i} className="nt-gradient-text nt-clone">{text}</span> : <span key={i}>{text}</span>
  })
}

interface Props {
  phrases: Phrase[]
  typeMs?: number
  deleteMs?: number
  holdMs?: number
  gapMs?: number
  className?: string
}

/** Types a phrase character by character, holds it, deletes it, then moves to the next, with a blinking
 *  caret. Layout never jumps: an invisible copy of the longest phrase reserves the space, and the typed
 *  text is overlaid on it. Reduced motion shows the first phrase, still. Purely visual: wrap it in an
 *  element that carries the real accessible text (the page's <h1> does). */
export function Typewriter({ phrases, typeMs = 52, deleteMs = 26, holdMs = 1700, gapMs = 380, className }: Props) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [chars, setChars] = useState(0)
  const [deleting, setDeleting] = useState(false)

  const phrase = phrases[index % phrases.length]!
  const length = flat(phrase).length
  const longest = phrases.reduce((a, b) => (flat(b).length > flat(a).length ? b : a))

  useEffect(() => {
    if (reduce) return
    let delay: number
    if (!deleting && chars < length) delay = typeMs + (Math.random() * 28 - 14)      // slightly uneven, like a person
    else if (!deleting) delay = holdMs                                                // full phrase on screen
    else if (chars > 0) delay = deleteMs
    else delay = gapMs                                                                 // empty: breathe, then next phrase
    const id = window.setTimeout(() => {
      if (!deleting && chars < length) setChars(chars + 1)
      else if (!deleting) setDeleting(true)
      else if (chars > 0) setChars(chars - 1)
      else { setDeleting(false); setIndex((i) => (i + 1) % phrases.length) }
    }, delay)
    return () => window.clearTimeout(id)
  }, [reduce, chars, deleting, length, typeMs, deleteMs, holdMs, gapMs, phrases.length])

  const shown = reduce ? length : chars
  const typing = !reduce && !deleting && chars < length

  return (
    <span className={cn('relative block', className)} aria-hidden>
      {/* reserves the height / width of the longest phrase so nothing below ever moves */}
      <span className="invisible block">{renderSlice(longest, flat(longest).length)}</span>
      <span className="absolute inset-0 block">
        {renderSlice(phrase, shown)}
        <span className={cn('nt-caret', typing && 'nt-caret-solid')} />
      </span>
    </span>
  )
}
