import uuid

import torch

from serving import persistence
from serving import question_generator
from serving.inference import (
    get_edge_index,
    get_tracker,
    get_mastery_beliefs,
    apply_interaction,
    model_version_from_checkpoint,
    DEFAULT_CHECKPOINT,
)


class PlacementAlreadyCompleted(Exception):
    """The student already has placement answers on record. Re-running placement would reset
    the tracker state to placement-only and silently discard later learning history."""


def placement_completed(student_id, db_path=persistence.DEFAULT_DB_PATH):
    conn = persistence.init_db(db_path)
    row = conn.execute(
        "SELECT 1 FROM interactions WHERE student_id = ? AND source = 'placement' LIMIT 1", (student_id,)
    ).fetchone()
    conn.close()
    return row is not None

# One concept per curriculum block (its earliest/most foundational node),
# plus both graph roots explicitly. Short questions instead of one give a
# real read across the whole curriculum instead of just the two roots,
# without making a new student sit through a long quiz before starting.
#
# "For Loops" is included on top of the one-per-block baseline because it's
# the only way for placement to reach "Nested Loops": that node sits 3 hops
# from every other placement concept (Conditionals -> While Loops ->
# Loop Control is already 2 hops, the tracker's propagation limit -- see
# DualGCNTracker.NUM_HOPS), so its belief was never touched by any placement
# answer and always reported the same untrained, zero-memory prior for every
# new student. "For Loops" is 1 hop from both "Loop Control" and
# "Nested Loops", so it brings both under the 2-hop radius.
PLACEMENT_CONCEPTS = [
    "Syntax",
    "Primitive Data Types",
    "Conditionals",
    "Lists",
    "Function Definition",
    "String Manipulation",
    "For Loops",
]


def generate_placement_questions(db_path=persistence.DEFAULT_DB_PATH):
    """One easy MCQ per PLACEMENT_CONCEPT, for a student with no prior
    belief yet. Returns question payloads with NO answer key."""
    conn = persistence.init_db(db_path)
    questions = []
    for concept in PLACEMENT_CONCEPTS:
        mcq = question_generator.generate_mcq(concept, difficulty="easy")
        content_id = f"{concept.lower().replace(' ', '-')}-placement-{uuid.uuid4().hex[:8]}"
        persistence.save_generated_question(conn, content_id, concept, "easy", mcq)
        questions.append({
            "content_id": content_id, "concept": concept,
            "question": mcq["question"], "choices": mcq["choices"],
        })
    conn.close()
    return questions


def submit_placement_answers(student_id, answers, db_path=persistence.DEFAULT_DB_PATH,
                              checkpoint_path=DEFAULT_CHECKPOINT):
    """Grades raw placement submissions -- {content_id, selected_index,
    time_taken} triples referring to questions generate_placement_questions()
    produced -- then feeds the graded {concept, passed, time_taken} results
    into run_placement_quiz() to seed mastery state. Mirrors the
    grade-then-log pattern in content_engine.submit_mcq_answer, but for the
    whole placement batch at once instead of one in-loop question."""
    if placement_completed(student_id, db_path):
        raise PlacementAlreadyCompleted(student_id)
    conn = persistence.init_db(db_path)
    graded = []
    for answer in answers:
        question_payload = persistence.get_generated_question(conn, answer["content_id"])
        if question_payload is None:
            conn.close()
            raise ValueError(f"No generated question found for content_id={answer['content_id']}")
        passed = question_generator.grade_mcq(question_payload, answer["selected_index"])
        graded.append({
            "concept": question_payload["concept"],
            "passed": passed,
            "time_taken": answer["time_taken"],
            "content_id": answer["content_id"],
            "selected_index": answer["selected_index"],
        })
    conn.close()
    return run_placement_quiz(student_id, graded, db_path=db_path, checkpoint_path=checkpoint_path)


def run_placement_quiz(student_id, answers, db_path=persistence.DEFAULT_DB_PATH,
                        checkpoint_path=DEFAULT_CHECKPOINT):
    """Seeds a new student's mastery state from a short placement quiz.

    `answers` is a list of {"concept", "passed", "time_taken"} dicts, one
    per entry in PLACEMENT_CONCEPTS (any order, matched by concept name).
    This function only handles the ML/persistence plumbing -- collecting
    the actual answers from a real student is the API/frontend's job.

    Returns the resulting mastery belief for every concept in the graph.
    """
    answer_by_concept = {a["concept"]: a for a in answers}
    missing = set(PLACEMENT_CONCEPTS) - set(answer_by_concept)
    if missing:
        raise ValueError(f"Missing placement answers for: {sorted(missing)}")

    tracker = get_tracker(checkpoint_path)
    edge_index = get_edge_index()

    conn = persistence.init_db(db_path)
    persistence.ensure_student(conn, student_id)

    h_t = tracker.init_state()
    step_index = persistence.get_next_step_index(conn, student_id)

    for concept in PLACEMENT_CONCEPTS:
        answer = answer_by_concept[concept]
        passed = int(answer["passed"])
        time_taken = float(answer["time_taken"])

        # content_id / selected_index are optional: placement rows written by simulation scripts
        # have no question behind them. Real placement answers carry both, which lets History
        # show the question and keeps later practice questions from repeating it.
        persistence.log_interaction(conn, student_id, step_index, concept, passed, time_taken, source='placement',
                                    content_id=answer.get("content_id"), selected_index=answer.get("selected_index"))
        h_t = apply_interaction(tracker, edge_index, h_t, concept, passed, time_taken)
        step_index += 1

    model_version = model_version_from_checkpoint(checkpoint_path)
    persistence.save_mastery_state(conn, student_id, h_t, model_version, last_step_index=step_index - 1)

    beliefs = get_mastery_beliefs(tracker, h_t)
    conn.close()
    return beliefs


def load_or_rebuild_state(student_id, db_path=persistence.DEFAULT_DB_PATH,
                           checkpoint_path=DEFAULT_CHECKPOINT):
    """Loads a student's cached mastery state, or rebuilds it by replaying
    their full interaction history if the cache is missing or was produced
    by a tracker checkpoint that's since been replaced (e.g. after a
    retrain) -- the cache is a derived optimization, `interactions` is the
    source of truth.
    """
    tracker = get_tracker(checkpoint_path)
    edge_index = get_edge_index()
    current_version = model_version_from_checkpoint(checkpoint_path)

    conn = persistence.init_db(db_path)
    cached = persistence.load_mastery_state(conn, student_id)
    latest_step_index = persistence.get_next_step_index(conn, student_id) - 1

    # Trust the cache only if it's both the current model version AND caught
    # up to the latest logged interaction -- matching model_version alone
    # isn't enough, since a new interaction can be logged (e.g. by the main
    # tutoring loop) without anyone refreshing this cache afterward.
    if (cached is not None and cached["model_version"] == current_version
            and cached["last_step_index"] == latest_step_index):
        conn.close()
        return tracker, edge_index, cached["h_t"]

    history = persistence.get_interaction_history(conn, student_id)
    h_t = tracker.init_state()
    for step in history:
        h_t = apply_interaction(tracker, edge_index, h_t, step["concept"], step["passed"], step["time_taken"])

    if history:
        persistence.save_mastery_state(
            conn, student_id, h_t, current_version, last_step_index=history[-1]["step_index"]
        )
    conn.close()
    return tracker, edge_index, h_t
