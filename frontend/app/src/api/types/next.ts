/**
 * Hand-written contract for the EXISTING endpoints whose shapes are owned by the learning
 * engine (backend/serving/content_engine.py). They are deliberately not generated: the
 * backend returns plain dicts for them, and their shapes must stay exactly as they are.
 * The newer insight endpoints are typed from the OpenAPI schema (generated.ts).
 */
export interface BlockInfo {
  index: number
  name: string
  average_mastery: number
  round_count: number
  round_cap: number
}

export interface VideoContent {
  id: string
  title: string
  url: string
  source: string
}

export interface McqContent {
  id: string
  type: 'mcq'
  question: string
  choices: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  source: string
}

interface StepBase {
  explanation: string
  mastery_belief: number
}

export interface VideoStep extends StepBase {
  concept: string
  content_type: 'video'
  content: VideoContent
  attempt_number: number
  block: BlockInfo
}
export interface EscalationStep extends StepBase {
  concept: string
  content_type: 'escalation'
  content: VideoContent
  attempt_number: number
  block: BlockInfo
}
export interface PracticeStep extends StepBase {
  concept: string
  content_type: 'practice_problem'
  content: McqContent
  attempt_number: number
  block: BlockInfo
}
export interface CompleteStep extends StepBase {
  concept: null
  content_type: 'complete'
  content: { average_mastery: number; weakest_concepts: { concept: string; belief: number }[] }
}
export interface NoSessionStep extends StepBase {
  concept: null
  content_type: 'no_session'
  content: null
}
export interface BlockCompleteStep extends StepBase {
  concept: null
  content_type: 'block_complete'
  content: {
    block_index: number
    block_name: string
    average_mastery: number
    weakest_concept: string
    weakest_belief: number
  }
}
export interface SessionPausedStep extends StepBase {
  concept: null
  content_type: 'session_paused'
  content: {
    block_index: number
    block_name: string
    average_mastery: number
    weakest_concept: string
    weakest_belief: number
    round_count: number
    round_cap: number
  }
}

export type NextStep =
  | VideoStep
  | EscalationStep
  | PracticeStep
  | CompleteStep
  | NoSessionStep
  | BlockCompleteStep
  | SessionPausedStep

/** Steps that ask the student to do something (vs. terminal / routing states). */
export type ActiveStep = VideoStep | EscalationStep | PracticeStep
export const isActiveStep = (s: NextStep): s is ActiveStep =>
  s.content_type === 'video' || s.content_type === 'escalation' || s.content_type === 'practice_problem'

export interface PlacementQuestion {
  content_id: string
  concept: string
  question: string
  choices: string[]
}
export interface PlacementAnswer {
  content_id: string
  selected_index: number
  time_taken: number
}

export interface McqResult {
  concept: string
  passed: boolean
  correct_index: number
  explanation: string
  updated_belief: number
}
export interface ViewedResult {
  concept: string
  updated_belief: number
}

export interface BlockProgress {
  index: number
  name: string
  concepts: string[]
  average_mastery: number
  weakest_concept: string
  weakest_belief: number
  complete: boolean
}

export type SessionState =
  | { active: false }
  | { active: true; block_index: number; round_count: number; round_cap: number }

export type Beliefs = Record<string, number>
