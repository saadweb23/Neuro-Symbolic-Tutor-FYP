# Neuro-Symbolic Tutor — Complete Project Documentation

This document is a complete, honest technical record of everything built, tested, diagnosed,
and fixed in this codebase — intended as reference material for exam/defense preparation.
Every number here is a real measured result, not an estimate. Where something doesn't work
yet, it says so plainly.

---

## 1. What the system actually is

A Python-tutoring web app with three cooperating layers, matching the proposal's
"neuro-symbolic" framing:

1. **Symbolic layer** — a hand-authored Knowledge Graph of 25 Python concepts with real
   prerequisite edges (e.g. "Conditionals" → "While Loops"). This gives the system explicit,
   inspectable structure instead of a black-box sequence model.
2. **Neural perception layer** — a Dual-GCN (Graph Convolutional Network) that reads a
   student's interaction history and outputs a belief (0–1 probability) for how well they've
   mastered *every* concept, not just the ones they've been directly tested on, by propagating
   evidence across the graph.
3. **Neural decision layer** — a PPO (Proximal Policy Optimization) reinforcement-learning
   agent that reads the belief vector and decides which concept to work on next.

A rule-based layer sits on top of PPO's concept choice and decides *how* to teach it (video /
quiz / deep-dive), and a FastAPI backend + React frontend expose the whole thing as a real,
working web app.

---

## 2. Complete file inventory (what exists and why)

### `backend/knowledge_graph/`
- **`graph_builder.py`** — Defines the 25 concepts (`CONCEPTS`), their prerequisite edges as a
  NetworkX `DiGraph`, and `CONCEPT_BLOCKS` (5 named groups of 5 concepts each — Fundamentals,
  Control Flow, Data Structures, Modularity, Intermediate Mechanics). Also
  `analyze_failure_dependencies()`, used to find *why* a concept is hard by tracing its
  ancestors in the graph.

### `backend/data_generation/`
- **`math_simulator.py`** — Generates synthetic student data using a BKT/IRT-style model
  (Bayesian Knowledge Tracing / Item Response Theory): each synthetic student gets randomized
  traits (base mastery, slip rate, guess rate, learn rate) drawn from named profiles
  ("Fast Learner", "Struggling Learner", "Forgetful Learner"), then walks through the
  curriculum with prerequisite-gated mastery growth. This is the **primary training data
  source** — 2,500 synthetic students, 25 interactions each.
- **`llm_simulator.py`** — An alternate, Gemini-based synthetic-student generator (used for a
  smaller supplementary sample; the math simulator is the main pipeline).
- **`build_question_bank.py`** — **(New, for demo-readiness)** One-time offline generator that
  calls the real Gemini API 250 times (25 concepts × 4 easy / 3 medium / 3 hard) and saves the
  results to `question_bank.json`, so the live demo never depends on a network call. Resumable
  and incrementally saved (writes after every single question) specifically because it hit
  real API rate limits during generation — see §7.

### `backend/tracker/`
- **`dual_gcn.py`** — The Dual-GCN model itself. Two separate GAT (Graph Attention) pathways —
  `pathway_pos` and `pathway_neg` — process *correct* and *incorrect* signals separately before
  fusing them, so a failure on a prerequisite doesn't get smoothed away by successes elsewhere
  (this is the "Positive-Negative Feature Enhancement Network" from the proposal). A `GRUCell`
  maintains a persistent hidden state per student across their whole interaction history.
  Updates are gated by exact k-hop graph reachability, so an interaction can only influence
  concepts within 2 hops — not the whole graph indiscriminately.
- **`graph_dataset.py`** — `StudentGraphDataset`, wraps the synthetic CSV logs into
  graph-aware training sequences.
- **`dual_gcn_weights.pth`** — The trained checkpoint currently in use (epoch 4 of a 25-epoch
  run on the 2,500-student dataset — see §4 for why epoch 4, not epoch 25).

### `backend/agent/`
- **`tutoring_env.py`** — `TutoringEnv`, the Gymnasium RL environment PPO trains against. Wraps
  the frozen Dual-GCN tracker plus an internal "true student" simulator (reusing the BKT/IRT
  model) that PPO never directly sees — it only sees the tracker's *belief*, mirroring real
  deployment. Contains the reward function, the observation space, and (after diagnosis, see
  §6) the fixes for two real bugs: a blocked-concept penalty and a first-visit coverage bonus.
- **`ppo_trainer.py`** — Training/evaluation harness: `train()`, `evaluate_policies()`, the
  three baseline policies (`random_policy_fn`, `linear_curriculum_policy_fn`,
  `weakest_belief_policy_fn`), a `structure_aware_policy_fn`, and the imitation-warm-start
  pipeline (`collect_expert_trajectories`, `imitation_pretrain`,
  `train_with_imitation_warmstart`).
- **`ppo_tutor.zip`** — The trained PPO policy currently in use.
- **`checkpoints/`** — Numbered training checkpoints from multiple training runs.

### `backend/serving/` (the real-time inference layer used by the live app)
- **`persistence.py`** — SQLite schema and CRUD. Five tables: `students`, `interactions` (the
  raw event log — source of truth), `mastery_state` (cached tracker hidden state, tagged with
  a model-version so a retrained tracker invalidates stale caches automatically),
  `generated_questions` (stores the answer key server-side), `sessions` (which curriculum
  block a student is on, and their round count/cap for that session).
- **`inference.py`** — `get_mastery_beliefs()`, `apply_interaction()` — thin wrappers around the
  tracker used identically by both placement and the main loop.
- **`placement_quiz.py`** — `generate_placement_questions()` (built from scratch this project —
  it didn't exist before), `submit_placement_answers()`, `run_placement_quiz()`,
  `load_or_rebuild_state()` (replays a student's full interaction history if their cached
  hidden state is stale or missing). `PLACEMENT_CONCEPTS` is currently **7** concepts (Syntax,
  Primitive Data Types, Conditionals, Lists, Function Definition, String Manipulation, **For
  Loops** — For Loops was added after a real diagnosed issue, see §7).
- **`question_generator.py`** — `generate_mcq()`, `grade_mcq()`, `difficulty_for_belief()`
  (belief < 0.4 → easy, < 0.7 → medium, else hard). Three interchangeable generation modes,
  selected by environment variable: **real** (live Gemini), **mock** (instant free placeholder
  text, for UI dev), **bank** (pre-generated static file, for the demo — see §7).
- **`content_engine.py`** — The actual orchestration logic: `recommend_content()` is the
  per-round decision function (read belief → ask PPO for a concept → decide content type →
  build explanation), `submit_mcq_answer()` grades an answer and advances state,
  `_build_observation()` constructs PPO's 75-dim input, `_ppo_recommend_within()` masks PPO's
  action distribution to the student's chosen curriculum block, `get_block_progress()` powers
  the block-picker screen, and `_already_shown_reuse()` (added after a real diagnosed bug, see
  §7) prevents replaying the same video/doc link under a different concept name.

### `backend/main.py`
FastAPI app. Loads the PPO model once at startup (tracker is loaded lazily per-request so a
retrained checkpoint takes effect without a server restart). CORS open for local dev. Endpoints:
`POST /students/{id}/placement/start`, `POST /students/{id}/placement/submit`,
`GET /students/{id}/next`, `POST /students/{id}/mcq-answer`, `POST /students/{id}/content-viewed`,
`GET /students/{id}/mastery`, `GET /students/{id}/blocks`, `GET/POST /students/{id}/session`
(+ `/session/continue`).

### `backend/train_tracker.py` and `backend/experiments/`
The tracker's own training script (25-epoch loop, per-student sequential loss, cosine LR
schedule, best-checkpoint-on-val-AUC saving), plus every one-off training/diagnostic script run
during development (PPO retrains, the cold-start fine-tune attempt, the coverage-hypothesis
check, episode tracing scripts, the seeded/paired evaluation harness) — kept here rather than
cluttering the main backend, each with its own log in `experiments/logs/`.

### `frontend/app/` (React + Vite)
- **`src/pages/Landing.jsx`** — student ID entry; routes new students to placement, returning
  students to their active session or the block picker.
- **`src/pages/Placement.jsx`** — the 7-question placement quiz, then a "here's what we found"
  results screen showing the live 25-concept belief grid with an explicit disclaimer that only
  N concepts were actually quizzed and the rest come from graph propagation.
- **`src/pages/Blocks.jsx`** — the focus-area picker (5 curriculum blocks, live per-block
  progress bars, a "complete" badge).
- **`src/pages/MainLoop.jsx`** — the core adaptive loop: renders video / MCQ / escalation based
  on what the backend returns, shows the prominent "why" explanation callout, a persistent
  block-progress bar, before/after belief deltas after every answer, and dedicated screens for
  block-complete / session-paused / curriculum-complete states.
- **`src/pages/Mastery.jsx`** — the live 25-concept dashboard, color-coded (mastered ≥70%,
  developing 40–70%, weak <40%), accessible at any point.
- **`src/api.js`**, **`src/student.js`**, **`src/tiers.js`** — API client, localStorage-based
  student identity (no real auth — explicitly out of scope), and the shared color-tier logic.

### Root-level launch scripts (new, for demo independence)
- **`start_backend.bat`** / **`start_frontend.bat`** — launch each server bound to `0.0.0.0`
  (not just localhost) so the app is reachable from other devices on the same network, as
  detached processes that keep running even if the Claude Code session that started them
  closes.
- **`stop_app.bat`** — kills both by port.
- **`frontend/app/.env`** — `VITE_API_BASE` points at the machine's LAN IP so a phone/laptop on
  the same Wi-Fi can load the app directly.

---

## 3. Data generation & training pipeline (the offline half)

1. `math_simulator.py` generates 2,500 synthetic students × 25 interactions, with realistic
   noise (slip/guess rates) baked in on purpose — this noise is what caps the achievable
   accuracy ceiling (see §4).
2. `train_tracker.py` trains the Dual-GCN on that data (25 epochs, per-student sequential
   loss, best-checkpoint-on-validation-AUC saving).
3. `ppo_trainer.py` trains PPO entirely against a *frozen* copy of that trained tracker, inside
   the simulated `TutoringEnv` — PPO never sees a real student during training, exactly per the
   proposal's cold-start-via-synthetic-data design.
4. Both trained artifacts (`dual_gcn_weights.pth`, `ppo_tutor.zip`) are loaded by the FastAPI
   backend at serving time and never retrained live.

---

## 4. Dual-GCN Tracker — training results (honest, both runs)

| | 1,000-student run | 2,500-student run (current) |
|---|---|---|
| Best epoch | ~5 (early peak) | **4** |
| Best validation AUC | 0.7331→ (peaked ~epoch 5) | 0.7347 |
| **Final held-out test AUC** | **0.7363** | **0.7176** |
| Cold-start AUC (steps 1–2) | — | 0.5263 |
| Steady-state AUC (steps 3–25) | — | 0.7016 |
| Accuracy / F1 | — | 0.7010 / 0.5534 |
| Calculated Bayes-optimal ceiling | 0.7945 | 0.7945 (reconfirmed stable) |
| % of ceiling reached | 92.7% | 90.3% |

**Full 2,500-student epoch curve** (25 epochs, cosine LR schedule): peaked at epoch 4
(0.7347), then plateaued/slightly declined for the remaining 21 epochs, never beating epoch 4
again (final epochs settled around 0.729). The deployed model is therefore the **epoch-4
checkpoint**, not epoch 25 — the training script saves whichever epoch had the best validation
AUC, and running the full 25 epochs (rather than the interrupted 4-epoch run this retrain
originally had) confirmed epoch 4 really was the peak, not an artifact of an incomplete run.

**Honest interpretation:**
- **The 0.80 AUC target from the proposal was not hit**, and the reason is provable, not a
  training failure: the synthetic data generator injects slip/guess noise on purpose (to be
  realistic), and this creates a *calculated Bayes-optimal ceiling of 0.7945* — no model,
  however perfect, can exceed that on this data. Both the 1,000- and 2,500-student runs land
  within ~7–10% of that ceiling.
- **More data made things slightly worse, not better** (0.7363 → 0.7176). This rules out
  "we just needed more synthetic students" as the fix; the bottleneck is the noise ceiling and
  possibly a training-schedule mismatch (more students means proportionally more gradient
  updates per epoch against a schedule that wasn't rescaled for it), not sample size.
- **Cold-start belief (step 0 of any sequence) has a *provable* mathematical floor at AUC =
  0.5000 exactly** — verified directly: at step 0 every student's hidden state is literally
  identical (all zeros), so the model gives every student the exact same prediction
  (confirmed: only 1 unique predicted value across 250 validation students at step 0). No
  amount of retraining can fix this — it's an information-theoretic limit, not a bug. In
  practice this barely matters for real students, because placement seeds 7 real interactions
  before the main loop ever runs, so the tracker is never actually queried at true step 0
  during real use.
- A separate attempt to fix cold-start specifically (upweighting the loss on early steps,
  fine-tuning from the epoch-4 checkpoint for 10 more epochs) made cold-start AUC *worse*, not
  better, consistent with the step-0 floor being mathematically unfixable — that fine-tune was
  abandoned and the checkpoint was left unchanged (its own safety logic never accepted a worse
  result).

---

## 5. PPO Remediation Agent — training results (honest, all five attempts)

**The core proposal claim to validate:** the RL agent should beat a naive linear/fixed-order
curriculum on steps-to-mastery. **This has not yet been achieved**, across five real attempts,
each with a different hypothesis:

| Attempt | Change made | Result (seeded/paired eval unless noted) |
|---|---|---|
| Baseline | Original training (~503k timesteps), belief-only 25-dim observation | ~12–16% success / ~108 steps — roughly *tied* with linear_curriculum, less efficient |
| Imitation warm-start | Pretrain on a "weakest belief" expert before RL fine-tuning | **Worse**: 5–8% success — the expert itself was later found to be structurally broken (see §6) |
| Entropy-decay | Re-inject exploration then anneal it, continuing from the baseline checkpoint | Abandoned mid-run once a deeper root cause was found (see §6); reward trend didn't clearly improve before being superseded |
| Structural fix (visit-count + prereq-attempted features, blocked-concept penalty) | Fresh 300k-timestep retrain with a 75-dim observation | 12% success (unseeded) — but the **paired/seeded re-check reversed this**: 7% vs. linear_curriculum's 15% |
| Coverage-bonus fix (reward a concept's first visit each episode) | Fresh 300k-timestep retrain on top of the structural fix | 8% success / 99.75 steps / 0.299 mastery vs. linear_curriculum's 15% / 77.7 steps / 0.310 — **still behind on every metric** |

**The single most important methodological finding:** early "wins" measured with independent
unseeded 100-episode samples were **not reproducible** under a same-seed paired comparison
(the only statistically trustworthy method here, given success rates this low have large
sampling error). A result reported as a win in this project was later shown to be noise, and
that correction is documented rather than hidden.

**What *is* proven to work — just not by PPO yet:** a hand-coded, zero-training heuristic
("pick the least-visited concept among those whose prerequisites have been attempted," using
the same ground-truth features PPO was given) **ties linear_curriculum on success rate and
beats it by 14% on speed** (67.1 vs 77.7 steps). This proves the *target behavior is genuinely
achievable* in this environment — PPO has the right information and the right incentive, and
still isn't learning to replicate a simple, correct, human-designed rule. That is a real,
open, honestly-reported gap, and the most promising next step identified is imitation
learning from *this* validated heuristic (not the earlier broken one).

---

## 6. Diagnosed bugs — the actual debugging story (strong defense material)

These are real root-cause investigations, each with reproducible evidence, not guesses:

1. **The zero-mastery trap.** A naive "always target the lowest-belief concept" policy can get
   permanently stuck: traced directly, it picked "Arguments" for 14 consecutive steps with
   reward flat at exactly −0.08 every single time, because that concept's true-mastery ceiling
   was 0 (its prerequisite chain was entirely untouched) and nothing in the observation could
   tell the policy that. **Fix:** added `prereq_attempted` (ground-truth, not belief-based) and
   `visit_count` to the observation, plus a distinct `BLOCKED_PENALTY` so "impossible right now"
   and "already mastered" no longer produce an identical, indistinguishable reward.
2. **Cold-start AUC's mathematical floor**, proven directly (see §4) — an actual proof, not an
   assumption, that step-0 predictions are structurally incapable of beating AUC 0.5.
3. **Why PPO still loses after the structural fix**: traced real episodes side-by-side against
   `linear_curriculum` on identical simulated students. `linear_curriculum` visits *every*
   concept exactly 6 times per 150-step episode (a mathematical guarantee of its fixed
   round-robin order). PPO instead concentrates 2–3× the average attention on a handful of
   concepts (12–14 visits) while starving others — a genuine, evidenced diagnosis of *why* a
   richer state alone wasn't enough, which directly motivated the coverage-bonus fix.
4. **Placement quiz inconsistency** (found during live use, not scripted testing): the
   placement summary reported weakness in "Nested Loops," "Loop Control," and "Error Handling"
   despite never asking about loops at all. Root cause: the Dual-GCN's 2-hop graph propagation
   means untested concepts *do* get a real, personalized belief inferred from tested
   prerequisites — but "For Loops" (2 hops from Nested Loops) wasn't in the placement set, so
   Nested Loops' inferred belief was just the model's generic cold-start prior, not a real
   personalized read. **Fix:** added "For Loops" to `PLACEMENT_CONCEPTS` (6 → 7 concepts),
   bringing Nested Loops within 2-hop range, verified end-to-end (Nested Loops' belief changed
   from a static prior to a personalized 51% reflecting actual For Loops performance).
5. **Content-reuse bug**: several related concepts deliberately share one real curated video
   (e.g., While Loops / For Loops / Loop Control / Nested Loops all point at the same "Loops
   and Iterations" video) — correct the first time, but replaying the *identical* video under
   a second concept name read as a broken repeat, not deliberate reuse. **Fix:**
   `_already_shown_reuse()` detects this and falls through to a fresh practice question instead,
   with explicit messaging ("covered by the same material you already saw for X").

---

## 7. Making the app demo-safe (offline question bank)

The live app originally either called Gemini live (network-dependent, a few seconds of visible
lag, risk of a malformed question landing live) or fell back to obvious placeholder text
("[MOCK #1234] Sample question about X") — neither acceptable in front of an audience.

**Built:** `build_question_bank.py` pre-generates 250 real, Gemini-authored questions (25
concepts × 4 easy / 3 medium / 3 hard) into a static JSON file, served with zero live API calls
via a new `USE_QUESTION_BANK` mode in `question_generator.py`. Existing grading, difficulty
tiering, and avoid-repeat logic are completely unchanged — only *where* a question comes from
changed.

**What actually happened generating it (real, worth knowing for defense):**
- First attempt crashed at question 6/250 — hit a **5 requests/minute** free-tier rate limit
  on `gemini-2.5-flash`. Fixed by pacing calls at 13s apart and adding incremental
  save-after-every-question (a crash now loses at most one call, not the whole run).
- Second attempt crashed at question 16/250 — hit a **completely different, much stricter
  quota**: only 20 requests/day for that model on this key. Diagnosed via the actual API error
  message, which also confirmed the key is genuinely on the free tier (this was directly
  useful to answer "will this cost money" — yes, free, just quota-limited).
- **Pivoted to `gemini-3.5-flash-lite`** (the model Google's own API pointed to when
  `gemini-2.5-flash` returned a deprecation error) — verified it had separate, available quota,
  and completed all 250 questions successfully. Both the bank generator and the live serving
  code were updated to this current model.
- **Verified quality directly**: spot-checked questions are genuine code-tracing exercises
  with correct answers and correct explanations (e.g., a nested-loop counting question, a
  recursive-factorial trace, a file-write-mode question) — not shallow definition recall.

**Full end-to-end verification performed** (not just "it ran"): a scripted test answered a mix
of deliberately correct and deliberately incorrect real bank questions and confirmed, with
exact numbers: every correct answer increased belief, every incorrect answer decreased it, two
real fails on the same concept correctly triggered escalation (with the right explanation text)
and stayed escalated on every subsequent visit, the session round-cap paused correctly with an
honest progress message, and the dashboard matched the loop's numbers exactly except for a
small, *expected* drift explained by genuine 2-hop graph propagation from later interactions.

---

## 8. What's genuinely achieved vs. what's genuinely still open

**Achieved and verified working, end-to-end, live:**
- Full Knowledge Graph (25 concepts, real prerequisite structure, used for topological
  ordering, 2-hop propagation, and "why" explanations)
- Dual-GCN tracker: trained, dual-stream positive/negative architecture, GRU state, real-time
  inference
- PPO agent: trained, integrated, genuinely adaptive (reads live belief, picks a concept)
- Full FastAPI backend, every endpoint, real database persistence
- Full React frontend: placement → block picker → adaptive loop (video/quiz/escalation) →
  dashboard, responsive on desktop and mobile, live-tested including escalation and mobile
  viewports
- Real LLM-based quiz generation and grading, now demo-safe via an offline bank
- Multiple real, evidenced bug diagnoses and fixes (not just features — actual debugging depth)

**Honestly still open:**
- Tracker AUC below the proposal's 0.80 target (proven ceiling-limited at ~0.79, not a fixable
  implementation gap)
- PPO does not yet beat the linear-curriculum baseline (a validated non-PPO heuristic proves
  the target behavior is achievable; PPO itself hasn't learned it yet — most promising next
  step: imitation learning from that validated heuristic)

---

## 9. Suggested framing for the presentation

This project's strongest defense angle is not "everything works perfectly" — it's
**"a fully-built, fully-working neuro-symbolic pipeline, with rigorous, evidenced diagnosis of
exactly where and why the two remaining performance targets aren't met yet, and a validated
path forward for the open one."** The debugging log in §6 in particular demonstrates real
understanding of the system, not just assembly of parts — each fix started from a concrete,
reproducible symptom, not a guess.
