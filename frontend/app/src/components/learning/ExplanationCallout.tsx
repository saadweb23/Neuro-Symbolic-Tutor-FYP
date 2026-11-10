import { Lightbulb } from 'lucide-react'

/** The "Why this?" glass box: the reasoning behind a recommendation (e.g. a weak prerequisite it
 *  traces back to). Deliberately the most prominent element of a step. */
export function ExplanationCallout({ text, label = 'Why this?' }: { text: string; label?: string }) {
  return (
    <aside aria-label={label} className="rounded-lg border border-accent/30 bg-accent-soft p-4">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent">
        <Lightbulb className="size-3.5" aria-hidden /> {label}
      </p>
      <p className="leading-relaxed">{text}</p>
    </aside>
  )
}
