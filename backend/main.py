import logging
import os
from contextlib import asynccontextmanager
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

load_dotenv()

if os.environ.get("NEURO_LITE") == "1":
    from serving.lite_ppo import load_ppo_lite as _load_ppo   # no stable-baselines3 / gymnasium / pandas in memory
else:
    from stable_baselines3 import PPO

    def _load_ppo(path):
        return PPO.load(path)

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

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO").upper(), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("neurotutor.api")

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
    ppo_model = _load_ppo(PPO_CHECKPOINT_PATH)
    app.state.ppo_model = ppo_model
    app.state.ppo_path = PPO_CHECKPOINT_PATH
    # The tracker is loaded once per checkpoint file (serving.inference.get_tracker caches it by
    # path + mtime, so replacing the file on disk is still picked up) and warmed up here so the
    # first request does not pay for it.
    inference.warm_up()
    print("[startup] PPO policy and tracker loaded.")
    log.info("storage backend: %s | CORS origins: %s", persistence.describe_backend(), CORS_ORIGINS or "none (cross-origin browser requests blocked)")
    yield
    persistence.close_pool()


app = FastAPI(title="Neuro-Symbolic Tutor API", lifespan=lifespan)

def _cors_origins():
    """Allowed browser origins, from CORS_ORIGINS (comma-separated, e.g. the Vercel URL).
    Unset in development: any origin (the Vite dev server runs on an arbitrary port).
    Unset with NEURO_ENV=production: none -- fail closed rather than open to every website."""
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if raw:
        return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    return [] if os.environ.get("NEURO_ENV", "development").lower() == "production" else ["*"]


CORS_ORIGINS = _cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=os.environ.get("CORS_ORIGIN_REGEX") or None,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    """Unexpected failures are logged in full on the server and answered with a generic message:
    stack traces, SQL and connection details never reach the client."""
    log.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


_DIST = os.environ.get("FRONTEND_DIST") or os.path.join(os.path.dirname(SCRIPT_DIR), "frontend", "app", "dist")
_SERVE_SITE = os.path.isfile(os.path.join(_DIST, "index.html"))


if not _SERVE_SITE:
    @app.get("/", include_in_schema=False)
    def root():
        return {"name": "NeuroTutor API", "docs": "/docs", "health": "/health"}


@app.get("/health", tags=["meta"])
def health():
    """Liveness for the hosting platform. Deliberately does not touch the database, so frequent
    probes never wake a scale-to-zero database or count against its free compute allowance."""
    return {"status": "ok"}


def _resident_memory_mb():
    """Resident memory of this process (Linux), to check the footprint against a host's limit."""
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return round(int(line.split()[1]) / 1024)
    except OSError:
        pass
    return None


@app.get("/health/db", tags=["meta"])
def health_db():
    """Verifies the database connection (use it to confirm a deployment; not for frequent probing)."""
    try:
        conn = persistence.init_db()
        conn.execute("SELECT 1").fetchone()
        conn.close()
    except Exception:
        log.exception("database health check failed")
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": persistence.describe_backend().split(":")[0]})
    return {"status": "ok", "database": persistence.describe_backend().split(":")[0], "memory_mb": _resident_memory_mb()}


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


# ---- Optional: serve the built website from this same process (one URL for site + API) ----------
# Active when frontend/app/dist exists (run `npm run build` in frontend/app) or FRONTEND_DIST points
# at a build. Registered LAST so every API route above takes precedence over the catch-all.
if _SERVE_SITE:
    from fastapi.responses import FileResponse

    _API_PREFIXES = ("students/", "docs", "redoc", "openapi.json", "meta", "graph", "health")

    @app.get("/{full_path:path}", include_in_schema=False)
    def site(full_path: str):
        if full_path.startswith(_API_PREFIXES):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = os.path.realpath(os.path.join(_DIST, full_path))
        inside = candidate == os.path.realpath(_DIST) or candidate.startswith(os.path.realpath(_DIST) + os.sep)
        if full_path and inside and os.path.isfile(candidate):
            headers = {"Cache-Control": "public, max-age=31536000, immutable"} if full_path.startswith("assets/") else None
            return FileResponse(candidate, headers=headers)
        return FileResponse(os.path.join(_DIST, "index.html"), headers={"Cache-Control": "no-cache"})  # SPA fallback
