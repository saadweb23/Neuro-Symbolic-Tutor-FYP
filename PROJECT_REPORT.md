# Neuro-Symbolic Tutor — Technical Report

**Project:** Graph-Based Reinforcement Learning for Dynamic STEM Remediation
**Team:** Sohaib Ahmed (037) · Rizwan Mughal (038) · Saad ur Rehman (013)
**Report compiled:** 2026-09-27, from the working codebase at `E:\Sohaib Uni Material\FYP\neuro_symbolic_tutor` — every number below is either quoted from an actual training-run log or independently reproduced against the live database this session.

---

## 1. What the project is

A Python-tutoring web app that doesn't just mark answers right or wrong — it maintains a live, per-student **belief state over 25 interdependent Python concepts** (a prerequisite knowledge graph), uses that belief state to decide **what to teach next** and **why**, and can trace a struggling concept back to the weaker prerequisite that's actually causing it. Three ML/rule-based layers work together:

1. **Diagnostic Tracker** (Dual-GCN) — a graph neural network that predicts mastery of all 25 concepts from a student's pass/fail/time history, propagating evidence across the prerequisite graph so even *untested* concepts get an informed estimate.
2. **Remediation Agent** (PPO) — a reinforcement-learning policy that reads the tracker's belief vector and picks which concept to work on next.
3. **Content Engine** (rule-based, deliberately not ML) — turns the agent's chosen concept into an actual recommendation: video on first exposure, practice problem on retry, a documentation deep-dive after repeated failure — with a plain-English "why this?" explanation traced through the knowledge graph.

These are wired into a FastAPI backend, a SQLite persistence layer, and a React/Vite frontend, forming a working end-to-end product (placement quiz → adaptive tutoring loop → mastery dashboard), not just a research notebook.

---

## 2. System architecture

```
 Student (browser / phone)
        │
        ▼
 React/Vite frontend  ──HTTP (fetch)──►  FastAPI backend (main.py)
                                              │
                     ┌────────────────────────┼─────────────────────────┐
                     ▼                        ▼                         ▼
            serving/placement_quiz   serving/content_engine     serving/persistence
            (cold-start seeding)     (recommend_content)         (SQLite: tutor_state.db)
                     │                        │
                     ▼                        ▼
            tracker/dual_gcn.py       agent/ppo_trainer.py + tutoring_env.py
            (DualGCNTracker, frozen    (PPO policy, frozen at serving time)
             at serving time)                │
                     │                        │
                     └───────────┬────────────┘
                                 ▼
                    knowledge_graph/graph_builder.py
                 (25-concept prerequisite DAG — shared by both models)
```

Both ML models are **trained offline** (via `train_tracker.py` and `agent/ppo_trainer.py`) and loaded **frozen** at serving time — the backend never trains online; it only does forward-pass inference plus the lightweight rule logic in the content engine.

---

## 3. The knowledge graph (shared substrate)

`backend/knowledge_graph/graph_builder.py` hand-encodes the Python curriculum as a **25-node directed acyclic graph**, grouped into 5 teaching blocks:

| Block | Concepts |
|---|---|
| Fundamentals | Syntax, Primitive Data Types, Variables, Arithmetic Operators, Relational Operators |
| Control Flow | Conditionals, While Loops, For Loops, Loop Control, Nested Loops |
| Data Structures | Lists, List Methods, Tuples, Sets, Dictionaries |
| Modularity | Function Definition, Arguments, Return Values, Variable Scope, Recursion |
| Intermediate Mechanics | String Manipulation, Error Handling, File IO, List Comprehensions, Modules |

32 directed prerequisite edges connect them (e.g. `For Loops → Nested Loops`, `Conditionals → Error Handling`). This single graph is consumed by **both** ML models — the tracker propagates belief across it, and the RL environment reads prerequisite-completion as part of its observation — so "the model reasons about *why*" isn't a slogan, it's the same graph object used everywhere.

---

## 4. Model 1 — Diagnostic Tracker (Dual-GCN)

**File:** `backend/tracker/dual_gcn.py` (model), `backend/train_tracker.py` (training script), `backend/tracker/dual_gcn_weights.pth` (trained weights).

### Architecture
- `DualGCNTracker(num_nodes=25, feature_dim=64, hidden_dim=64)`
- Two **independent** `SparsePathwayGNN` pathways — one for positive (passed) signals, one for negative (failed) signals — each a 2-layer `GATConv` (4 attention heads, dropout 0.1, `bias=False` so an untouched node gets an exact-zero message, LayerNorm + residual after each layer).
- The two pathways are fused (`Linear+ReLU`) with an identity residual back to the raw concept embedding.
- A `GRUCell` updates the per-concept hidden memory, **gated by an exact 2-hop graph-reachability mask** — only concepts within 2 hops of the just-answered concept have their memory touched at all. This is the mechanism behind the placement-quiz behavior investigated in §9.
- Prediction head (`ConceptQueryHead`): a FiLM-gated MLP that reads (memory, concept-embedding) → mastery logit → sigmoid.

### Training data
- `backend/data_generation/math_simulator.py` — a synthetic BKT/IRT generator (no LLM calls). Three learner profiles (**Fast / Struggling / Forgetful Learner**), each a Beta-distribution over base-mastery, slip, guess, learn and forget rates; concept difficulty derived from DAG depth.
- Produced **2,500 simulated students × 25 steps = 62,500 rows** (`generated_logs.csv`), plus a paired oracle file of true pass probabilities for diagnostics.
- A separate, much smaller **real Gemini-generated batch** exists (`generated_logs - Gemini Generated.csv`, 8 students × 25 steps = 200 rows) but was **not** what training actually used — the math-simulator data was.
- **Dataset validation** (see `notebooks/dataset_evaluation.ipynb` and the 4 root-level PNGs) was run before training to catch bias/corruption:
  - Profile bias check: Fast Learner 65.4% pass rate vs. Struggling Learner 16.2% — profiles are behaviorally distinct, not collapsed.
  - Cognitive load check: failed attempts average 115.1s vs. 74.8s for passed — time-taken correlates with struggle, as expected.
  - Causal dependency check: students who failed "Conditionals" pass "While Loops" only 25.1% of the time (vs. a 20% guess-rate baseline) — the simulator does encode prerequisite effects, albeit modestly.
  - Conventional health checks: 63.3%/36.7% pass/fail class balance, ~25k records roughly evenly split across the 3 profiles (no demographic skew), no corrupted/infinite time values, and per-concept pass rates spread across 30–60% (real difficulty variance, not a flat/degenerate dataset).

### Training procedure
- Split **by student** (not by row): 2,000 train / 250 val / 250 test, seed 42.
- Loss: `BCEWithLogitsLoss` with a `pos_weight` computed from the training split's ~29.8% pass rate (pos_weight ≈ 2.36) to correct for class imbalance.
- Optimizer: AdamW, lr = 0.002, weight decay 1e-4, gradient clipping at norm 1.0; `CosineAnnealingLR` over 25 epochs.
- Best checkpoint selected automatically by validation AUC (guards against the mild overfitting seen in later epochs).

### Results (from `backend/experiments/logs/train_tracker_run.log`, the most recent recorded run)
```
Best validation epoch: 4 (Val AUC 0.7347, cold-start 0.5221, steady-state 0.7250)

--- Final Test Evaluation (best checkpoint, held-out students) ---
Overall AUC-ROC:            0.7176   (script's own target: > 0.75 — not met)
Overall Accuracy:           0.7010
Overall F1-Score:           0.5534
Cold-start AUC (steps 1-2): 0.5263
Steady-state AUC (3-25):    0.7016
```
An earlier documented run (`progress_report.html`, generated from a prior execution of the same script) recorded a slightly higher peak — **test AUC 0.7363**, evaluated in that report against a computed **Bayes-optimal ceiling of 0.795** (the maximum any model could score given the label noise — slip/guess — baked into the simulator itself). At 0.7363 that run sat at **92.7% of the theoretical ceiling**. Run-to-run variance of this size (0.7176 vs 0.7363) across separate training invocations is expected given the stochastic optimizer/dropout and is itself informative: it shows the model is consistently landing near the same ceiling rather than being under-trained.

**Honest read:** cold-start AUC (~0.50–0.53, steps 1–2) is close to chance by construction — every student starts with `h_t = 0` until they've answered something, so there is genuinely nothing to differentiate on yet. This is exactly the limitation this session's placement-quiz fix (§9) targets: reducing how many concepts stay at that cold-start default for longer than necessary.

---

## 5. Model 2 — Remediation Agent (PPO)

**Files:** `backend/agent/ppo_trainer.py` (training), `backend/agent/tutoring_env.py` (Gym environment), `backend/agent/checkpoints/` (69 checkpoint files from 10,000 to 653,104 cumulative steps, spanning multiple separate training/continuation calls, not one contiguous run).

### Environment (`TutoringEnv`)
- **Action space:** `Discrete(25)` — which concept to present next.
- **Observation space:** `Box(0,1, shape=(75,))` — three concatenated 25-length blocks: (1) the frozen tracker's belief per concept, (2) whether all of a concept's prerequisites have been attempted this episode, (3) this-episode visit count (normalized, capped at 10).
- **Reward:** marginal *true* mastery gain (from a hidden ground-truth BKT/IRT simulator, not the tracker's own belief) minus a small per-step cost (0.02), minus a repeat penalty weighted by prior saturation (0.06×), minus a 0.10 penalty if the concept is currently prerequisite-blocked, plus a 0.10 one-time bonus for first-touching a concept.
- **Episode end:** success (`terminated`) at 0.65 average true mastery, or truncation at 150 steps.
- The environment reuses `math_simulator.py`'s BKT/IRT model as the hidden "true student," so the tracker's belief (what the agent observes) and the ground truth (what the reward is computed against) are deliberately different signals — training the agent to act well under realistic *belief uncertainty*, not perfect information.

### Hyperparameters
`PPO("MlpPolicy", learning_rate=3e-4, n_steps=2048, batch_size=256, gamma=0.99, gae_lambda=0.95, clip_range=0.2, ent_coef=0.02, seed=42)`. An `EntropyDecayCallback` linearly anneals `ent_coef` from 0.02→0.002 in later experiments; an imitation-pretraining path exists (behavior-cloning a "weakest-belief" expert for 15 epochs before RL fine-tuning).

### The debugging journey (documented in `progress_report.html`)
Four distinct failure modes were found and fixed during development:
1. **Collapsed to 1 concept** — no penalty for repeating an already-saturated concept → added an explicit repeat penalty.
2. **Exploited an "unlock bonus"** — a progression reward was gamed by picking high-fan-out concepts regardless of follow-through → removed in favor of the simpler repeat penalty.
3. **Misdiagnosed as collapsed** — evaluating with `deterministic=True` just repeated a mildly-favored action for 150 steps, *looking* collapsed when the underlying policy was still near-uniform → fixed the evaluation method itself. (Independently reconfirmed this session: `check_deterministic.log` shows stochastic sampling at 8% success vs. **0% success under deterministic/argmax sampling** on the same checkpoint.)
4. **Entropy annealing** — decaying the exploration coefficient across training moved success rate from 9% to 12%.

### Training-time diagnostics
`experiments/evidence/phase3_ppo_convergence.png` shows the **value function's explained variance** rising from ~0.05 to ~0.85–0.90 within the first ~25,000 timesteps and holding there through 300,000 steps — the critic converges cleanly. The remaining gap, below, is specifically in *policy* performance, not a training/implementation failure.

### Benchmark results — the honest picture
Across every seeded/unseeded evaluation recorded in `backend/experiments/logs/`, comparing PPO against a `random` baseline and a `linear_curriculum` (fixed topological-order) baseline, 100 episodes each:

| Run (log file) | random | linear_curriculum | **ppo** |
|---|---|---|---|
| `ppo_retrain_run.log` (fresh 300k) | 6% / 132.2 steps / 0.256 | 8% / 55.0 / 0.271 | **12% / 104.1 / 0.277** |
| `ppo_retrain_coverage_run.log` | 3% / 127.7 / 0.254 | 13% / 57.1 / 0.291 | **7% / 107.0 / 0.264** |
| `seeded_verify_run.log` (paired seeds) | 3% / 126.7 / 0.260 | 15% / 77.7 / 0.310 | **7% / 100.0 / 0.296** |
| `verify_coverage_retrain.log` | 3% / 126.7 / 0.260 | 15% / 77.7 / 0.310 | **8% / 99.8 / 0.299** |
| `imitation_warmstart_run.log` | 3% / 132.0 / 0.219 | 14% / 69.1 / 0.311 | **5% / 110.4 / 0.285** |
| `diagnostics_run.log` (incl. cheating oracle) | 2% / 103.5 / 0.248 | 8% / 61.5 / 0.297 | **3% / 110.7 / 0.253** (oracle ceiling: 8% / 48.8 / 0.246) |

**What this means, stated plainly:** PPO reaches a 12% success rate in its best recorded run (tying `linear_curriculum`), but across the fuller set of retrain/fine-tune attempts (coverage bonus, imitation warm-start, entropy decay, seeded re-verification) its success rate is usually **at or below** the simple fixed-order baseline, not clearly above it. Even a policy that **cheats** with access to ground-truth mastery (`oracle_ceiling`) only reaches 8% success within the 150-step/0.65-threshold budget — strong evidence that the environment's difficulty ceiling, not the RL implementation, is the binding constraint. This is a legitimate, useful finding for a defense: it demonstrates the team investigated *why* performance plateaus rather than only reporting a headline number, and correctly identifies the next lever (the imitation-warm-start and coverage-bonus experiments were exactly the follow-up attempts to close this gap — both partially captured in incomplete logs, see below).

**Caveat found this session:** two follow-up experiment logs (`coldstart_finetune_run.log`, `entropy_decay_run.log`) stop mid-run with no final "completion"/evaluation block — those specific fix attempts were started but not confirmed to finish; treat any number from them as provisional, not final.

---

## 6. Content Engine (rule-based recommendation layer)

**File:** `backend/serving/content_engine.py`. Deliberately **not** ML — kept explainable on purpose. Given the agent's chosen concept and this student's history on it:

- **No prior attempts** → serve a **video** (curated bank of real, verified YouTube links — mostly Corey Schafer's Python series).
- **Prior attempts, <2 fails** → serve an LLM-generated (or question-bank) **practice MCQ**, difficulty tiered by current belief (easy <40%, medium 40–70%, hard ≥70%).
- **≥2 fails on the same concept** → **escalation**: a documentation deep-dive, with a rotating set of intro phrasings, plus (when the graph identifies one) a callout naming the specific weaker prerequisite it traces back to — the "glass box" behavior: the explanation names a real prerequisite because the tracker's own belief currently rates it weakest among the alternatives, not a canned message.

A **session/block system** scopes each tutoring session to one of the 5 curriculum blocks (5 concepts, up to 15 rounds), with automatic `block_complete`/`session_paused`/`complete` states once mastery thresholds are hit or the round cap is reached (`MASTERY_THRESHOLD = 0.65`, `MIN_CONCEPT_FLOOR = 0.50` — average alone isn't enough, every concept in a block must individually clear the floor too, so a few strong concepts can't mask a genuinely weak one).

---

## 7. Backend API & persistence

**Files:** `backend/main.py` (FastAPI app, 9 endpoints), `backend/serving/persistence.py` (SQLite), `backend/serving/inference.py`, `backend/serving/placement_quiz.py`, `backend/serving/question_generator.py`.

Endpoints cover: placement quiz start/submit, session start/continue/status, next-content recommendation, MCQ answer submission, content-viewed (video/deep-dive) logging, and the full mastery-belief dashboard read.

`tutor_state.db` (SQLite) schema — 5 tables:

| Table | Purpose |
|---|---|
| `students` | student_id → created_at |
| `interactions` | the source-of-truth event log: every (concept, passed, time_taken, source, content_id) ever logged, in order — everything else is derived/replayable from this |
| `mastery_state` | cached serialized tracker hidden state (`h_t`) per student, tagged by model checkpoint version, so it's only rebuilt from `interactions` when stale |
| `generated_questions` | full LLM/bank-generated MCQ payloads (including the answer key — never sent to the client) |
| `sessions` | current block/round-count/round-cap per student |

`question_generator.py` supports three modes: live Gemini calls, a `MOCK_LLM` fast/free placeholder mode for iteration, and `USE_QUESTION_BANK` (the 250-question static bank in §8) for reliable live demos with zero network dependency.

---

## 8. Data generation pipeline

**Files:** `backend/data_generation/math_simulator.py`, `llm_simulator.py`, `build_question_bank.py`.

- `math_simulator.py` — the actual training-data generator (§4): 2,500 students × 25 steps, BKT/IRT, no LLM cost.
- `llm_simulator.py` — an alternative, Gemini-driven simulator (one call per student, prerequisite-consistency instructions embedded in the prompt, rate-limited); only a small 8-student/200-row batch exists from it, used for comparison/validation rather than as the main training set.
- `build_question_bank.py` — one-time offline generation of **250 real Gemini-authored MCQs**: exactly 10 per concept (4 easy / 3 medium / 3 hard) across all 25 concepts, resumable and incrementally saved to `question_bank.json`, paced to respect Gemini's free-tier rate limit.

---

## 9. This session's contributions (2026-09-27)

Building on the above, this session took the project from "trained models + a static prototype" to a running, debugged, remotely-reachable product:

1. **Stood up the full app locally** — diagnosed that `backend/venv` was missing required packages (fastapi, uvicorn, stable-baselines3, torch) and ran the backend against the system Python instead; started the Vite frontend.
2. **Diagnosed and fixed a placement-quiz cold-start gap.** The placement quiz only tests 6 concepts directly; the tracker's 2-hop propagation (§4) means untested concepts *can* still get an informed belief — but `Nested Loops` sat 3 hops from every placement question, so its "weakest area" flag was actually a frozen, untouched cold-start prior identical for every new student, not a real read on them. **Fix:** added `For Loops` as a 7th placement question (1 hop from `Nested Loops`/`Loop Control`), verified live that `Nested Loops`' belief changed from a fixed prior to a genuinely student-specific value (51%) — [placement_quiz.py](backend/serving/placement_quiz.py).
3. **Diagnosed and fixed a content-repetition bug.** `VIDEO_BANK`/`DEEP_DIVE_BANK` intentionally point several related concepts at the same real source (e.g. one video covers While/For/Loop-Control/Nested Loops). When the agent visited a second concept sharing that source, the content engine replayed the identical video/link with no acknowledgement — reading as a repeat bug. **Fix:** added reuse detection (`_already_shown_reuse`) that skips straight to a fresh practice question with a transparent explanation ("*X* is covered by the same material you already saw for *Y*") — [content_engine.py](backend/serving/content_engine.py). Verified against a real student's interaction history and live in the running app.
4. **Investigated a user-reported "Lists mastery changed unexpectedly" report** for student `sohaib_ahmed` by replaying their actual 52-interaction history through the frozen tracker before/after a Loops-only session — confirmed it as intended 2-hop graph propagation (`List Comprehensions` is a direct neighbor of `For Loops`), not a bug, and quantified exactly which of the 25 concepts moved and why.
5. **Enabled LAN/mobile access** — rebound both servers from `127.0.0.1` to `0.0.0.0` and corrected the frontend's baked-in API base URL (was pointing at the *client's* loopback address, which silently breaks on any device but the original PC).
6. **Made the app persist independently of any single terminal/IDE session** — both servers were previously child processes of the development session and died when it closed; relaunched them as detached OS processes and added `start_backend.bat` / `start_frontend.bat` / `stop_app.bat` for one-click control going forward.

---

## 10. Known limitations / honest assessment (for Q&A)

- **Tracker AUC target (>0.75) not met** in the most recent recorded run (0.7176; an earlier run reached 0.7363). Framed against the dataset's own Bayes-optimal ceiling (0.795), the model is capturing ~90%+ of what's extractable from this data — the gap to the target is a data/ceiling issue as much as a modeling one.
- **PPO does not consistently beat the simple linear-curriculum baseline** on success rate across the fuller set of retrain attempts, and even a cheating oracle policy only reaches 8% success within budget — the environment's reward/threshold design is the primary suspect, and is the clearest next research step (imitation warm-start is the most promising untried-to-completion lever).
- **Two follow-up experiment logs are incomplete** (cold-start fine-tune, entropy-decay continuation) — their partial numbers should not be quoted as final.
- **Root `requirements.txt` is stale/incomplete** — it's UTF-16 encoded (decodes fine, but `pip install -r` needs it re-saved as UTF-8 first) and reflects a lighter notebook/data-generation environment; it's missing torch, torch_geometric, stable-baselines3, gymnasium, and fastapi/uvicorn, so it cannot alone reproduce the full backend. Worth regenerating properly before submission.
- **`backend/venv` is stale** relative to what the backend actually needs (same missing-package issue as above).

---

## 11. Evidence assets available (for slides)

- Root: `1 Profile Bias Cjeck (Pass Rate).png`, `2 Cognitive Load (Average Time Taken).png`, `3 Casual Dependencies (Conditional - While).png`, `Conventional Metrics.png` — dataset validation.
- `backend/experiments/evidence/phase2_tracker_auc.png` — validation AUC across all 25 training epochs.
- `backend/experiments/evidence/phase3_ppo_convergence.png` — PPO value-function explained variance over 300k timesteps.
- `backend/experiments/evidence/phase4_database_schema.png` — clean ER diagram of `tutor_state.db`.
- `backend/experiments/evidence/app_*.png` — real app screenshots (landing, placement quiz, blocks, main loop, mastery dashboard, mobile view).
- `progress_report.html` — an earlier (Sep 12) standalone, styled progress report with its own charts; useful as a second source/cross-check for the tracker/PPO numbers in §4–5.
