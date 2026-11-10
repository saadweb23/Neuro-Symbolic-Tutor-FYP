# NeuroTutor

Neuro-symbolic Python tutor (university FYP). Tracks a student's mastery of 25 Python concepts with a graph neural network over a prerequisite graph, uses a PPO agent to pick the next concept, and a rule-based engine to choose video / practice question / documentation deep-dive and explain why. FastAPI backend + React frontend + SQLite. `PROJECT_REPORT.md` has the full technical report, training setup and results.

## Layout
- `backend/main.py` — FastAPI app (loads the PPO model at startup).
- `backend/serving/` — runtime logic: `content_engine.py` (recommendation + grading), `placement_quiz.py`, `inference.py` (tracker beliefs), `persistence.py` (SQLite), `question_generator.py`.
- `backend/knowledge_graph/` — the 25-concept prerequisite DAG (`graph_builder.py`). `knowledge_graph_physics/` is a standalone physics graph, not wired into the app.
- `backend/tracker/` — Dual-GCN model + trained weights. `backend/agent/` — PPO env, trainer, served PPO `ppo_tutor_v2.zip` (original: `ppo_tutor.zip`).
- `backend/data_generation/` — simulators and the 250-question bank. `backend/experiments/` — research scripts, logs, evidence charts (not part of the running app).
- `backend/api/routes.py` is empty and unused. There are no automated tests.
- `frontend/app/` — React 19 + Vite + React Router. Pages in `src/pages/` (Landing, Placement, Blocks, MainLoop, Mastery), API calls in `src/api.js`.

## Run (Windows; Python 3.12)
- Once: `pip install -r requirements.txt`, copy `backend/.env.example` to `backend/.env`, then `cd frontend/app && npm install`.
- Backend: `cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000`. Takes 30-40 s to start (torch + PPO load). **No auto-reload: restart after editing Python.**
- Frontend: `cd frontend/app && npm run dev -- --port 5173 --host 0.0.0.0`.
- `start_backend.bat`, `start_frontend.bat`, `stop_app.bat` do the same detached. API docs at `http://localhost:8000/docs`.
- The frontend finds the backend at `<page hostname>:8000` (`api.js`), so it works from localhost or a phone on the LAN. `VITE_API_BASE` overrides it.
- Warnings at backend startup (TensorFlow/oneDNN, `google.generativeai` deprecation) are harmless.

## Frontend / backend contract
Frontend and backend are developed separately; the HTTP API is the contract, so agree before changing request or response shapes. All routes are under `/students/{id}`:
`POST placement/start`, `POST placement/submit`, `GET blocks`, `GET session`, `POST session/start`, `POST session/continue`, `GET next`, `POST mcq-answer`, `POST content-viewed`, `GET mastery`.

## Rules and gotchas
- Don't commit or push unless asked. Never commit `.env`, `*.db`, `venv/`, `node_modules/` (all gitignored). `backend/tutor_state.db` is created on first run and holds real student records.
- **The 25-concept graph is baked into the trained models** (tracker `num_nodes=25`, PPO action space 25, observation 75). Adding, renaming or reordering concepts in `graph_builder.py` means retraining both (`train_tracker.py`, `agent/ppo_trainer.py`); concept IDs are list order.
- Every answer updates belief for all concepts within 2 hops across the whole graph, not just the current block. The block only restricts which concept PPO recommends. This is intended, not a bug.
- `interactions` is the source of truth; `mastery_state` is a cache rebuilt by replaying it. If you edit or delete interaction rows by hand, also delete that student's `mastery_state` row.
- `submit_mcq_answer` and `/content-viewed` are idempotent per (student, content_id) to stop double-taps from logging duplicates. Keep that guard, and the disabled-while-submitting buttons in `MainLoop.jsx`.
- `interactions.content_id` is a soft link, not a foreign key: `NULL` for placement, `*-video` / `*-deepdive` for static bank content that lives only in `content_engine.py`, `*-mcq-*` for rows in `generated_questions`.
- `GET next` increments the session round counter on every call, so page reloads use up rounds.
- Several concepts share one video/doc URL in `VIDEO_BANK` / `DEEP_DIVE_BANK`; `_already_shown_reuse` skips repeats by serving a practice question instead.
- "New vs returning student" is decided by browser localStorage, so a new browser re-runs placement for the same ID.
- `backend/.env`: `MOCK_LLM=true` returns placeholder questions; `USE_QUESTION_BANK=true` serves the pre-generated bank. Keep it true unless you have a Gemini key and want live generation.
- PPO does not reliably beat the simple linear-curriculum baseline (see `PROJECT_REPORT.md`); don't claim otherwise in docs or slides.
- To reach the app from a phone, use the PC's current LAN IP on port 5173 (it changes between networks); Windows Firewall must allow ports 8000 and 5173.

## Model versions (branch app-switch-v2)
- The app serves tracker v2 (`tracker/dual_gcn_weights_v2.pth`) with the PPO trained against it (`agent/ppo_tutor_v2.zip`). They must be switched together: the PPO's observation scale depends on the tracker.
- Rollback: set env vars `TRACKER_CHECKPOINT=tracker/dual_gcn_weights_v1.pth` and `PPO_CHECKPOINT=agent/ppo_tutor.zip` (absolute paths), restart the backend. `start_backend_original_models.bat` does this in one click. Full code rollback: `git checkout pre-v2-app-switch` (tag on the last main before the switch).
- Completion guard (`content_engine.py`): a block / the curriculum only completes if every concept in it has at least one answered question (placement or practice; marking a video watched does not count).
- `TUTOR_DB_PATH` points the backend at a throwaway database for tests. `experiments/app_session_test.py` runs simulated sessions through the real serving code.
