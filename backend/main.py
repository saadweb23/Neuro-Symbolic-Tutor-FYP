import os
from contextlib import asynccontextmanager
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from stable_baselines3 import PPO

load_dotenv()

from serving import persistence
from serving import inference
from serving.content_engine import (
    recommend_content, submit_mcq_answer, get_block_progress, attempted_concepts, SESSION_ROUND_CAP_DEFAULT,
)
from serving.placement_quiz import (
    generate_placement_questions,
    submit_placement_answers,
    load_or_rebuild_state,
)

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
    print("[startup] PPO policy loaded. Tracker weights are loaded lazily per-request "
          "via load_or_rebuild_state (cheap: a 25-node GCN forward pass), so they always "
          "reflect the latest checkpoint on disk without a server restart.")
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
    selected_index: int
    time_taken: float


class MCQAnswerIn(BaseModel):
    content_id: str
    selected_index: int
    time_taken: float


class ContentViewedIn(BaseModel):
    concept: str
    content_id: str
    time_taken: float


class SessionStartIn(BaseModel):
    block_index: int


@app.post("/students/{student_id}/placement/start")
def placement_start(student_id: str):
    questions = generate_placement_questions()
    return {"questions": questions}


@app.post("/students/{student_id}/placement/submit")
def placement_submit(student_id: str, answers: List[PlacementAnswerIn]):
    try:
        beliefs = submit_placement_answers(student_id, [a.model_dump() for a in answers])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"beliefs": beliefs}


@app.get("/students/{student_id}/blocks")
def blocks(student_id: str):
    tracker, edge_index, h_t = load_or_rebuild_state(student_id)
    beliefs = inference.get_mastery_beliefs(tracker, h_t)
    return {"blocks": get_block_progress(beliefs, attempted_concepts(student_id))}


@app.get("/students/{student_id}/session")
def session_status(student_id: str):
    conn = persistence.init_db()
    session = persistence.get_session(conn, student_id)
    conn.close()
    if session is None:
        return {"active": False}
    return {"active": True, **session}


@app.post("/students/{student_id}/session/start")
def session_start(student_id: str, body: SessionStartIn):
    conn = persistence.init_db()
    persistence.ensure_student(conn, student_id)
    persistence.start_session(conn, student_id, body.block_index, round_cap=SESSION_ROUND_CAP_DEFAULT)
    session = persistence.get_session(conn, student_id)
    conn.close()
    return {"active": True, **session}


@app.post("/students/{student_id}/session/continue")
def session_continue(student_id: str):
    conn = persistence.init_db()
    persistence.extend_session(conn, student_id, extra_rounds=SESSION_ROUND_CAP_DEFAULT)
    session = persistence.get_session(conn, student_id)
    conn.close()
    if session is None:
        raise HTTPException(status_code=404, detail="No active session to continue")
    return {"active": True, **session}


@app.get("/students/{student_id}/next")
def next_content(student_id: str):
    return recommend_content(student_id, ppo_model)


@app.post("/students/{student_id}/mcq-answer")
def mcq_answer(student_id: str, body: MCQAnswerIn):
    try:
        return submit_mcq_answer(student_id, body.content_id, body.selected_index, body.time_taken)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/students/{student_id}/content-viewed")
def content_viewed(student_id: str, body: ContentViewedIn):
    conn = persistence.init_db()
    persistence.ensure_student(conn, student_id)
    # Idempotency guard: a duplicate "mark watched" request for a content_id
    # already logged (e.g. a double-tap on a slow connection) must not log a
    # second interaction, or this one viewing gets double-applied to the
    # tracker's belief update.
    if persistence.get_interaction_by_content_id(conn, student_id, body.content_id) is None:
        step_index = persistence.get_next_step_index(conn, student_id)
        # Video/deep-dive content has no inherent pass/fail -- logged as passed=1
        # so it still advances the tracker's hidden state as a "covered" event.
        persistence.log_interaction(
            conn, student_id, step_index, body.concept, passed=1,
            time_taken=body.time_taken, source="tutoring", content_id=body.content_id,
        )
    conn.close()

    tracker, edge_index, h_t = load_or_rebuild_state(student_id)
    belief = inference.get_mastery_beliefs(tracker, h_t)[body.concept]
    return {"concept": body.concept, "updated_belief": belief}


@app.get("/students/{student_id}/mastery")
def mastery(student_id: str):
    tracker, edge_index, h_t = load_or_rebuild_state(student_id)
    return {"beliefs": inference.get_mastery_beliefs(tracker, h_t)}
