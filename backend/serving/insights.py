"""Read-only analytics over a student's interaction log.

`interactions` is the source of truth. Everything returned here is computed from it (plus the
tracker's replayed beliefs, cached in `belief_snapshots`) -- no endpoint in this module writes
to `interactions`, creates a student, increments a session round or generates a question.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from knowledge_graph.graph_builder import CONCEPTS, CONCEPT_TO_ID, CONCEPT_BLOCKS
from serving import inference, persistence
from serving.catalog import CONCEPT_TO_BLOCK, relations

NUM_BLOCKS = len(CONCEPT_BLOCKS)
# Time a student spends on a video / deep-dive is "time until they pressed Mark watched",
# which includes idle time, so it is never summed into study-time figures.
MAX_ANSWER_SECONDS = 600.0


# ----------------------------- helpers ---------------------------------
def classify(row):
    """placement | practice | video | deep_dive"""
    if row["source"] == "placement":
        return "placement"
    cid = row.get("content_id") or ""
    if cid.endswith("-video"):
        return "video"
    if cid.endswith("-deepdive"):
        return "deep_dive"
    return "practice"


def is_answered(row):
    return classify(row) in ("placement", "practice")


def parse_ts(value):
    """SQLite datetime('now') strings are UTC without a zone marker."""
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)


def iso(value):
    return None if value is None else parse_ts(value).strftime("%Y-%m-%dT%H:%M:%SZ")


def resolve_tz(name):
    if not name:
        return timezone.utc
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        raise ValueError(f"Unknown timezone: {name}")


def local_date(value, tz):
    return parse_ts(value).astimezone(tz).date()


def _rows(student_id, db_path):
    conn = persistence.init_db(db_path)
    rows = persistence.get_interaction_rows(conn, student_id)
    conn.close()
    return rows


# ----------------------------- status ----------------------------------
def student_status(student_id, db_path=persistence.DEFAULT_DB_PATH):
    conn = persistence.init_db(db_path)
    student = persistence.get_student_row(conn, student_id)
    rows = persistence.get_interaction_rows(conn, student_id)
    session = persistence.get_session(conn, student_id)
    conn.close()
    placement_rows = [r for r in rows if r["source"] == "placement"]
    return {
        "student_id": student_id,
        "exists": student is not None or bool(rows),
        "placement_completed": bool(placement_rows),
        "placement_completed_at": iso(placement_rows[-1]["created_at"]) if placement_rows else None,
        "has_active_session": session is not None,
        "session": session,
        "counts": {
            "interactions": len(rows),
            "answered_questions": sum(1 for r in rows if is_answered(r)),
        },
        "created_at": iso(student["created_at"]) if student else None,
        "last_active_at": iso(rows[-1]["created_at"]) if rows else None,
    }


# ----------------------------- summary ---------------------------------
def student_summary(student_id, tz_name=None, db_path=persistence.DEFAULT_DB_PATH):
    tz = resolve_tz(tz_name)
    rows = _rows(student_id, db_path)
    answered = [r for r in rows if is_answered(r)]
    practice = [r for r in rows if classify(r) == "practice"]
    days = sorted({local_date(r["created_at"], tz) for r in rows})

    longest = current = 0
    run = 0
    prev = None
    for d in days:
        run = run + 1 if prev is not None and (d - prev).days == 1 else 1
        longest = max(longest, run)
        prev = d
    today = datetime.now(timezone.utc).astimezone(tz).date()
    if days and (today - days[-1]).days <= 1:
        # the streak that ends today or yesterday is still "current"
        current = 1
        for i in range(len(days) - 1, 0, -1):
            if (days[i] - days[i - 1]).days == 1:
                current += 1
            else:
                break

    attempted = {r["concept"] for r in answered}
    return {
        "answered_questions": len(answered),
        "correct_answers": sum(1 for r in answered if r["passed"]),
        "accuracy": (sum(1 for r in answered if r["passed"]) / len(answered)) if answered else None,
        "practice_questions": len(practice),
        "videos_viewed": sum(1 for r in rows if classify(r) == "video"),
        "deep_dives_read": sum(1 for r in rows if classify(r) == "deep_dive"),
        "concepts_attempted": len(attempted),
        "concepts_total": len(CONCEPTS),
        "answering_time_seconds": sum(min(max(r["time_taken"], 0.0), MAX_ANSWER_SECONDS) for r in answered),
        "active_days": len(days),
        "current_streak_days": current,
        "longest_streak_days": longest,
        "first_activity_at": iso(rows[0]["created_at"]) if rows else None,
        "last_activity_at": iso(rows[-1]["created_at"]) if rows else None,
    }


# ----------------------------- belief snapshots ------------------------
def ensure_snapshots(student_id, rows, checkpoint_path=inference.DEFAULT_CHECKPOINT,
                     db_path=persistence.DEFAULT_DB_PATH):
    """Returns (model_version, initial_beliefs, {step_index: beliefs[25]}) for the student,
    replaying the interaction log with the current tracker and caching one snapshot per step in
    `belief_snapshots`. Only steps that are not cached yet are computed, continuing from the
    last cached hidden state."""
    tracker = inference.get_tracker(checkpoint_path)
    edge_index = inference.get_edge_index()
    version = inference.model_version_from_checkpoint(checkpoint_path)

    def beliefs_list(h):
        b = inference.get_mastery_beliefs(tracker, h)
        return [b[c] for c in CONCEPTS]

    initial = beliefs_list(tracker.init_state())
    if not rows:
        return version, initial, {}

    conn = persistence.init_db(db_path)
    cached = persistence.get_belief_snapshots(conn, student_id, version)
    steps = [r["step_index"] for r in rows]

    # longest cached prefix of the log (a gap means the cache is unusable beyond it)
    prefix = 0
    while prefix < len(steps) and steps[prefix] in cached:
        prefix += 1
    if prefix and cached[steps[prefix - 1]]["h_t"] is None:
        prefix = 0  # the newest cached snapshot lost its hidden state: replay from the start
    snapshots = {s: cached[s]["beliefs"] for s in steps[:prefix]}

    if prefix < len(steps):
        h_t = cached[steps[prefix - 1]]["h_t"] if prefix else tracker.init_state()
        for r in rows[prefix:]:
            h_t = inference.apply_interaction(tracker, edge_index, h_t, r["concept"], r["passed"], r["time_taken"])
            b = beliefs_list(h_t)
            snapshots[r["step_index"]] = b
            persistence.save_belief_snapshot(conn, student_id, r["step_index"], version, b, h_t)
        persistence.compact_belief_snapshots(conn, student_id, version, rows[-1]["step_index"])
        conn.commit()
    conn.close()
    return version, initial, snapshots


def _block_averages(beliefs):
    return [sum(beliefs[CONCEPT_TO_ID[c]] for c in b["concepts"]) / len(b["concepts"]) for b in CONCEPT_BLOCKS]


# ----------------------------- history ---------------------------------
def student_history(student_id, limit=25, cursor=None, concept=None, block=None, content_type=None,
                    result=None, db_path=persistence.DEFAULT_DB_PATH,
                    checkpoint_path=inference.DEFAULT_CHECKPOINT):
    """Newest first. `cursor` is the step_index of the last item of the previous page."""
    rows = _rows(student_id, db_path)
    if not rows:
        return {"items": [], "next_cursor": None, "total": 0}
    version, initial, snaps = ensure_snapshots(student_id, rows, checkpoint_path, db_path)

    conn = persistence.init_db(db_path)
    questions = persistence.get_generated_questions_by_ids(
        conn, [r["content_id"] for r in rows if r.get("content_id") and classify(r) in ("practice", "placement")])
    conn.close()

    items = []
    prev_beliefs = initial
    for r in rows:
        kind = classify(r)
        idx = CONCEPT_TO_ID[r["concept"]]
        after = snaps[r["step_index"]][idx]
        before = prev_beliefs[idx]
        prev_beliefs = snaps[r["step_index"]]
        q = questions.get(r.get("content_id") or "")
        answered = kind in ("placement", "practice")
        items.append({
            "step_index": r["step_index"],
            "at": iso(r["created_at"]),
            "concept": r["concept"],
            "block_index": CONCEPT_TO_BLOCK[r["concept"]],
            "content_type": kind,
            "content_id": r.get("content_id"),
            "passed": bool(r["passed"]) if answered else None,
            "time_taken": r["time_taken"],
            "difficulty": q["difficulty"] if q else None,
            "question_text": q["question"] if q else None,
            "choices": q["choices"] if q else None,
            "correct_index": q["correct_index"] if q else None,
            "explanation": q["explanation"] if q else None,
            "selected_index": r.get("selected_index"),
            "belief_before": before,
            "belief_after": after,
        })

    def keep(it):
        if concept and it["concept"] != concept:
            return False
        if block is not None and it["block_index"] != block:
            return False
        if content_type and it["content_type"] != content_type:
            return False
        if result == "passed" and it["passed"] is not True:
            return False
        if result == "failed" and it["passed"] is not False:
            return False
        return True

    items = [it for it in reversed(items) if keep(it)]
    total = len(items)
    if cursor is not None:
        items = [it for it in items if it["step_index"] < cursor]
    page = items[:limit]
    next_cursor = page[-1]["step_index"] if len(items) > limit else None
    return {"items": page, "next_cursor": next_cursor, "total": total}


# ----------------------------- trajectory ------------------------------
def mastery_trajectory(student_id, concepts=None, detail=False, db_path=persistence.DEFAULT_DB_PATH,
                       checkpoint_path=inference.DEFAULT_CHECKPOINT):
    rows = _rows(student_id, db_path)
    version, initial, snaps = ensure_snapshots(student_id, rows, checkpoint_path, db_path)
    wanted = list(concepts or [])
    for c in wanted:
        if c not in CONCEPT_TO_ID:
            raise ValueError(f"Unknown concept: {c}")
    steps = []
    for r in rows:
        b = snaps[r["step_index"]]
        kind = classify(r)
        entry = {
            "step_index": r["step_index"],
            "at": iso(r["created_at"]),
            "concept": r["concept"],
            "content_type": kind,
            "passed": bool(r["passed"]) if kind in ("placement", "practice") else None,
            "average": sum(b) / len(b),
            "blocks": _block_averages(b),
        }
        if detail:
            entry["beliefs"] = {c: b[CONCEPT_TO_ID[c]] for c in CONCEPTS}
        elif wanted:
            entry["beliefs"] = {c: b[CONCEPT_TO_ID[c]] for c in wanted}
        steps.append(entry)
    return {
        "model_version": version,
        "initial": {"average": sum(initial) / len(initial), "blocks": _block_averages(initial)},
        "steps": steps,
    }


# ----------------------------- concepts --------------------------------
def student_concepts(student_id, beliefs, db_path=persistence.DEFAULT_DB_PATH):
    rows = _rows(student_id, db_path)
    stats = defaultdict(lambda: {"attempts": 0, "correct": 0, "last": None})
    for r in rows:
        if not is_answered(r):
            continue
        s = stats[r["concept"]]
        s["attempts"] += 1
        s["correct"] += 1 if r["passed"] else 0
        s["last"] = r["created_at"]
    rel = relations()
    out = []
    for c in CONCEPTS:
        s = stats[c]
        anc = rel[c]["ancestors"]
        out.append({
            "concept": c,
            "id": CONCEPT_TO_ID[c],
            "block_index": CONCEPT_TO_BLOCK[c],
            "belief": beliefs[c],
            "attempts": s["attempts"],
            "correct": s["correct"],
            "accuracy": (s["correct"] / s["attempts"]) if s["attempts"] else None,
            "last_attempt_at": iso(s["last"]),
            "prerequisites": rel[c]["prerequisites"],
            "dependents": rel[c]["dependents"],
            # same definition the "Why this?" explanation uses: the weakest of ALL ancestors
            "weakest_prerequisite": min(anc, key=lambda a: beliefs[a]) if anc else None,
        })
    return out


# ----------------------------- analytics -------------------------------
ACCURACY_WINDOW = 5


def student_analytics(student_id, tz_name=None, days=None, db_path=persistence.DEFAULT_DB_PATH,
                      checkpoint_path=inference.DEFAULT_CHECKPOINT):
    tz = resolve_tz(tz_name)
    rows = _rows(student_id, db_path)
    version, initial, snaps = ensure_snapshots(student_id, rows, checkpoint_path, db_path)
    conn = persistence.init_db(db_path)
    questions = persistence.get_generated_questions_by_ids(
        conn, [r["content_id"] for r in rows if r.get("content_id") and is_answered(r)])
    conn.close()

    cutoff = None
    if days:
        cutoff = datetime.now(timezone.utc).astimezone(tz).date() - timedelta(days=days - 1)

    def in_range(r):
        return cutoff is None or local_date(r["created_at"], tz) >= cutoff

    window_rows = [r for r in rows if in_range(r)]

    # daily activity
    per_day = defaultdict(lambda: {"answered": 0, "correct": 0, "videos": 0, "deep_dives": 0, "answering_seconds": 0.0})
    mix = {"practice": 0, "placement": 0, "video": 0, "deep_dive": 0}
    for r in window_rows:
        d = per_day[local_date(r["created_at"], tz)]
        kind = classify(r)
        mix[kind] += 1
        if kind in ("placement", "practice"):
            d["answered"] += 1
            d["correct"] += 1 if r["passed"] else 0
            d["answering_seconds"] += min(max(r["time_taken"], 0.0), MAX_ANSWER_SECONDS)
        elif kind == "video":
            d["videos"] += 1
        else:
            d["deep_dives"] += 1
    activity = [{"date": d.isoformat(), **v} for d, v in sorted(per_day.items())]

    # per-block performance (within range) + current average
    final = snaps[rows[-1]["step_index"]] if rows else initial
    cur_blocks = _block_averages(final)
    blocks = []
    for i, b in enumerate(CONCEPT_BLOCKS):
        ans = [r for r in window_rows if is_answered(r) and CONCEPT_TO_BLOCK[r["concept"]] == i]
        correct = sum(1 for r in ans if r["passed"])
        blocks.append({"index": i, "name": b["name"], "answered": len(ans), "correct": correct,
                       "accuracy": (correct / len(ans)) if ans else None, "current_average": cur_blocks[i]})

    # per-concept improvement: belief just before the first answered question on the concept
    # vs now (all-time, independent of the date range)
    first_before = {}
    prev = initial
    for r in rows:
        if is_answered(r) and r["concept"] not in first_before:
            first_before[r["concept"]] = prev[CONCEPT_TO_ID[r["concept"]]]
        prev = snaps[r["step_index"]]
    stat = defaultdict(lambda: [0, 0])
    for r in rows:
        if is_answered(r):
            stat[r["concept"]][0] += 1
            stat[r["concept"]][1] += 1 if r["passed"] else 0
    concepts = []
    for c, (n, k) in stat.items():
        cur = final[CONCEPT_TO_ID[c]]
        concepts.append({"concept": c, "block_index": CONCEPT_TO_BLOCK[c], "attempts": n,
                         "accuracy": k / n, "first_belief": first_before[c], "current_belief": cur,
                         "delta": cur - first_before[c]})
    concepts.sort(key=lambda x: x["delta"], reverse=True)

    # difficulty breakdown
    difficulty = {"placement": [0, 0], "easy": [0, 0], "medium": [0, 0], "hard": [0, 0]}
    for r in window_rows:
        if not is_answered(r):
            continue
        key = "placement" if r["source"] == "placement" else (
            questions.get(r.get("content_id") or "", {}).get("difficulty"))
        if key in difficulty:
            difficulty[key][0] += 1
            difficulty[key][1] += 1 if r["passed"] else 0
    difficulty = {k: {"answered": v[0], "correct": v[1]} for k, v in difficulty.items()}

    # rolling accuracy over the last ACCURACY_WINDOW answered questions (all-time)
    trend, recent = [], []
    for r in rows:
        if not is_answered(r):
            continue
        recent.append(1 if r["passed"] else 0)
        if len(recent) >= ACCURACY_WINDOW:
            w = recent[-ACCURACY_WINDOW:]
            trend.append({"step_index": r["step_index"], "answer_number": len(recent),
                          "rolling_accuracy": sum(w) / len(w)})

    return {
        "model_version": version,
        "window": {"days": days, "accuracy_window": ACCURACY_WINDOW},
        "activity": activity,
        "blocks": blocks,
        "concepts": concepts,
        "content_mix": mix,
        "difficulty": difficulty,
        "accuracy_trend": trend,
    }
