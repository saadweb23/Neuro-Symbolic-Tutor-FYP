import type { ConceptDetail, Graph } from '@/api/types'

export type NodeState = 'completed' | 'current' | 'upcoming' | 'locked'
export type Difficulty = 'Foundation' | 'Core' | 'Advanced'

export interface RoadmapNode {
  id: number
  concept: string
  blockIndex: number
  depth: number
  difficulty: Difficulty
  state: NodeState
  belief: number
  attempts: number
  prerequisites: string[]
  /** prerequisites whose estimate is below the concept floor (why a node is "locked") */
  blockedBy: string[]
}

/** Difficulty is a property of the prerequisite graph, not an opinion: how many concepts must be
 *  understood first. Depth 0-1 are foundations, then core, then the deepest third is advanced. */
export function difficultyOf(depth: number, maxDepth: number): Difficulty {
  if (depth <= 1) return 'Foundation'
  return depth >= Math.max(3, Math.ceil(maxDepth * 0.7)) ? 'Advanced' : 'Core'
}

interface Input {
  graph: Pick<Graph, 'nodes'>
  concepts: ConceptDetail[]
  /** mastery target (from /meta) */
  threshold: number
  /** minimum per-concept estimate (from /meta) */
  floor: number
  /** the concept the tutoring agent currently prefers, if any */
  current?: string | null
}

/** Derives each concept's journey state from the student's own records:
 *  completed = answered at least once and at/above the mastery target;
 *  current   = what the tutoring agent would pick next;
 *  locked    = a prerequisite is still below the concept floor (a recommendation to strengthen it
 *              first; the app does not forbid starting it);
 *  upcoming  = everything else. */
export function buildRoadmap({ graph, concepts, threshold, floor, current }: Input): RoadmapNode[] {
  const byName = new Map(concepts.map((c) => [c.concept, c]))
  const maxDepth = Math.max(0, ...graph.nodes.map((n) => n.depth))
  return [...graph.nodes]
    .sort((a, b) => a.id - b.id)
    .flatMap((n): RoadmapNode[] => {
      const d = byName.get(n.concept)
      if (!d) return []
      const blockedBy = d.prerequisites.filter((p) => (byName.get(p)?.belief ?? 0) < floor)
      const completed = d.attempts > 0 && d.belief >= threshold
      const state: NodeState = completed ? 'completed' : current === n.concept ? 'current' : blockedBy.length > 0 ? 'locked' : 'upcoming'
      return [{
        id: n.id, concept: n.concept, blockIndex: n.block_index, depth: n.depth, difficulty: difficultyOf(n.depth, maxDepth),
        state, belief: d.belief, attempts: d.attempts, prerequisites: d.prerequisites, blockedBy,
      }]
    })
}

export const journeyCompletion = (nodes: RoadmapNode[]) =>
  nodes.length ? nodes.filter((n) => n.state === 'completed').length / nodes.length : 0
