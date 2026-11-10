import { tierFor, TIER_CLASSES } from "../tiers";

export default function ConceptGrid({ beliefs, highlightConcept }) {
  const entries = Object.entries(beliefs);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {entries.map(([concept, belief]) => {
        const tier = tierFor(belief);
        const isHighlighted = concept === highlightConcept;
        return (
          <div
            key={concept}
            className={`rounded-lg border-2 p-3 text-center transition ${TIER_CLASSES[tier]} ${
              isHighlighted ? "ring-4 ring-blue-400 animate-pulse" : ""
            }`}
          >
            <p className="font-semibold text-sm leading-tight">{concept}</p>
            <p className="text-xs mt-1 opacity-80">{Math.round(belief * 100)}%</p>
          </div>
        );
      })}
    </div>
  );
}
