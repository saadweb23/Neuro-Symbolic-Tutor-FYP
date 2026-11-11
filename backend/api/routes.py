"""Read-only insight endpoints (plus /meta and /graph). None of these writes to `interactions`,
creates a student, advances a session round or generates a question -- the dashboard and
analytics pages depend on that: GET /next is the ONLY route that consumes a learning round."""
import os
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from api import schemas
from api.schemas import StudentId
from api.deps import authorize_student
from knowledge_graph.graph_builder import CONCEPTS
from serving import catalog, content_engine, inference, insights, persistence, question_generator
from serving.placement_quiz import PLACEMENT_CONCEPTS, load_or_rebuild_state

router = APIRouter()
AUTHZ = Depends(authorize_student)


@router.get("/meta", response_model=schemas.MetaResponse, tags=["meta"])
def meta(request: Request):
    """Server readiness plus the thresholds the UI must display (never hardcode them there)."""
    return {
        "status": "ok",
        "server_time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "models": {
            "tracker": os.path.basename(inference.DEFAULT_CHECKPOINT),
            "ppo": os.path.basename(getattr(request.app.state, "ppo_path", "")) or "unknown",
        },
        "config": {
            "mastery_threshold": content_engine.MASTERY_THRESHOLD,
            "concept_floor": content_engine.MIN_CONCEPT_FLOOR,
            "session_round_cap": content_engine.SESSION_ROUND_CAP_DEFAULT,
            "escalation_threshold": content_engine.ESCALATION_THRESHOLD,
            "difficulty_cutoffs": {
                "easy_below": question_generator.EASY_BELOW,
                "medium_below": question_generator.MEDIUM_BELOW,
            },
            "placement_concepts": PLACEMENT_CONCEPTS,
            "concept_count": len(CONCEPTS),
            "block_count": len(catalog.CONCEPT_BLOCKS),
        },
    }


@router.get("/graph", response_model=schemas.GraphResponse, tags=["curriculum"])
def graph():
    return catalog.graph_payload()


@router.get("/students/{student_id}/status", dependencies=[AUTHZ], response_model=schemas.StatusResponse, tags=["students"])
def status(student_id: StudentId):
    """Unknown ids return 200 with exists=false (not 404) so onboarding can branch on it."""
    return insights.student_status(student_id)


@router.get("/students/{student_id}/summary", dependencies=[AUTHZ], response_model=schemas.SummaryResponse, tags=["students"])
def summary(student_id: StudentId, tz: Optional[str] = Query(None, description="IANA time zone for day bucketing")):
    try:
        return insights.student_summary(student_id, tz)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/students/{student_id}/history", dependencies=[AUTHZ], response_model=schemas.HistoryResponse, tags=["students"])
def history(
    student_id: StudentId,
    limit: int = Query(25, ge=1, le=100),
    cursor: Optional[int] = Query(None, ge=0),
    concept: Optional[str] = None,
    block: Optional[int] = Query(None, ge=0, le=4),
    type: Optional[schemas.ContentKind] = None,
    result: Optional[Literal["passed", "failed"]] = None,
):
    if concept is not None and concept not in CONCEPTS:
        raise HTTPException(status_code=422, detail=f"Unknown concept: {concept}")
    return insights.student_history(student_id, limit=limit, cursor=cursor, concept=concept, block=block,
                                    content_type=type, result=result)


@router.get("/students/{student_id}/mastery/trajectory", dependencies=[AUTHZ], response_model=schemas.TrajectoryResponse,
            response_model_exclude_unset=True, tags=["students"])
def trajectory(
    student_id: StudentId,
    concepts: Optional[str] = Query(None, description="comma-separated concept names"),
    detail: bool = False,
):
    names: List[str] = [c.strip() for c in concepts.split(",") if c.strip()] if concepts else []
    try:
        return insights.mastery_trajectory(student_id, concepts=names, detail=detail)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/students/{student_id}/concepts", dependencies=[AUTHZ], response_model=schemas.ConceptsResponse, tags=["students"])
def concepts(student_id: StudentId):
    tracker, _edge_index, h_t = load_or_rebuild_state(student_id)
    beliefs = inference.get_mastery_beliefs(tracker, h_t)
    return {"concepts": insights.student_concepts(student_id, beliefs)}


@router.get("/students/{student_id}/resources", dependencies=[AUTHZ], response_model=schemas.ResourcesResponse, tags=["students"])
def resources(student_id: StudentId):
    conn = persistence.init_db()
    seen = {r["content_id"] for r in persistence.get_interaction_rows(conn, student_id) if r.get("content_id")}
    conn.close()
    return {"items": catalog.resource_items(seen)}


@router.get("/students/{student_id}/recommendation", dependencies=[AUTHZ], response_model=schemas.RecommendationResponse,
            tags=["students"])
def recommendation(request: Request, student_id: StudentId,
                   block_index: Optional[int] = Query(None, ge=0, le=4)):
    """Side-effect-free preview of the agent's current inclination. Never consumes a round."""
    result = content_engine.preview_recommendation(student_id, request.app.state.ppo_model, block_index)
    result["note"] = ("Preview only: the tutoring agent samples from this distribution when you start the "
                      "next step, so the actual pick may differ.")
    return result


@router.get("/students/{student_id}/analytics", dependencies=[AUTHZ], response_model=schemas.AnalyticsResponse, tags=["students"])
def analytics(student_id: StudentId, tz: Optional[str] = None, days: Optional[int] = Query(None, ge=1, le=3650)):
    try:
        return insights.student_analytics(student_id, tz_name=tz, days=days)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
