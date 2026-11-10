"""Pydantic models for the insight endpoints. They exist so FastAPI publishes a real OpenAPI
schema, from which the frontend generates its TypeScript types (openapi-typescript)."""
from typing import Annotated, Dict, List, Literal, Optional

from fastapi import Path
from pydantic import AfterValidator, BaseModel

# Student ids come straight from the URL. Case-sensitive, 1-64 characters, no slashes or
# control characters (the frontend validates the same rule).
StudentId = Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[^\x00-\x1f/\\]+$")]

MAX_TIME_TAKEN_SECONDS = 3600.0


def _clamp_time(value: float) -> float:
    """Idle tabs produce absurd durations; keep the value in a sane range instead of
    rejecting the answer (the tracker saturates at 180 s anyway)."""
    if value != value:  # NaN
        return 0.0
    return min(max(value, 0.0), MAX_TIME_TAKEN_SECONDS)


TimeTaken = Annotated[float, AfterValidator(_clamp_time)]

ContentKind = Literal["placement", "practice", "video", "deep_dive"]


class DifficultyCutoffs(BaseModel):
    easy_below: float
    medium_below: float


class MetaConfig(BaseModel):
    mastery_threshold: float
    concept_floor: float
    session_round_cap: int
    escalation_threshold: int
    difficulty_cutoffs: DifficultyCutoffs
    placement_concepts: List[str]
    concept_count: int
    block_count: int


class MetaModels(BaseModel):
    tracker: str
    ppo: str


class MetaResponse(BaseModel):
    status: Literal["ok"]
    server_time: str
    models: MetaModels
    config: MetaConfig


class SessionInfo(BaseModel):
    block_index: int
    round_count: int
    round_cap: int


class StatusCounts(BaseModel):
    interactions: int
    answered_questions: int


class StatusResponse(BaseModel):
    student_id: str
    exists: bool
    placement_completed: bool
    placement_completed_at: Optional[str]
    has_active_session: bool
    session: Optional[SessionInfo]
    counts: StatusCounts
    created_at: Optional[str]
    last_active_at: Optional[str]


class SummaryResponse(BaseModel):
    answered_questions: int
    correct_answers: int
    accuracy: Optional[float]
    practice_questions: int
    videos_viewed: int
    deep_dives_read: int
    concepts_attempted: int
    concepts_total: int
    answering_time_seconds: float
    active_days: int
    current_streak_days: int
    longest_streak_days: int
    first_activity_at: Optional[str]
    last_activity_at: Optional[str]


class HistoryItem(BaseModel):
    step_index: int
    at: str
    concept: str
    block_index: int
    content_type: ContentKind
    content_id: Optional[str]
    passed: Optional[bool]
    time_taken: float
    difficulty: Optional[str]
    question_text: Optional[str]
    choices: Optional[List[str]]
    correct_index: Optional[int]
    explanation: Optional[str]
    selected_index: Optional[int]
    belief_before: float
    belief_after: float


class HistoryResponse(BaseModel):
    items: List[HistoryItem]
    next_cursor: Optional[int]
    total: int


class TrajectoryStep(BaseModel):
    step_index: int
    at: str
    concept: str
    content_type: ContentKind
    passed: Optional[bool]
    average: float
    blocks: List[float]
    beliefs: Optional[Dict[str, float]] = None


class TrajectoryInitial(BaseModel):
    average: float
    blocks: List[float]


class TrajectoryResponse(BaseModel):
    model_version: str
    initial: TrajectoryInitial
    steps: List[TrajectoryStep]


class GraphNode(BaseModel):
    id: int
    concept: str
    block_index: int
    depth: int


class GraphEdge(BaseModel):
    source: int
    target: int


class GraphBlock(BaseModel):
    index: int
    name: str
    concepts: List[str]


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    blocks: List[GraphBlock]


class ConceptDetail(BaseModel):
    concept: str
    id: int
    block_index: int
    belief: float
    attempts: int
    correct: int
    accuracy: Optional[float]
    last_attempt_at: Optional[str]
    prerequisites: List[str]
    dependents: List[str]
    weakest_prerequisite: Optional[str]


class ConceptsResponse(BaseModel):
    concepts: List[ConceptDetail]


class ResourceLink(BaseModel):
    id: str
    title: str
    url: str
    source: str
    seen: bool


class ResourceItem(BaseModel):
    concept: str
    block_index: int
    video: ResourceLink
    deep_dive: ResourceLink
    shares_video_with: List[str]
    shares_deep_dive_with: List[str]


class ResourcesResponse(BaseModel):
    items: List[ResourceItem]


class RecommendationBlock(BaseModel):
    index: int
    name: str
    average_mastery: float
    round_count: int
    round_cap: int


class RecommendationCandidate(BaseModel):
    concept: str
    probability: float
    belief: float
    attempts: int
    predicted_content_type: Literal["video", "practice_problem", "escalation"]
    explanation: str


class RecommendationResponse(BaseModel):
    state: Literal["ready", "block_complete", "session_paused", "complete"]
    session_active: bool
    block_index: Optional[int]
    block_name: Optional[str]
    suggested: bool
    block: Optional[RecommendationBlock]
    candidates: List[RecommendationCandidate]
    note: str


class ActivityDay(BaseModel):
    date: str
    answered: int
    correct: int
    videos: int
    deep_dives: int
    answering_seconds: float


class BlockPerformance(BaseModel):
    index: int
    name: str
    answered: int
    correct: int
    accuracy: Optional[float]
    current_average: float


class ConceptImprovement(BaseModel):
    concept: str
    block_index: int
    attempts: int
    accuracy: float
    first_belief: float
    current_belief: float
    delta: float


class ContentMix(BaseModel):
    practice: int
    placement: int
    video: int
    deep_dive: int


class DifficultyBucket(BaseModel):
    answered: int
    correct: int


class DifficultyBreakdown(BaseModel):
    placement: DifficultyBucket
    easy: DifficultyBucket
    medium: DifficultyBucket
    hard: DifficultyBucket


class AccuracyPoint(BaseModel):
    step_index: int
    answer_number: int
    rolling_accuracy: float


class AnalyticsWindow(BaseModel):
    days: Optional[int]
    accuracy_window: int


class AnalyticsResponse(BaseModel):
    model_version: str
    window: AnalyticsWindow
    activity: List[ActivityDay]
    blocks: List[BlockPerformance]
    concepts: List[ConceptImprovement]
    content_mix: ContentMix
    difficulty: DifficultyBreakdown
    accuracy_trend: List[AccuracyPoint]
