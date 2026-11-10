# NeuroTutor

Neuro-symbolic Python tutor (university FYP). Tracks a student's mastery of 25 Python concepts with a graph neural network over a prerequisite graph, uses a PPO agent to pick the next concept, and a rule-based engine to choose video / practice question / documentation deep-dive and explain why. FastAPI backend + React frontend + SQLite. `PROJECT_REPORT.md` has the full technical report, training setup and results.

## Layout
- `backend/main.py` — FastAPI app (loads the PPO model at startup).
- `backend/serving/` — runtime logic: `content_engine.py` (recommendation + grading), `placement_quiz.py`, `inference.py` (tracker beliefs), `persistence.py` (SQLite), `question_generator.py`.
- `backend/knowledge_graph/` — the 25-concept prerequisite DAG (`graph_builder.py`). `knowledge_graph_physics/` is a standalone physics graph, not wired into the app.
- `backend/tracker/` — Dual-GCN model + trained weights. `backend/agent/` — PPO env, trainer, served PPO `ppo_tutor_v2.zip` (original: `ppo_tutor.zip`).
- `backend/data_generation/` — simulators and the 250-question bank. `backend/experiments/` — research scripts, logs, evidence charts (not part of the running app).
- `backend/api/` — the read-only insight endpoints (`routes.py`, pydantic models in `schemas.py`); `serving/insights.py` (history / summary / trajectory / analytics), `serving/catalog.py` (graph, resources). `backend/tests/` — pytest suite (throwaway DB, real models).
- `frontend/app/` — React 19 + TypeScript (strict) + Vite + Tailwind (build-time) + React Router 7 + TanStack Query. Pages in `src/pages/`, feature logic in `src/features/`, API layer in `src/api/` (`client.ts`, `queries/`, `types/`), design tokens in `src/styles/`. See `frontend/app/README.md`.

## Run (Windows; Python 3.12)
- Once: `pip install -r requirements.txt` (add `-r requirements-dev.txt` to run tests), copy `backend/.env.example` to `backend/.env`, then `cd frontend/app && npm install`.
- Backend: `cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000`. Takes 30-40 s to start (torch + PPO load). **No auto-reload: restart after editing Python.**
- Frontend: `cd frontend/app && npm run dev -- --port 5173 --host 0.0.0.0`.
- `start_backend.bat`, `start_frontend.bat`, `stop_app.bat` do the same detached. API docs at `http://localhost:8000/docs`.
- The frontend finds the backend at `<page hostname>:8000` (`src/config/env.ts`), so it works from localhost or a phone on the LAN. `VITE_API_BASE` overrides it.
- Tests: `cd backend && python -m pytest tests` (backend); `cd frontend/app && npm test` (Vitest), `npm run typecheck`, `npm run build`, `npm run e2e` (Playwright; starts the real backend on a throwaway DB; set `E2E_PYTHON` to a Python with the backend deps and, if needed, `PW_CHROMIUM_PATH`).
- After changing a backend response model: `cd backend && python scripts/export_openapi.py && cd ../frontend/app && npm run types` regenerates `src/api/types/generated.ts`.
- Warnings at backend startup (TensorFlow/oneDNN, `google.generativeai` deprecation) are harmless.

## Frontend / backend contract
Frontend and backend are developed separately; the HTTP API is the contract, so agree before changing request or response shapes. Student ids are case-sensitive, 1-64 chars, no `/`. Routes under `/students/{id}`:
- Learning (write): `POST placement/start`, `POST placement/submit` (409 once placement exists), `POST session/start` (`block_index` 0-4), `POST session/continue`, `GET next` (**the only route that consumes a round**), `POST mcq-answer`, `POST content-viewed`.
- Read-only: `GET blocks`, `session`, `mastery`, `status`, `summary`, `history`, `mastery/trajectory`, `concepts`, `resources`, `recommendation` (preview), `analytics`; global `GET /meta` (readiness + the thresholds the UI shows) and `GET /graph`.
- Read-only endpoints must never call `ensure_student`, write interactions, generate a question or increment a round. `/next`'s response shape (`content_engine.recommend_content`) is typed by hand in `frontend/app/src/api/types/next.ts`: keep them in sync.

## Deployment (free tier; see `DEPLOYMENT.md`)
- Vercel (frontend, `frontend/app/vercel.json`) + Neon PostgreSQL + the API either on a Render free web service (`render.yaml`, needs a card on file) or, as actually deployed, on the owner's PC behind a Cloudflare quick tunnel (`deploy/windows/start_public_api.ps1`; the tunnel URL changes per start, so the frontend must be redeployed with the new `VITE_API_BASE`). The full stack needs ~780 MB, so production runs with `NEURO_LITE=1` (serving-only replacements for torch_geometric / stable-baselines3, ~580 MB with a CUDA torch build, less with the CPU wheel); the equivalence tests in `tests/test_lite_equivalence.py` must keep passing. Hugging Face Docker Spaces now need a paid PRO plan, so they are not used.
- `DATABASE_URL` set => PostgreSQL (`serving/persistence.py`; same schema and behaviour as SQLite, tested on both: `DATABASE_URL=postgresql://... python -m pytest tests`). Unset => the local SQLite file. Never commit either a database or a connection string.
- Production env: `NEURO_ENV=production`, `CORS_ORIGINS` (the Vercel origin; empty = no cross-origin access), `DATABASE_URL` (secret), `VITE_API_BASE` (frontend build). `GET /health` never touches the DB; `GET /health/db` does.
- Move existing data: `python backend/scripts/migrate_sqlite_to_postgres.py --sqlite tutor_state.db --database-url ...` (read-only on SQLite, idempotent, verified).
- `belief_snapshots` keeps the hidden state only for the newest step per student (older ones are compacted); that is intended.

## Rules and gotchas
- Don't commit or push unless asked. Never commit `.env`, `*.db`, `venv/`, `node_modules/` (all gitignored). `backend/tutor_state.db` is created on first run and holds real student records.
- **The 25-concept graph is baked into the trained models** (tracker `num_nodes=25`, PPO action space 25, observation 75). Adding, renaming or reordering concepts in `graph_builder.py` means retraining both (`train_tracker.py`, `agent/ppo_trainer.py`); concept IDs are list order.
- Every answer updates belief for all concepts within 2 hops across the whole graph, not just the current block. The block only restricts which concept PPO recommends. This is intended, not a bug.
- `interactions` is the source of truth; `mastery_state` and `belief_snapshots` are caches rebuilt by replaying it. If you edit or delete interaction rows by hand, also delete that student's `mastery_state` row and their `belief_snapshots` rows.
- `submit_mcq_answer` and `/content-viewed` are idempotent to stop double-taps from logging duplicates: MCQs and videos per (student, content_id); a deep-dive only while it is still the student's latest interaction (it can legitimately be read again after later failures). Keep those guards and the disabled-while-submitting buttons in the workspace.
- `interactions.content_id` is a soft link, not a foreign key: `*-video` / `*-deepdive` for static bank content that lives only in `content_engine.py`, `*-mcq-*` / `*-placement-*` for rows in `generated_questions` (old placement rows have `NULL`). `interactions.selected_index` is the option the student picked (`NULL` for older rows and for videos).
- Escalation rule (`select_content_type`): failures are counted since the student last read that concept's deep-dive, so reading it returns them to practice questions.
- `GET next` increments the session round counter on every call. The frontend calls it only from the Learning Workspace and restores the current step from `sessionStorage` on reload, so reloads in the app do not use up rounds (calling the API directly still does).
- The tracker is loaded once per checkpoint file (`inference.get_tracker`, cached by path + mtime, warmed at startup).
- Several concepts share one video/doc URL in `VIDEO_BANK` / `DEEP_DIVE_BANK`; `_already_shown_reuse` skips repeats by serving a practice question instead.
- "New vs returning student" is decided by the server (`GET /status`: placement done? active session?), not localStorage. There is no authentication: anyone who knows an ID can read that student's data.
- `backend/.env`: `MOCK_LLM=true` returns placeholder questions; `USE_QUESTION_BANK=true` serves the pre-generated bank. Keep it true unless you have a Gemini key and want live generation.
- PPO does not reliably beat the simple linear-curriculum baseline (see `PROJECT_REPORT.md`); don't claim otherwise in docs or slides.
- To reach the app from a phone, use the PC's current LAN IP on port 5173 (it changes between networks); Windows Firewall must allow ports 8000 and 5173.

## Model versions (branch app-switch-v2)
- The app serves tracker v2 (`tracker/dual_gcn_weights_v2.pth`) with the PPO trained against it (`agent/ppo_tutor_v2.zip`). They must be switched together: the PPO's observation scale depends on the tracker.
- Rollback: set env vars `TRACKER_CHECKPOINT=tracker/dual_gcn_weights_v1.pth` and `PPO_CHECKPOINT=agent/ppo_tutor.zip` (absolute paths), restart the backend. `start_backend_original_models.bat` does this in one click. Full code rollback: `git checkout pre-v2-app-switch` (tag on the last main before the switch).
- Completion guard (`content_engine.py`): a block / the curriculum only completes if every concept in it has at least one answered question (placement or practice; marking a video watched does not count).
- `TUTOR_DB_PATH` points the backend at a throwaway database for tests (the pytest suite and the Playwright e2e tests use it). `experiments/app_session_test.py` runs simulated sessions through the real serving code.
