# Deploying NeuroTutor for free

```
 Browser ──► Vercel (Hobby)          static React app, SPA fallback          https://<project>.vercel.app
    │
    └──────► Render (Free web svc)   FastAPI + Dual-GCN + PPO (NEURO_LITE=1)  https://neurotutor-api.onrender.com
                  │  DATABASE_URL (secret)
                  └──► Neon (Free)   PostgreSQL: students, interactions, sessions, ...   aws-us-east-1
```

| Part | Service / plan | Why |
|---|---|---|
| Frontend | **Vercel Hobby** | Free static hosting with SPA rewrites (`frontend/app/vercel.json`). |
| API | **Render Free web service** | Free, no card. Needs the memory-slim serving mode below to fit 512 MB. |
| Database | **Neon Free** (PostgreSQL) | The API container's disk is ephemeral, so progress must live in an external database. No expiry (unlike Render's free Postgres). |

Everything is free; nothing asks for a payment method. If any dashboard asks for a card or a paid upgrade, stop.
(Hugging Face Docker Spaces were considered and rejected: they now require a paid PRO plan.)

## Memory: why `NEURO_LITE=1`

Render's free web service has **512 MB** of RAM. The API's real footprint, measured by running the actual stack
(fully started, then after a placement, 8 learning steps and every read endpoint; CUDA PyTorch build on the test machine):

| Mode | Peak resident memory |
|---|---|
| Full research stack (`torch_geometric`, `stable-baselines3`, `gymnasium`, `pandas`) | **777 MB** |
| `NEURO_LITE=1` (serving only) | **580 MB** with the CUDA PyTorch build; lower with the CPU-only wheel Render installs |

The saving comes from not importing `torch_geometric` (~190 MB, ~2,000 modules) and stable-baselines3 just to run
two things: one graph-attention layer and a small policy MLP. In lite mode:

* `tracker/gat_lite.py` is a pure-PyTorch GATConv with the **same parameter names and math**, so the trained checkpoints load unchanged;
* `serving/lite_ppo.py` rebuilds the PPO policy network from the weights inside the stable-baselines3 zip;
* nothing else changes; with `NEURO_LITE` unset (research, training, local development) the original code path is used.

`backend/tests/test_lite_equivalence.py` proves equivalence on the real trained weights: GAT layer identical to
`torch_geometric` on random and batched graphs; both tracker checkpoints give the same beliefs over 40 random student
histories (< 1e-5); both PPO checkpoints give the same action probabilities as `PPO.load` (< 1e-6); the edge index is
identical; and lite mode really imports none of the heavy libraries. The whole backend suite also passes with
`NEURO_LITE=1` on SQLite and PostgreSQL.

`GET /health/db` reports the live `memory_mb`, so the footprint can be checked against Render's limit after deploying.

## What is configured in the repository

| File | Purpose |
|---|---|
| `backend/serving/persistence.py` | Storage layer: SQLite by default, **PostgreSQL when `DATABASE_URL` is set** (same schema and behaviour; connection pool; safe against concurrent writers). |
| `backend/main.py` | `GET /health` (no DB), `GET /health/db`, CORS from `CORS_ORIGINS` (**none** in production if unset), generic 500 responses with full server-side logging, security headers. |
| `backend/requirements-prod.txt` | Lean, pinned runtime dependencies with CPU-only PyTorch (no `torch_geometric` / SB3 / pandas). |
| `render.yaml` | Render Blueprint: build/start commands, `PORT` binding, health check, env vars. |
| `backend/scripts/migrate_sqlite_to_postgres.py` | Copies existing student data into PostgreSQL: read-only on the SQLite file, idempotent, verified. |
| `frontend/app/vercel.json` | Build, output dir, SPA fallback, cache + security headers. |
| `*/.env.example` | Variable names only. **Real values are never committed.** |

## One-time setup

### 1. Database (Neon)
Create a project (PostgreSQL 16, region **aws-us-east-1**, next to Render's Virginia region). *Connection details* →
**Connection pooling on** → copy the pooled string (`postgresql://…-pooler.…neon.tech/neondb?sslmode=require`).
That is `DATABASE_URL`; treat it as a password. Tables are created automatically on first use; nothing is ever dropped.

### 2. API (Render)
Render dashboard → *New → Blueprint* → this repository (it is public) → it reads `render.yaml`. Enter the two values it asks for:
* `DATABASE_URL` = the Neon pooled string (secret);
* `CORS_ORIGINS` = `https://<your-project>.vercel.app` (comma-separate extra domains).

The first build installs PyTorch (several minutes). The service URL is `https://neurotutor-api.onrender.com` (Render
appends a suffix if the name is taken). `render.yaml` deploys the feature branch; change `branch` to `main` after merging.

### 3. Frontend (Vercel)
*Add New → Project* → import the repository. **Root Directory** `frontend/app`; framework Vite; build `npm run build`;
output `dist` (all in `vercel.json`). **Environment variable** `VITE_API_BASE` = the Render URL (no trailing slash). It is
baked in at build time, so changing it needs a redeploy. If the Vercel URL differs from `CORS_ORIGINS`, update that variable.

### 4. Existing student data (only if you already have a `tutor_state.db`)
Run on the machine that has the file (safe to repeat; the SQLite file is only read):
```bash
pip install -r requirements.txt
python backend/scripts/migrate_sqlite_to_postgres.py --sqlite backend/tutor_state.db --database-url "postgresql://…neon.tech/neondb?sslmode=require"
```
It prints, per table, rows in SQLite / inserted / verified and exits non-zero on any mismatch (`--dry-run` previews).
Derived caches (`mastery_state`, `belief_snapshots`) are not copied; they rebuild from `interactions`. Keep the SQLite file as your backup.

## Verify a deployment
```bash
API=https://neurotutor-api.onrender.com
curl $API/health        # {"status":"ok"}             (the first call after sleep takes 1–3 minutes)
curl $API/health/db     # {"status":"ok","database":"postgresql","memory_mb":…}   memory_mb must stay below 512
curl $API/meta | head -c 300
open $API/docs
curl -si -X OPTIONS $API/students/x/status -H "Origin: https://<project>.vercel.app" -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin
```
In the browser: landing → start → placement → results → pick a block → answer a question → dashboard, history, analytics;
reload `/analytics` and `/learn/session` (no 404); toggle dark mode; the console and Network tab show no CORS or failed API
calls. To prove persistence, restart the service (Render → *Manual Deploy → Restart*) and reload the dashboard.

## Free-tier behaviour and limits (confirm current numbers in each dashboard)
* **Cold starts.** Render's free web service spins down after ~15 minutes without traffic and wakes on the next request;
  loading PyTorch and the models takes one to a few minutes on its fraction of a CPU. The site shows "Waking the tutoring
  engine…" and keeps retrying for 2.5 minutes. Redeploys and restarts cause the same wait.
* **Compute and hours.** ~0.1 CPU and 512 MB; a monthly instance-hour allowance applies (about enough for one service
  running all month). Requests are a few milliseconds of compute each; a handful of concurrent students is fine.
* **Neon Free** scales compute to zero after ~5 minutes idle (the first query then adds a fraction of a second), with a
  monthly compute allowance and ~0.5 GB storage per project. Each student uses well under a megabyte, and the API compacts its
  derived caches. `GET /health` never touches the database, so uptime pings do not consume Neon compute.
* **Vercel Hobby** is for non-commercial use, with monthly bandwidth/build limits.
* **No authentication.** A student ID is a label, not a credential: anyone who knows an ID can read that student's data.
  Do not use real names or private information as IDs.
* **YouTube** lessons are embedded from youtube-nocookie.com and need the visitor's network to reach YouTube.

## Rollback and safety
* The SQLite file is never modified by the migration. Switching back to SQLite is just unsetting `DATABASE_URL`.
* Roll back the API from Render's *Deploys* tab; Vercel keeps previous deployments for one-click promotion.
* Secrets live only in the platform dashboards. The API logs never contain the connection string, and unexpected
  errors return a generic `{"detail":"Internal server error"}`.
