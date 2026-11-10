// The "glass box" callout -- surfaces the graph-based reasoning behind a
// recommendation (e.g. a weak prerequisite it traces back to), not filler
// text, so it's deliberately the most visually prominent element on screen.
export default function ExplanationCallout({ text, label = "Why this?" }) {
  return (
    <div className="border-l-4 border-yellow-400 bg-yellow-50 rounded-r-lg p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-yellow-700 mb-1">
        {label}
      </p>
      <p className="text-yellow-900 leading-relaxed">{text}</p>
    </div>
  );
}
