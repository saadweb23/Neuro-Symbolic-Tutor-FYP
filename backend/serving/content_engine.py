import uuid

import numpy as np
import torch

from knowledge_graph.graph_builder import (
    CONCEPTS, CONCEPT_TO_ID, CONCEPT_BLOCKS, analyze_failure_dependencies, build_python_dag,
)
from serving import persistence
from serving import inference
from serving import question_generator
from serving.placement_quiz import load_or_rebuild_state, placement_completed

# ---------------------------------------------------------------------------
# Real content bank for videos and deep-dives. Every URL below was looked up
# and confirmed to be an actual, existing resource (not generated/guessed):
#   - Videos: mostly Corey Schafer's "Python Tutorial for Beginners" series
#     (individual video titles/IDs confirmed via search), plus two topic
#     videos from other channels for Recursion and List Comprehensions where
#     Schafer's series doesn't have a dedicated video.
#   - Deep dive (escalation): official Python documentation tutorial
#     chapters (docs.python.org) -- stable and authoritative.
# Practice questions, below, are LLM-generated per attempt instead of drawn
# from a fixed bank -- that's where per-student variety actually matters;
# videos and deep-dives stay curated, since foundational instruction
# benefits from a vetted source more than from novelty.
# ---------------------------------------------------------------------------

VIDEO_BANK = {
    "Syntax": ("Python Tutorial for Beginners 1: Install and Setup", "https://www.youtube.com/watch?v=YYXdXT2l-Gg"),
    "Primitive Data Types": ("Python Tutorial for Beginners 3: Integers and Floats", "https://www.youtube.com/watch?v=khKv-8q7YmY"),
    "Variables": ("Python Tutorial for Beginners 2: Strings - Working with Textual Data", "https://www.youtube.com/watch?v=k9TUPpGqYTo"),
    "Arithmetic Operators": ("Python Tutorial for Beginners 3: Integers and Floats", "https://www.youtube.com/watch?v=khKv-8q7YmY"),
    "Relational Operators": ("Python Tutorial for Beginners 6: Conditionals and Booleans", "https://www.youtube.com/watch?v=DZwmZ8Usvnk"),
    "Conditionals": ("Python Tutorial for Beginners 6: Conditionals and Booleans", "https://www.youtube.com/watch?v=DZwmZ8Usvnk"),
    "While Loops": ("Python Tutorial for Beginners 7: Loops and Iterations", "https://www.youtube.com/watch?v=6iF8Xb7Z3wQ"),
    "For Loops": ("Python Tutorial for Beginners 7: Loops and Iterations", "https://www.youtube.com/watch?v=6iF8Xb7Z3wQ"),
    "Loop Control": ("Python Tutorial for Beginners 7: Loops and Iterations", "https://www.youtube.com/watch?v=6iF8Xb7Z3wQ"),
    "Nested Loops": ("Python Tutorial for Beginners 7: Loops and Iterations", "https://www.youtube.com/watch?v=6iF8Xb7Z3wQ"),
    "Lists": ("Python Tutorial for Beginners 4: Lists, Tuples, and Sets", "https://www.youtube.com/watch?v=W8KRzm-HUcc"),
    "List Methods": ("Python Tutorial for Beginners 4: Lists, Tuples, and Sets", "https://www.youtube.com/watch?v=W8KRzm-HUcc"),
    "Tuples": ("Python Tutorial for Beginners 4: Lists, Tuples, and Sets", "https://www.youtube.com/watch?v=W8KRzm-HUcc"),
    "Sets": ("Python Tutorial for Beginners 4: Lists, Tuples, and Sets", "https://www.youtube.com/watch?v=W8KRzm-HUcc"),
    "Dictionaries": ("Python Tutorial for Beginners 5: Dictionaries", "https://www.youtube.com/watch?v=daefaLgNkw0"),
    "Function Definition": ("Python Tutorial for Beginners 8: Functions", "https://www.youtube.com/watch?v=9Os0o3wzS_I"),
    "Arguments": ("Python Tutorial for Beginners 8: Functions", "https://www.youtube.com/watch?v=9Os0o3wzS_I"),
    "Return Values": ("Python Tutorial for Beginners 8: Functions", "https://www.youtube.com/watch?v=9Os0o3wzS_I"),
    "Variable Scope": ("Python Tutorial for Beginners 8: Functions", "https://www.youtube.com/watch?v=9Os0o3wzS_I"),
    "Recursion": ("Python For Beginners - Recursion Explained", "https://www.youtube.com/watch?v=cuTZj6xEgds"),
    "String Manipulation": ("Python Tutorial for Beginners 2: Strings - Working with Textual Data", "https://www.youtube.com/watch?v=k9TUPpGqYTo"),
    "Error Handling": ("Python Tutorial: Using Try/Except Blocks for Error Handling", "https://www.youtube.com/watch?v=NIWwJbo-9_8"),
    "File IO": ("Python Tutorial: File Objects - Reading and Writing to Files", "https://www.youtube.com/watch?v=Uh2ebFW8OYM"),
    "List Comprehensions": ("List Comprehension Basics with Python", "https://www.youtube.com/watch?v=5K08WcjGV6c"),
    "Modules": ("Python Tutorial for Beginners 9: Import Modules and Exploring The Standard Library", "https://www.youtube.com/watch?v=CqvZ3vGoGs0"),
}

DEEP_DIVE_BANK = {
    "Syntax": "https://docs.python.org/3/tutorial/introduction.html",
    "Primitive Data Types": "https://docs.python.org/3/tutorial/introduction.html",
    "Variables": "https://docs.python.org/3/tutorial/introduction.html",
    "Arithmetic Operators": "https://docs.python.org/3/tutorial/introduction.html",
    "Relational Operators": "https://docs.python.org/3/tutorial/controlflow.html",
    "Conditionals": "https://docs.python.org/3/tutorial/controlflow.html",
    "While Loops": "https://docs.python.org/3/tutorial/controlflow.html",
    "For Loops": "https://docs.python.org/3/tutorial/controlflow.html",
    "Loop Control": "https://docs.python.org/3/tutorial/controlflow.html",
    "Nested Loops": "https://docs.python.org/3/tutorial/controlflow.html",
    "Lists": "https://docs.python.org/3/tutorial/datastructures.html",
    "List Methods": "https://docs.python.org/3/tutorial/datastructures.html",
    "Tuples": "https://docs.python.org/3/tutorial/datastructures.html",
    "Sets": "https://docs.python.org/3/tutorial/datastructures.html",
    "Dictionaries": "https://docs.python.org/3/tutorial/datastructures.html",
    "Function Definition": "https://docs.python.org/3/tutorial/controlflow.html#defining-functions",
    "Arguments": "https://docs.python.org/3/tutorial/controlflow.html#more-on-defining-functions",
    "Return Values": "https://docs.python.org/3/tutorial/controlflow.html#defining-functions",
    "Variable Scope": "https://docs.python.org/3/tutorial/classes.html#python-scopes-and-namespaces",
    "Recursion": "https://docs.python.org/3/tutorial/controlflow.html#defining-functions",
    "String Manipulation": "https://docs.python.org/3/tutorial/introduction.html#strings",
    "Error Handling": "https://docs.python.org/3/tutorial/errors.html",
    "File IO": "https://docs.python.org/3/tutorial/inputoutput.html",
    "List Comprehensions": "https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions",
    "Modules": "https://docs.python.org/3/tutorial/modules.html",
}

# Escalate to a worked explanation after this many failures on the same concept
ESCALATION_THRESHOLD = 2

# Matches TutoringEnv.MASTERY_THRESHOLD exactly -- PPO was trained to end an
# episode once average belief across all 25 concepts crosses this line, so
# the deployed loop has to honor the same finish line, or the agent is
# chasing a goal the app never actually lets it reach.
MASTERY_THRESHOLD = 0.65

# Average-only completion is gameable by averaging: a handful of strong
# concepts can drag the mean over MASTERY_THRESHOLD while others are still
# untouched. Requiring every concept to individually clear this floor too
# means "complete" actually means "nothing left glaringly weak", not just
# "the mean looks fine".
MIN_CONCEPT_FLOOR = 0.5

# Evidence guard: a concept can only count towards "complete" / "block_complete" once the
# student has answered at least one question on it (placement answers count; merely marking a
# video or article as watched does not). The tracker also
# propagates belief to concepts the student never touched (that is the point of the prerequisite
# graph), but belief that was only inferred from neighbours is not allowed to finish a block.
# Without this, a strong placement result can mark a block "complete" at round 0.
MIN_ATTEMPTS_FOR_COMPLETION = 1

ESCALATION_INTROS = [
    "Here's a different explanation, worked step by step.",
    "Let's slow down and go through this a different way.",
    "Time for a deeper look, straight from the official documentation.",
]

# A session is scoped to one 5-concept curriculum block instead of the full
# 25, so its own average moves ~5x faster per round than the full-curriculum
# one -- a session can realistically reach MASTERY_THRESHOLD within this many
# rounds. If it doesn't, the session soft-pauses instead of running forever.
SESSION_ROUND_CAP_DEFAULT = 15


def attempted_concepts(student_id, db_path=persistence.DEFAULT_DB_PATH):
    """{concept: number of questions answered}, from the interactions table. Placement and
    practice answers count; video / deep-dive "viewed" rows do not (they are not evidence)."""
    conn = persistence.init_db(db_path)
    history = persistence.get_interaction_history(conn, student_id)
    conn.close()
    counts = {}
    for h in history:
        cid = h.get("content_id") or ""
        if cid.endswith("-video") or cid.endswith("-deepdive"):
            continue
        counts[h["concept"]] = counts.get(h["concept"], 0) + 1
    return counts


def _all_attempted(concepts, attempts):
    """True when every concept has enough direct evidence. `attempts=None` disables the guard."""
    if attempts is None:
        return True
    return all(attempts.get(c, 0) >= MIN_ATTEMPTS_FOR_COMPLETION for c in concepts)


def get_block_progress(beliefs, attempts=None):
    """Per-block average/weakest belief, recomputed live from current
    beliefs every call -- no separate "completed blocks" history needs to be
    stored, since re-deriving it from current state is just as cheap and
    can't go stale. `attempts` ({concept: count}) enables the evidence guard."""
    progress = []
    for index, block in enumerate(CONCEPT_BLOCKS):
        block_beliefs = [(c, beliefs[c]) for c in block["concepts"]]
        avg = sum(b for _, b in block_beliefs) / len(block_beliefs)
        weakest_concept, weakest_belief = min(block_beliefs, key=lambda kv: kv[1])
        progress.append({
            "index": index,
            "name": block["name"],
            "concepts": block["concepts"],
            "average_mastery": avg,
            "weakest_concept": weakest_concept,
            "weakest_belief": weakest_belief,
            "complete": (avg >= MASTERY_THRESHOLD and weakest_belief >= MIN_CONCEPT_FLOOR
                         and _all_attempted(block["concepts"], attempts)),
        })
    return progress


def _ppo_probs_within(ppo_model, obs, allowed_indices):
    """PPO's own action probabilities over all 25 concepts, masked to `allowed_indices` and
    renormalised. Pure read: used both for sampling (/next) and for the side-effect-free
    recommendation preview."""
    device = ppo_model.policy.device
    obs_tensor = torch.as_tensor(obs, device=device).unsqueeze(0)
    with torch.no_grad():
        dist = ppo_model.policy.get_distribution(obs_tensor)
        probs = dist.distribution.probs[0].clone()
    mask = torch.zeros_like(probs, dtype=torch.bool)
    mask[allowed_indices] = True
    probs = probs * mask
    return probs / probs.sum()


def _ppo_recommend_within(ppo_model, obs, allowed_indices):
    """Samples from PPO's own learned action distribution over all 25
    concepts, masked down to `allowed_indices` (the current session's
    block). This still uses exactly what the trained policy learned to
    prefer -- it's restricted to a valid subset, not overridden by a hand
    rule -- so a block-scoped session doesn't change what "using the RL
    agent" means, only which slice of its output is eligible to act on.
    Sampled (not argmax) to match ppo_policy_fn's deterministic=False
    convention elsewhere in this codebase.
    """
    probs = _ppo_probs_within(ppo_model, obs, allowed_indices)
    return int(torch.multinomial(probs, 1).item())


def _slug(concept):
    return concept.lower().replace(" ", "-")


def _build_static_bank():
    bank = {}
    for concept in CONCEPTS:
        slug = _slug(concept)
        video_title, video_url = VIDEO_BANK[concept]
        bank[concept] = {
            "video": {"id": f"{slug}-video", "title": video_title, "url": video_url, "source": "YouTube"},
            "deep_dive": {"id": f"{slug}-deepdive", "title": f"{concept}: official documentation",
                          "url": DEEP_DIVE_BANK[concept], "source": "Python Docs"},
        }
    return bank


CONTENT_BANK = _build_static_bank()


def select_content_type(concept_history):
    """Pure rule-based decision -- no ML. `concept_history` is this
    student's past attempts at ONE concept only, oldest first.

    Failures are counted only SINCE the student last read this concept's deep-dive. Reading
    the deep-dive is the remediation for the failures before it; without this reset a
    concept that had ever reached ESCALATION_THRESHOLD failures returned "escalation" on
    every later visit (a viewed deep-dive logs as a pass, so it never lowered the count) and
    the student could never get a practice question on it again."""
    if not concept_history:
        return "video"
    n_fails = 0
    for a in concept_history:
        cid = a.get("content_id") or ""
        if cid.endswith("-deepdive"):
            n_fails = 0
        elif not a["passed"]:
            n_fails += 1
    if n_fails >= ESCALATION_THRESHOLD:
        return "escalation"
    return "practice_problem"


def _already_shown_reuse(concept, content_kind, full_history):
    """VIDEO_BANK/DEEP_DIVE_BANK deliberately point several related concepts
    at the same real source -- e.g. one video covers While Loops, For
    Loops, Loop Control, and Nested Loops. That's fine the first time, but
    if the agent visits a second concept sharing that source, re-serving
    the identical player/link reads to the student as a repeat bug, not
    deliberate reuse.

    Returns the name of the other concept this exact URL was already shown
    under, if any, so the caller can skip straight to a practice question
    instead of replaying/relinking the same source.
    """
    suffix = "-video" if content_kind == "video" else "-deepdive"
    target_url = CONTENT_BANK[concept][content_kind]["url"]
    for h in full_history:
        content_id = h.get("content_id")
        if not content_id or not content_id.endswith(suffix):
            continue
        other_concept = h["concept"]
        if other_concept != concept and CONTENT_BANK[other_concept][content_kind]["url"] == target_url:
            return other_concept
    return None


def _weakest_prerequisite(graph, concept, beliefs):
    """Among a concept's ancestors in the KG, the one the tracker currently
    believes the student is weakest on -- used to explain WHY a concept is
    hard, not just THAT it is."""
    ancestors = analyze_failure_dependencies(graph, concept)
    if not ancestors:
        return None
    return min(ancestors, key=lambda c: beliefs.get(c, 1.0))


def build_explanation(concept, content_type, graph, beliefs, difficulty=None, attempt_number=0,
                       reused_from=None):
    concept_belief = beliefs.get(concept, 0.0)
    weak_prereq = _weakest_prerequisite(graph, concept, beliefs)
    article = "an" if difficulty == "easy" else "a"

    if content_type == "video":
        return f"You haven't covered {concept} yet -- starting with a short video."

    if content_type == "escalation":
        intro = ESCALATION_INTROS[attempt_number % len(ESCALATION_INTROS)]
        text = f"You've struggled with {concept} more than once (currently ~{concept_belief:.0%} mastery)."
        if weak_prereq is not None:
            text += f" This often traces back to a weaker foundation in {weak_prereq}."
        return f"{text} {intro}"

    # practice_problem (MCQ)
    if reused_from is not None:
        return (f"{concept} is covered by the same material you already saw for {reused_from} -- "
                f"skipping straight to {article} {difficulty} question to check your grasp.")
    if weak_prereq is not None and beliefs.get(weak_prereq, 1.0) < 0.5:
        return (f"Here's {article} {difficulty} question on {concept} -- keep an eye on {weak_prereq}, "
                f"which this concept depends on and looks shaky.")
    return f"Here's {article} {difficulty} question to check your grasp of {concept}."


def _generate_practice_question(conn, student_id, concept, beliefs):
    """Builds a fresh LLM-generated MCQ, difficulty-tiered by current belief,
    excluding anything already asked on this concept. Stores the full
    payload (including the answer) server-side -- the returned `content`
    dict deliberately omits correct_index/explanation so callers never leak
    the answer to whatever renders it.
    """
    difficulty = question_generator.difficulty_for_belief(beliefs[concept])
    avoid = persistence.get_asked_question_texts(conn, student_id, concept)
    mcq = question_generator.generate_mcq(concept, difficulty, avoid_questions=avoid)

    content_id = f"{_slug(concept)}-mcq-{uuid.uuid4().hex[:8]}"
    persistence.save_generated_question(conn, content_id, concept, difficulty, mcq)

    content = {
        "id": content_id,
        "type": "mcq",
        "question": mcq["question"],
        "choices": mcq["choices"],
        "difficulty": difficulty,
        "source": "Gemini (LLM-generated)",
    }
    return content, difficulty


VISIT_COUNT_CAP = 10  # must match TutoringEnv.VISIT_COUNT_CAP


def _build_observation(beliefs, history, graph):
    """Mirrors TutoringEnv._observe()'s [belief | prereq_attempted |
    visit_count] observation layout exactly, but computed from real logged
    interaction history instead of an episode's in-memory visit counts --
    the serving-side equivalent of what the simulator tracks during
    training, so PPO sees the same observation shape/semantics here that it
    was trained on. Both prereq_attempted and visit_count are ground-truth
    bookkeeping (just counts over logged interactions), not tracker
    predictions, so unlike belief they aren't subject to cold-start
    miscalibration."""
    visit_counts = {c: 0 for c in CONCEPTS}
    for h in history:
        if h["concept"] in visit_counts:
            visit_counts[h["concept"]] += 1

    prereqs = {c: list(graph.predecessors(c)) for c in CONCEPTS}
    belief = np.array([beliefs[c] for c in CONCEPTS], dtype=np.float32)
    prereq_attempted = np.array([
        1.0 if all(visit_counts[p] > 0 for p in prereqs[c]) else 0.0
        for c in CONCEPTS
    ], dtype=np.float32)
    visit_count_norm = np.array([
        min(visit_counts[c], VISIT_COUNT_CAP) / VISIT_COUNT_CAP
        for c in CONCEPTS
    ], dtype=np.float32)
    return np.concatenate([belief, prereq_attempted, visit_count_norm])


def recommend_content(student_id, ppo_model, db_path=persistence.DEFAULT_DB_PATH,
                       tracker_checkpoint_path=inference.DEFAULT_CHECKPOINT):
    """The full remediation step: read the student's current state, ask PPO
    which concept to focus on, then decide how to teach it. Returns a dict
    ready to hand to an API/frontend layer. For "practice_problem" this
    contains an MCQ with NO answer key -- grade it via submit_mcq_answer()
    once the student responds, don't grade it locally.

    Returns content_type="complete" instead of a PPO recommendation once
    average belief crosses MASTERY_THRESHOLD -- the same finish line
    TutoringEnv trained PPO against -- so the loop has an actual end instead
    of recommending forever.

    Otherwise, requires an active session (see persistence.start_session) --
    a student picks one of the 5 curriculum blocks to focus on, and this
    scopes PPO's recommendation to that block's 5 concepts, whose own
    average moves ~5x faster than the full-curriculum one. Returns
    content_type="no_session" if none is active (caller should route to a
    block picker), "block_complete" once the block's own bar is cleared, or
    "session_paused" once its round cap is hit without clearing it -- either
    way, a session always ends within a bounded number of rounds instead of
    recommending forever.
    """
    tracker, edge_index, h_t = load_or_rebuild_state(student_id, db_path, tracker_checkpoint_path)
    beliefs = inference.get_mastery_beliefs(tracker, h_t)

    avg_mastery = sum(beliefs.values()) / len(beliefs)
    weakest = sorted(beliefs.items(), key=lambda kv: kv[1])[:3]
    min_concept, min_belief = weakest[0]
    attempts = attempted_concepts(student_id, db_path)

    if (avg_mastery >= MASTERY_THRESHOLD and min_belief >= MIN_CONCEPT_FLOOR
            and _all_attempted(CONCEPTS, attempts)):
        return {
            "concept": None,
            "content_type": "complete",
            "content": {
                "average_mastery": avg_mastery,
                "weakest_concepts": [{"concept": c, "belief": b} for c, b in weakest],
            },
            "explanation": (
                f"Average mastery has reached {avg_mastery:.0%} (target: {MASTERY_THRESHOLD:.0%}) "
                f"and every concept individually clears {MIN_CONCEPT_FLOOR:.0%} -- weakest is "
                f"{min_concept} at {min_belief:.0%}. You've completed this run -- check the "
                "dashboard for the full breakdown."
            ),
            "mastery_belief": avg_mastery,
        }

    conn = persistence.init_db(db_path)
    session = persistence.get_session(conn, student_id)
    if session is None:
        conn.close()
        return {
            "concept": None,
            "content_type": "no_session",
            "content": None,
            "explanation": "Choose a focus area to start this session.",
            "mastery_belief": avg_mastery,
        }

    block = CONCEPT_BLOCKS[session["block_index"]]
    block_beliefs = [(c, beliefs[c]) for c in block["concepts"]]
    block_avg = sum(b for _, b in block_beliefs) / len(block_beliefs)
    block_weakest, block_min = min(block_beliefs, key=lambda kv: kv[1])

    if (block_avg >= MASTERY_THRESHOLD and block_min >= MIN_CONCEPT_FLOOR
            and _all_attempted(block["concepts"], attempts)):
        persistence.clear_session(conn, student_id)
        conn.close()
        return {
            "concept": None,
            "content_type": "block_complete",
            "content": {
                "block_index": session["block_index"],
                "block_name": block["name"],
                "average_mastery": block_avg,
                "weakest_concept": block_weakest,
                "weakest_belief": block_min,
            },
            "explanation": (
                f"{block['name']} has reached {block_avg:.0%} average mastery (target: "
                f"{MASTERY_THRESHOLD:.0%}), and every concept in it clears {MIN_CONCEPT_FLOOR:.0%} -- "
                f"weakest is {block_weakest} at {block_min:.0%}. Pick another block to keep going."
            ),
            "mastery_belief": block_avg,
        }

    if session["round_count"] >= session["round_cap"]:
        conn.close()
        return {
            "concept": None,
            "content_type": "session_paused",
            "content": {
                "block_index": session["block_index"],
                "block_name": block["name"],
                "average_mastery": block_avg,
                "weakest_concept": block_weakest,
                "weakest_belief": block_min,
                "round_count": session["round_count"],
                "round_cap": session["round_cap"],
            },
            "explanation": (
                f"{session['round_count']} rounds in on {block['name']} -- average mastery is "
                f"{block_avg:.0%} (target: {MASTERY_THRESHOLD:.0%}), not there yet. Keep going or "
                "switch focus -- your progress either way is saved."
            ),
            "mastery_belief": block_avg,
        }

    full_history = persistence.get_interaction_history(conn, student_id)
    graph = build_python_dag()

    block_indices = [CONCEPT_TO_ID[c] for c in block["concepts"]]
    obs = _build_observation(beliefs, full_history, graph)
    action = _ppo_recommend_within(ppo_model, obs, block_indices)
    concept = CONCEPTS[action]

    concept_history = [h for h in full_history if h["concept"] == concept]

    content_type = select_content_type(concept_history)

    # video/escalation content banks deliberately reuse one real source
    # across several related concepts (see _already_shown_reuse) -- if
    # this student already saw it under a different concept, replaying it
    # verbatim reads as a bug, so fall through to a fresh practice question.
    reused_from = None
    if content_type in ("video", "escalation"):
        bank_kind = "video" if content_type == "video" else "deep_dive"
        reused_from = _already_shown_reuse(concept, bank_kind, full_history)
        if reused_from is not None:
            content_type = "practice_problem"

    difficulty = None
    if content_type == "practice_problem":
        content, difficulty = _generate_practice_question(conn, student_id, concept, beliefs)
    else:
        bank_entry = CONTENT_BANK[concept]
        content = bank_entry["video"] if content_type == "video" else bank_entry["deep_dive"]

    explanation = build_explanation(concept, content_type, graph, beliefs,
                                     difficulty=difficulty, attempt_number=len(concept_history),
                                     reused_from=reused_from)
    persistence.increment_session_round(conn, student_id)
    conn.close()

    return {
        "concept": concept,
        "content_type": content_type,
        "content": content,
        "explanation": explanation,
        "mastery_belief": beliefs[concept],
        # How many times this concept has been attempted before, so a caller
        # can show belief as accumulated evidence rather than implying one
        # question just certified (or failed) mastery outright.
        "attempt_number": len(concept_history),
        "block": {
            "index": session["block_index"],
            "name": block["name"],
            "average_mastery": block_avg,
            "round_count": session["round_count"] + 1,
            "round_cap": session["round_cap"],
        },
    }


def submit_mcq_answer(student_id, content_id, selected_index, time_taken,
                       db_path=persistence.DEFAULT_DB_PATH,
                       tracker_checkpoint_path=inference.DEFAULT_CHECKPOINT):
    """Grades a student's response to an MCQ served by recommend_content(),
    logs the interaction, and advances the tracker's state. This is the
    counterpart to _generate_practice_question -- the answer key never left
    the server, so grading has to happen here, not on the client.
    """
    conn = persistence.init_db(db_path)
    question_payload = persistence.get_generated_question(conn, content_id)
    if question_payload is None:
        conn.close()
        raise ValueError(f"No generated question found for content_id={content_id}")

    concept = question_payload["concept"]

    # Idempotency guard: a duplicate request for a content_id already graded
    # (e.g. a double-tap on Submit before the button disables, on a slow
    # connection) must not log a second interaction -- that would apply this
    # one answer's belief update twice, and worse, propagate it twice across
    # the knowledge graph to every 1-2 hop neighbor (see DualGCNTracker).
    # Replay the FIRST recorded outcome rather than re-grading against
    # whatever selected_index this duplicate call happens to carry.
    existing = persistence.get_interaction_by_content_id(conn, student_id, content_id)
    if existing is not None:
        passed = existing["passed"]
    else:
        passed = question_generator.grade_mcq(question_payload, selected_index)
        persistence.ensure_student(conn, student_id)
        persistence.log_interaction_next(conn, student_id, concept, passed, time_taken,
                                          source='tutoring', content_id=content_id,
                                          selected_index=selected_index)
    conn.close()

    tracker, edge_index, h_t = load_or_rebuild_state(student_id, db_path, tracker_checkpoint_path)
    return {
        "concept": concept,
        "passed": bool(passed),
        "correct_index": question_payload["correct_index"],
        "explanation": question_payload["explanation"],
        "updated_belief": inference.get_mastery_beliefs(tracker, h_t)[concept],
    }


def log_content_viewed(student_id, concept, content_id, time_taken,
                       db_path=persistence.DEFAULT_DB_PATH):
    """Logs that a student viewed a video / deep-dive served by recommend_content().

    Validates that `concept` is real and that `content_id` is that concept's own video or
    deep-dive id (a client can't invent rows). Idempotent against double-taps:
    - a video is only ever served once per concept, so a repeat of the same id is a duplicate;
    - a deep-dive can legitimately be served again later (after further failures), so a repeat
      only counts as a duplicate while it is still the student's most recent interaction.
    Returns True when a row was written, False when it was a duplicate."""
    if concept not in CONCEPT_TO_ID:
        raise ValueError(f"Unknown concept: {concept}")
    entry = CONTENT_BANK[concept]
    valid_ids = {entry["video"]["id"], entry["deep_dive"]["id"]}
    if content_id not in valid_ids:
        raise ValueError(f"content_id {content_id!r} is not a video or deep-dive for {concept}")

    conn = persistence.init_db(db_path)
    persistence.ensure_student(conn, student_id)
    if content_id.endswith("-video"):
        duplicate = persistence.get_interaction_by_content_id(conn, student_id, content_id) is not None
    else:
        latest = persistence.get_latest_interaction(conn, student_id)
        duplicate = latest is not None and latest["content_id"] == content_id
    if not duplicate:
        # Video/deep-dive content has no inherent pass/fail -- logged as passed=1 so it still
        # advances the tracker's hidden state as a "covered" event.
        persistence.log_interaction_next(conn, student_id, concept, 1, time_taken,
                                          source="tutoring", content_id=content_id)
    conn.close()
    return not duplicate


def pick_suggested_block(block_progress):
    """The incomplete block with the lowest average mastery (ties: curriculum order)."""
    incomplete = [b for b in block_progress if not b["complete"]]
    pool = incomplete or block_progress
    return min(pool, key=lambda b: (b["average_mastery"], b["index"]))["index"]


def preview_recommendation(student_id, ppo_model, block_index=None, db_path=persistence.DEFAULT_DB_PATH,
                           tracker_checkpoint_path=inference.DEFAULT_CHECKPOINT, top_k=3):
    """Side-effect-free look at what the agent is currently inclined to do next.

    Unlike recommend_content() this NEVER increments the session round, generates or stores a
    question, or clears a session -- it only reads. It returns PPO's own (block-masked)
    probabilities for the top candidates, not a sample: the real /next samples from this same
    distribution, so the preview shows the likely next concepts, not a promise of one.
    """
    tracker, edge_index, h_t = load_or_rebuild_state(student_id, db_path, tracker_checkpoint_path)
    beliefs = inference.get_mastery_beliefs(tracker, h_t)
    attempts = attempted_concepts(student_id, db_path)
    progress = get_block_progress(beliefs, attempts)
    avg_mastery = sum(beliefs.values()) / len(beliefs)
    min_belief = min(beliefs.values())

    conn = persistence.init_db(db_path)
    session = persistence.get_session(conn, student_id)
    full_history = persistence.get_interaction_history(conn, student_id)
    conn.close()

    result = {
        "state": "ready",
        "session_active": session is not None,
        "block_index": None,
        "block_name": None,
        "suggested": False,
        "block": None,
        "candidates": [],
    }
    if (avg_mastery >= MASTERY_THRESHOLD and min_belief >= MIN_CONCEPT_FLOOR
            and _all_attempted(CONCEPTS, attempts)):
        result["state"] = "complete"
        return result

    if block_index is not None:
        chosen = block_index
    elif session is not None:
        chosen = session["block_index"]
    else:
        chosen = pick_suggested_block(progress)
        result["suggested"] = True
    block = CONCEPT_BLOCKS[chosen]
    result["block_index"] = chosen
    result["block_name"] = block["name"]
    block_info = progress[chosen]
    result["block"] = {
        "index": chosen,
        "name": block["name"],
        "average_mastery": block_info["average_mastery"],
        "round_count": session["round_count"] if session and session["block_index"] == chosen else 0,
        "round_cap": session["round_cap"] if session and session["block_index"] == chosen else SESSION_ROUND_CAP_DEFAULT,
    }

    if block_info["complete"]:
        result["state"] = "block_complete"
        return result
    if (session is not None and session["block_index"] == chosen
            and session["round_count"] >= session["round_cap"]):
        result["state"] = "session_paused"
        return result

    graph = build_python_dag()
    indices = [CONCEPT_TO_ID[c] for c in block["concepts"]]
    obs = _build_observation(beliefs, full_history, graph)
    probs = _ppo_probs_within(ppo_model, obs, indices).tolist()
    ranked = sorted(indices, key=lambda i: probs[i], reverse=True)[:top_k]

    for i in ranked:
        concept = CONCEPTS[i]
        concept_history = [h for h in full_history if h["concept"] == concept]
        content_type = select_content_type(concept_history)
        reused_from = None
        if content_type in ("video", "escalation"):
            kind = "video" if content_type == "video" else "deep_dive"
            reused_from = _already_shown_reuse(concept, kind, full_history)
            if reused_from is not None:
                content_type = "practice_problem"
        difficulty = (question_generator.difficulty_for_belief(beliefs[concept])
                      if content_type == "practice_problem" else None)
        result["candidates"].append({
            "concept": concept,
            "probability": probs[i],
            "belief": beliefs[concept],
            "attempts": attempts.get(concept, 0),
            "predicted_content_type": content_type,
            "explanation": build_explanation(concept, content_type, graph, beliefs, difficulty=difficulty,
                                             attempt_number=len(concept_history), reused_from=reused_from),
        })
    return result
