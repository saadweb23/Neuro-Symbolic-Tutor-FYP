import os
from contextlib import asynccontextmanager
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from stable_baselines3 import PPO

load_dotenv()

from serving import persistence
from serving import inference
from serving.content_engine import (
    recommend_content, submit_mcq_answer, log_content_viewed, get_block_progress, attempted_concepts,
    SESSION_ROUND_CAP_DEFAULT,
)
from serving.placement_quiz import (
    generate_placement_questions,
    submit_placement_answers,
    load_or_rebuild_state,
    placement_completed,
    PlacementAlreadyCompleted,
)
from api.routes import router as insights_router
from api.schemas import StudentId, TimeTaken

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# ppo_tutor_v2.zip was trained against the v2 tracker; ppo_tutor.zip is the original (pairs with dual_gcn_weights_v1.pth).
PPO_CHECKPOINT_PATH = os.environ.get("PPO_CHECKPOINT") or os.path.join(SCRIPT_DIR, "agent", "ppo_tutor_v2.zip")

# Loaded once at startup by the lifespan handler below, then read (never
# reloaded) by every request -- reloading per-request would reload the whole
# policy network from disk on every single API call.
ppo_model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ppo_model
    print(f"[startup] Loading PPO policy from {PPO_CHECKPOINT_PATH} ...")
    ppo_model = PPO.load(PPO_CHECKPOINT_PATH)
    app.state.ppo_model = ppo_model
    app.state.ppo_path = PPO_CHECKPOINT_PATH
    # The tracker is loaded once per checkpoint file (serving.inference.get_tracker caches it by
    # path + mtime, so replacing the file on disk is still picked up) and warmed up here so the
    # first request does not pay for it.
    inference.warm_up()
    print("[startup] PPO policy and tracker loaded.")
    yield


app = FastAPI(title="Neuro-Symbolic Tutor API", lifespan=lifespan)

# Local FYP dev/demo: frontend runs on a Vite dev server on an arbitrary
# localhost port, so allow any origin rather than hardcoding one.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PlacementAnswerIn(BaseModel):
    content_id: str
    selected_index: int = Field(ge=0, le=3)
    time_taken: TimeTaken


class MCQAnswerIn(BaseModel):
    content_id: str
    selected_index: int = Field(ge=0, le=3)
    time_taken: TimeTaken


class ContentViewedIn(BaseModel):
    concept: str
    content_id: str
    time_taken: TimeTaken


class SessionStartIn(BaseModel):
    # 0..4 -- a negative value used to silently select a different block via Python indexing
    block_index: int = Field(ge=0, le=4)


@app.post("/students/{student_id}/placement/start")
def placement_start(student_id: StudentId):
    if placement_completed(student_id):
        raise HTTPException(status_code=409, detail="Placement already completed for this student")
    questions = generate_placement_questions()
    return {"questions": questions}


@app.post("/students/{student_id}/placement/submit")
def placement_submit(student_id: StudentId, answers: List[PlacementAnswerIn]):
    try:
        beliefs = submit_placement_answers(student_id, [a.model_dump() for a in answers])
    except PlacementAlreadyCompleted:
        raise HTTPException(status_code=409, detail="Placement already completed for this student")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"beliefs": beliefs}


@app.get("/students/{student_id}/blocks")
def blocks(student_id: StudentId):
    tracker, edge_index, h_t = load_or_rebuild_state(student_id)
    beliefs = inference.get_mastery_beliefs(tracker, h_t)
    return {"blocks": get_block_progress(beliefs, attempted_concepts(student_id))}


@app.get("/students/{student_id}/session")
def session_status(student_id: StudentId):
    conn = persistence.init_db()
    session = persistence.get_session(conn, student_id)
    conn.close()
    if session is None:
        return {"active": False}
    return {"active": True, **session}


@app.post("/students/{student_id}/session/start")
def session_start(student_id: StudentId, body: SessionStartIn):
    conn = persistence.init_db()
    persistence.ensure_student(conn, student_id)
    persistence.start_session(conn, student_id, body.block_index, round_cap=SESSION_ROUND_CAP_DEFAULT)
    session = persistence.get_session(conn, student_id)
    conn.close()
    return {"active": True, **session}


@app.post("/students/{student_id}/session/continue")
def session_continue(student_id: StudentId):
    conn = persistence.init_db()
    persistence.extend_session(conn, student_id, extra_rounds=SESSION_ROUND_CAP_DEFAULT)
    session = persistence.get_session(conn, student_id)
    conn.close()
    if session is None:
        raise HTTPException(status_code=404, detail="No active session to continue")
    return {"active": True, **session}


@app.get("/students/{student_id}/next")
def next_content(student_id: StudentId):
    return recommend_content(student_id, ppo_model)


@app.post("/students/{student_id}/mcq-answer")
def mcq_answer(student_id: StudentId, body: MCQAnswerIn):
    try:
        return submit_mcq_answer(student_id, body.content_id, body.selected_index, body.time_taken)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/students/{student_id}/content-viewed")
def content_viewed(student_id: StudentId, body: ContentViewedIn):
    # log_content_viewed validates the concept / content id and is idempotent against
    # double-taps (see its docstring): a duplicate must not log a second interaction, or this
    # one viewing would be double-applied to the tracker's belief update.
    try:
        log_content_viewed(student_id, body.concept, body.content_id, body.time_taken)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    tracker, edge_index, h_t = load_or_rebuild_state(student_id)
    belief = inference.get_mastery_beliefs(tracker, h_t)[body.concept]
    return {"concept": body.concept, "updated_belief": belief}


@app.get("/students/{student_id}/mastery")
def mastery(student_id: StudentId):
    tracker, edge_index, h_t = load_or_rebuild_state(student_id)
    return {"beliefs": inference.get_mastery_beliefs(tracker, h_t)}


# Read-only insight endpoints (/meta, /graph, /status, /summary, /history, ...)
app.include_router(insights_router)
