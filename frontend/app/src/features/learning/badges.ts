import type { BlockProgress, ConceptDetail, StudentStatus, Summary } from '@/api/types'

export interface Badge {
  id: string
  title: string
  description: string
  earned: boolean
  /** progress toward the goal, for badges not yet earned */
  current: number
  target: number
}

interface Input {
  summary?: Summary
  status?: StudentStatus
  blocks?: BlockProgress[]
  concepts?: ConceptDetail[]
  threshold: number
}

const badge = (id: string, title: string, description: string, current: number, target: number): Badge =>
  ({ id, title, description, current: Math.min(current, target), target, earned: current >= target })

/** Achievements are computed on the fly from the student's own records; nothing is stored or
 *  awarded by hand. Every badge states exactly what earns it. */
export function buildBadges({ summary, status, blocks, concepts, threshold }: Input): Badge[] {
  const answered = summary?.answered_questions ?? 0
  const streak = Math.max(summary?.longest_streak_days ?? 0, summary?.current_streak_days ?? 0)
  const mastered = concepts?.filter((c) => c.attempts > 0 && c.belief >= threshold).length ?? 0
  const blocksDone = blocks?.filter((b) => b.complete).length ?? 0
  const accuracyOk = answered >= 20 && (summary?.accuracy ?? 0) >= 0.8
  return [
    badge('placed', 'First steps', 'Finish the placement quiz', status?.placement_completed ? 1 : 0, 1),
    badge('answers-10', 'Getting going', 'Answer 10 questions', answered, 10),
    badge('answers-50', 'Problem solver', 'Answer 50 questions', answered, 50),
    badge('streak-3', 'On a roll', 'Learn on 3 days in a row', streak, 3),
    badge('streak-7', 'Week warrior', 'Learn on 7 days in a row', streak, 7),
    badge('mastered-5', 'Concept collector', 'Master 5 concepts', mastered, 5),
    badge('block-1', 'Block complete', 'Complete a learning block', blocksDone, 1),
    badge('sharp', 'Sharp shooter', 'Keep 80% accuracy over at least 20 answers', accuracyOk ? 1 : 0, 1),
    badge('curriculum', 'Curriculum champion', 'Complete every learning block', blocksDone, blocks?.length ?? 5),
  ]
}
