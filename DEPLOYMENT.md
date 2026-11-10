# Deploying NeuroTutor for free

```
 Browser ──► Vercel (Hobby)            static React app, SPA fallback        https://<project>.vercel.app
    │
    └──────► Hugging Face Space        FastAPI + Dual-GCN + PPO (Docker)     https://<user>-<space>.hf.space
                  │  DATABASE_URL (secret)
                  └──► Neon (Free)     PostgreSQL: students, interactions, sessions, ...
```

| Part | Service / plan | Why |
|---|---|---|
| Frontend | **Vercel Hobby** | Free static hosting with SPA rewrites (`frontend/app/vercel.json`). |
| API | **Hugging Face Spaces, "CPU basic"** (free) | See *Why not Render* below: the learning engine needs ~750 MB of RAM; the free CPU Space has 16 GB. |
| Database | **Neon Free** (PostgreSQL) | The API container's disk is ephemeral, so progress must live in an external database. No expiry (unlike Render's free Postgres). |

Everything below is free; nothing here asks for a payment method. If any dashboard asks for a card or a paid upgrade, stop.

## Why not Render (measured, not assumed)

Render's free web service has **512 MB** of RAM. The API's real footprint, measured by importing and
running the actual stack (`backend/`, single thread):

| Stage | Resident memory |
|---|---|
| `import torch` | ~520 MB (the CUDA build used for this measurement; the CPU wheel is smaller) |
| `+ import torch_geometric` (imports ~2,000 modules) | +~190 MB |
| `+ stable-baselines3, FastAPI, PPO model, tracker, first forward pass` | +~40 MB |
| **API ready to serve** | **~750 MB** |

Turning off TorchScript (`PYTORCH_JIT=0`) or limiting allocator arenas changed nothing. Even if the CPU-only
PyTorch wheel saves a few hundred MB, the total stays at or above 512 MB, so the service would be killed for
running out of memory. Making it fit would mean re-implementing parts of the tracker / PPO loading, which this
project deliberately does not touch. A Hugging Face CPU Space (2 vCPU, 16 GB) runs the unmodified code with room
to spare, and sleeps only after **48 hours** of inactivity instead of Render's 15 minutes.

## What is configured in the repository

| File | Purpose |
|---|---|
| `backend/serving/persistence.py` | Storage layer: SQLite by default, **PostgreSQL when `DATABASE_URL` is set** (same schema, same behaviour; connection pool; safe against concurrent writers). |
| `backend/main.py` | `GET /health` (no DB), `GET /health/db`, CORS from `CORS_ORIGINS` (**none** in production if unset), generic 500 responses with full server-side logging, security headers. |
| `backend/requirements-prod.txt` | Lean, pinned runtime dependencies with CPU-only PyTorch. |
| `backend/scripts/migrate_sqlite_to_postgres.py` | Copies existing student data into PostgreSQL, read-only on the SQLite file, idempotent, verified. |
| `deploy/huggingface/` | `Dockerfile`, Space `README.md` (port 7860), `stage.sh`, `deploy.sh`. |
| `.github/workflows/deploy-hf-space.yml` | Optional: redeploys the Space when `backend/` changes on `main`. |
| `frontend/app/vercel.json` | Build, output dir, SPA fallback, cache + security headers. |
| `*/.env.example` | Variable names only. **Real values are never committed.** |

## One-time setup

You need free accounts on **Neon**, **Hugging Face** and **Vercel** (GitHub sign-in works for all three).

### 1. Database (Neon)
1. Create a project (Postgres 16+). Pick the region closest to the Hugging Face Space (US East/Virginia is fine).
2. *Connection details* → turn **Connection pooling** on → copy the **pooled** connection string
   (`postgresql://…-pooler.…neon.tech/neondb?sslmode=require`). This is `DATABASE_URL`. Treat it as a password.
3. Tables are created automatically on the API's first request. Nothing is ever dropped.

### 2. API (Hugging Face Space)
1. *New Space* → SDK **Docker** → hardware **CPU basic · free** → name it e.g. `neurotutor-api`.
2. Space *Settings → Variables and secrets*:
   * **Secret** `DATABASE_URL` = the Neon pooled string.
   * **Variable** `CORS_ORIGINS` = `https://<your-project>.vercel.app` (comma-separate extra domains; no trailing slash needed).
3. Create an access token (*Settings → Access Tokens*, **Write**) and deploy from this repository:
   ```bash
   export HF_TOKEN=hf_xxx            # do not commit; do not paste into chat
   export HF_SPACE=<username>/neurotutor-api
   bash deploy/huggingface/deploy.sh
   ```
   (Or, for automatic deploys: add `HF_TOKEN` as a repository secret and `HF_SPACE` as a repository variable;
   the workflow `deploy-hf-space.yml` then deploys on every change to `backend/` on `main`.)
4. The first build installs PyTorch and takes several minutes. The API URL is `https://<username>-neurotutor-api.hf.space`.

### 3. Frontend (Vercel)
1. *Add New → Project* → import this GitHub repository.
2. **Root Directory** `frontend/app` · Framework **Vite** · Build `npm run build` · Output `dist` (all pre-filled by `vercel.json`).
3. **Environment Variable** `VITE_API_BASE` = the Space URL (e.g. `https://<username>-neurotutor-api.hf.space`, no trailing slash). It is baked in at build time, so changing it needs a redeploy.
4. Deploy. If the Vercel URL differs from what you put in `CORS_ORIGINS`, update that Space variable (the Space restarts).

### 4. Existing student data (only if you already have a `tutor_state.db`)
Run on the machine that has the file, with the Neon string (read-only on SQLite; safe to repeat):
```bash
pip install -r requirements.txt
python backend/scripts/migrate_sqlite_to_postgres.py --sqlite backend/tutor_state.db --database-url "postgresql://…neon.tech/neondb?sslmode=require"
```
It prints, per table, rows in SQLite / inserted / verified, and exits non-zero on any mismatch. Add `--dry-run` to preview.
Derived caches (`mastery_state`, `belief_snapshots`) are not copied; they rebuild automatically from `interactions`.
Keep your SQLite file as the backup.

## Verify a deployment

```bash
API=https://<username>-neurotutor-api.hf.space
curl $API/health                 # {"status":"ok"}              (may take 1–2 min after a cold start)
curl $API/health/db              # {"status":"ok","database":"postgresql"}
curl $API/meta | head -c 300     # models + thresholds
open $API/docs                   # interactive API documentation
# CORS: the allowed origin is echoed, any other is refused
curl -si -X OPTIONS $API/students/x/status -H "Origin: https://<project>.vercel.app" -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin
```
Then in the browser: landing → start → placement → results → pick a block → answer a question → dashboard,
history and analytics; reload `/analytics` and `/learn/session` (they must not 404); toggle dark mode;
DevTools console and Network tabs must show no CORS or failed API calls. To prove persistence, restart the
Space (*Settings → Factory reboot* or push a commit) and reload the dashboard: the student's data is still there.

## Free-tier behaviour and limits (check each dashboard for the current numbers)

* **Cold starts.** A free Hugging Face Space sleeps after ~48 h without traffic and wakes on the next request;
  loading torch + the models takes about a minute (longer on a fresh build). The site shows
  "Waking the tutoring engine…" and keeps retrying for ~2.5 minutes. Restarts/redeploys cause the same wait.
* **Compute.** 2 vCPU / 16 GB. Requests are a few milliseconds of compute each; a handful of concurrent students is fine.
* **Neon Free** scales its compute to zero after ~5 minutes idle (first query then adds a fraction of a second) and has a monthly
  compute allowance and a ~0.5 GB storage cap per project. Each student uses well under a megabyte; the API
  compacts its derived caches to keep it small. `GET /health` deliberately never touches the database, so uptime
  pings do not consume Neon compute.
* **Vercel Hobby** is for non-commercial use, with monthly bandwidth/build limits.
* **No authentication.** A student ID is a label, not a credential: anyone who knows an ID can read that student's
  data. Do not use real names or private information as IDs.
* **YouTube** lessons are embedded from youtube-nocookie.com; they need the visitor's network to reach YouTube.

## Rollback and safety

* The SQLite file is never modified by the migration. Switching back to SQLite is just unsetting `DATABASE_URL`.
* Redeploy an earlier commit by pushing it to the Space (or re-running `deploy.sh` from that commit); Vercel keeps previous deployments for one-click promotion.
* Secrets live only in the platform dashboards (`DATABASE_URL`, `HF_TOKEN`). The API logs never contain the connection string, and unexpected errors return a generic `{"detail":"Internal server error"}`.
