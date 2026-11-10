// Thresholds mirror question_generator.difficulty_for_belief on the backend
// (easy < 0.4, medium 0.4-0.7, hard >= 0.7) so "weak/developing/mastered"
// here means exactly what drives real difficulty selection server-side.
export function tierFor(belief) {
  if (belief >= 0.7) return "mastered";
  if (belief >= 0.4) return "developing";
  return "weak";
}

export const TIER_CLASSES = {
  mastered: "bg-emerald-100 text-emerald-800 border-emerald-500",
  developing: "bg-yellow-100 text-yellow-800 border-yellow-500 border-dashed",
  weak: "bg-red-100 text-red-800 border-red-500",
};

export const TIER_BAR_CLASSES = {
  mastered: "bg-emerald-500",
  developing: "bg-yellow-400",
  weak: "bg-red-500",
};
