import io
import json
import os
import sqlite3

import torch

# backend/ root, regardless of this file's own package depth
# TUTOR_DB_PATH lets tests/demos use a throwaway database instead of the real student records.
DEFAULT_DB_PATH = os.environ.get('TUTOR_DB_PATH') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tutor_state.db')


def get_connection(db_path=DEFAULT_DB_PATH):
    # timeout + WAL: the API serves requests from a thread pool, so two requests for the
    # same student can overlap. WAL lets readers and a writer coexist; the busy timeout
    # makes a second writer wait instead of failing with "database is locked".
    conn = sqlite3.connect(db_path, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 15000")
    try:
        conn.execute("PRAGMA journal_mode = WAL")
    except sqlite3.OperationalError:
        pass  # e.g. an in-memory or read-only database; WAL is an optimisation only
    return conn


def init_db(db_path=DEFAULT_DB_PATH):
    """Creates the schema if it doesn't exist and returns an open connection.

    Three tables carry the actual state:
    - `interactions` is the source of truth: the raw (concept, passed,
      time_taken) event log per student, in order. It's what lets a
      student's mastery state be rebuilt from scratch if it's ever lost
      or the tracker model changes.
    - `mastery_state` is a derived cache of the tracker's hidden state
      h_t, tagged with the checkpoint version that produced it, so a
      caller can tell whether it's still valid or needs to be rebuilt
      from `interactions` (see placement_quiz.load_or_rebuild_state).
    - `generated_questions` stores the actual LLM-generated MCQ payload
      for a given content_id -- unlike a static content bank entry, a
      generated question doesn't exist anywhere else to look up later.
    """
    conn = get_connection(db_path)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS students (
            student_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL REFERENCES students(student_id),
            step_index INTEGER NOT NULL,
            concept TEXT NOT NULL,
            passed INTEGER NOT NULL,
            time_taken REAL NOT NULL,
            source TEXT NOT NULL DEFAULT 'quiz',
            content_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(student_id, step_index)
        );

        CREATE TABLE IF NOT EXISTS mastery_state (
            student_id TEXT PRIMARY KEY REFERENCES students(student_id),
            h_t_blob BLOB NOT NULL,
            model_version TEXT NOT NULL,
            last_step_index INTEGER NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS generated_questions (
            content_id TEXT PRIMARY KEY,
            concept TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            question_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Derived cache (like mastery_state): the tracker's beliefs after each interaction,
        -- replayed with the model identified by model_version. Powers the mastery
        -- trajectory / analytics / history belief-change fields. If you hand-edit or delete
        -- `interactions` rows, delete that student's belief_snapshots too.
        CREATE TABLE IF NOT EXISTS belief_snapshots (
            student_id TEXT NOT NULL REFERENCES students(student_id),
            step_index INTEGER NOT NULL,
            model_version TEXT NOT NULL,
            beliefs_json TEXT NOT NULL,
            h_t_blob BLOB NOT NULL,
            PRIMARY KEY (student_id, step_index, model_version)
        );

        CREATE TABLE IF NOT EXISTS sessions (
            student_id TEXT PRIMARY KEY REFERENCES students(student_id),
            block_index INTEGER NOT NULL,
            round_count INTEGER NOT NULL DEFAULT 0,
            round_cap INTEGER NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    _migrate_add_column(conn, "interactions", "content_id", "TEXT")
    # Which option the student picked (MCQ rows only; NULL for older rows and for video /
    # deep-dive views). Lets the History page show "your answer" after the fact.
    _migrate_add_column(conn, "interactions", "selected_index", "INTEGER")
    return conn


def _migrate_add_column(conn, table, column, sql_type):
    """Adds a column to an existing DB created before that column existed,
    so the schema can evolve without deleting real student data."""
    columns = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}")
        conn.commit()


def ensure_student(conn, student_id):
    conn.execute("INSERT OR IGNORE INTO students (student_id) VALUES (?)", (student_id,))
    conn.commit()


def get_next_step_index(conn, student_id):
    row = conn.execute(
        "SELECT COALESCE(MAX(step_index), -1) AS max_step FROM interactions WHERE student_id = ?",
        (student_id,)
    ).fetchone()
    return row["max_step"] + 1


def log_interaction(conn, student_id, step_index, concept, passed, time_taken, source='quiz', content_id=None,
                    selected_index=None):
    conn.execute(
        "INSERT INTO interactions (student_id, step_index, concept, passed, time_taken, source, content_id, "
        "selected_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (student_id, step_index, concept, int(passed), float(time_taken), source, content_id,
         None if selected_index is None else int(selected_index))
    )
    conn.commit()


def log_interaction_next(conn, student_id, concept, passed, time_taken, source='quiz', content_id=None,
                         selected_index=None):
    """Appends an interaction at the next free step_index in ONE statement, so two overlapping
    requests for the same student can't both pick the same index (which would violate
    UNIQUE(student_id, step_index)). Returns the step_index that was used."""
    conn.execute(
        "INSERT INTO interactions (student_id, step_index, concept, passed, time_taken, source, content_id, "
        "selected_index) "
        "SELECT ?, COALESCE(MAX(step_index), -1) + 1, ?, ?, ?, ?, ?, ? FROM interactions WHERE student_id = ?",
        (student_id, concept, int(passed), float(time_taken), source, content_id,
         None if selected_index is None else int(selected_index), student_id)
    )
    conn.commit()
    row = conn.execute(
        "SELECT MAX(step_index) AS s FROM interactions WHERE student_id = ?", (student_id,)
    ).fetchone()
    return row["s"]


def get_interaction_history(conn, student_id):
    rows = conn.execute(
        "SELECT step_index, concept, passed, time_taken, source, content_id FROM interactions "
        "WHERE student_id = ? ORDER BY step_index ASC",
        (student_id,)
    ).fetchall()
    return [dict(row) for row in rows]


def get_interaction_rows(conn, student_id):
    """Every interaction for a student, oldest first, with all columns the read-only
    insight endpoints need (timestamps, chosen option, ...)."""
    rows = conn.execute(
        "SELECT step_index, concept, passed, time_taken, source, content_id, selected_index, created_at "
        "FROM interactions WHERE student_id = ? ORDER BY step_index ASC",
        (student_id,)
    ).fetchall()
    return [dict(r) for r in rows]


def get_latest_interaction(conn, student_id):
    row = conn.execute(
        "SELECT step_index, concept, passed, time_taken, source, content_id FROM interactions "
        "WHERE student_id = ? ORDER BY step_index DESC LIMIT 1",
        (student_id,)
    ).fetchone()
    return dict(row) if row is not None else None


def get_student_row(conn, student_id):
    row = conn.execute(
        "SELECT student_id, created_at FROM students WHERE student_id = ?", (student_id,)
    ).fetchone()
    return dict(row) if row is not None else None


def get_generated_questions_by_ids(conn, content_ids):
    """{content_id: payload-with-concept/difficulty} for the given ids (missing ids omitted)."""
    ids = list(content_ids)
    out = {}
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        marks = ",".join("?" for _ in chunk)
        rows = conn.execute(
            f"SELECT content_id, concept, difficulty, question_json FROM generated_questions "
            f"WHERE content_id IN ({marks})", chunk
        ).fetchall()
        for r in rows:
            payload = json.loads(r["question_json"])
            payload["concept"] = r["concept"]
            payload["difficulty"] = r["difficulty"]
            out[r["content_id"]] = payload
    return out


def get_belief_snapshots(conn, student_id, model_version):
    """{step_index: {"beliefs": [...25 floats in concept-id order], "h_t": tensor}} for this
    student under this model version."""
    rows = conn.execute(
        "SELECT step_index, beliefs_json, h_t_blob FROM belief_snapshots "
        "WHERE student_id = ? AND model_version = ? ORDER BY step_index ASC",
        (student_id, model_version)
    ).fetchall()
    return {r["step_index"]: {"beliefs": json.loads(r["beliefs_json"]),
                              "h_t": _deserialize_tensor(r["h_t_blob"])} for r in rows}


def save_belief_snapshot(conn, student_id, step_index, model_version, beliefs, h_t):
    conn.execute(
        "INSERT OR IGNORE INTO belief_snapshots (student_id, step_index, model_version, beliefs_json, h_t_blob) "
        "VALUES (?, ?, ?, ?, ?)",
        (student_id, step_index, model_version, json.dumps(beliefs), _serialize_tensor(h_t))
    )


def get_interaction_by_content_id(conn, student_id, content_id):
    """The first-logged interaction for this (student, content_id) pair, if
    any -- used to make grading/viewing a given piece of content idempotent,
    so a duplicate request (e.g. a double-tap on a slow connection) doesn't
    log the same answer as a second, independent interaction and double-
    apply its belief update."""
    row = conn.execute(
        "SELECT step_index, concept, passed, time_taken, source, content_id FROM interactions "
        "WHERE student_id = ? AND content_id = ? ORDER BY step_index ASC LIMIT 1",
        (student_id, content_id)
    ).fetchone()
    return dict(row) if row is not None else None


def _serialize_tensor(tensor):
    buffer = io.BytesIO()
    torch.save(tensor.detach().cpu(), buffer)
    return buffer.getvalue()


def _deserialize_tensor(blob):
    buffer = io.BytesIO(blob)
    return torch.load(buffer, weights_only=True)


def save_mastery_state(conn, student_id, h_t, model_version, last_step_index):
    blob = _serialize_tensor(h_t)
    conn.execute(
        "INSERT INTO mastery_state (student_id, h_t_blob, model_version, last_step_index, updated_at) "
        "VALUES (?, ?, ?, ?, datetime('now')) "
        "ON CONFLICT(student_id) DO UPDATE SET "
        "h_t_blob=excluded.h_t_blob, model_version=excluded.model_version, "
        "last_step_index=excluded.last_step_index, updated_at=datetime('now')",
        (student_id, blob, model_version, last_step_index)
    )
    conn.commit()


def load_mastery_state(conn, student_id):
    row = conn.execute(
        "SELECT h_t_blob, model_version, last_step_index FROM mastery_state WHERE student_id = ?",
        (student_id,)
    ).fetchone()
    if row is None:
        return None
    return {
        "h_t": _deserialize_tensor(row["h_t_blob"]),
        "model_version": row["model_version"],
        "last_step_index": row["last_step_index"],
    }


def save_generated_question(conn, content_id, concept, difficulty, question_payload):
    conn.execute(
        "INSERT OR REPLACE INTO generated_questions (content_id, concept, difficulty, question_json) "
        "VALUES (?, ?, ?, ?)",
        (content_id, concept, difficulty, json.dumps(question_payload))
    )
    conn.commit()


def get_generated_question(conn, content_id):
    row = conn.execute(
        "SELECT concept, difficulty, question_json FROM generated_questions WHERE content_id = ?",
        (content_id,)
    ).fetchone()
    if row is None:
        return None
    payload = json.loads(row["question_json"])
    payload["concept"] = row["concept"]
    payload["difficulty"] = row["difficulty"]
    return payload


def start_session(conn, student_id, block_index, round_cap):
    """(Re)starts a student's session on a chosen curriculum block --
    overwrites any prior session outright, since picking a new block means
    abandoning whatever was in progress before."""
    conn.execute(
        "INSERT INTO sessions (student_id, block_index, round_count, round_cap, updated_at) "
        "VALUES (?, ?, 0, ?, datetime('now')) "
        "ON CONFLICT(student_id) DO UPDATE SET "
        "block_index=excluded.block_index, round_count=0, round_cap=excluded.round_cap, "
        "updated_at=datetime('now')",
        (student_id, block_index, round_cap)
    )
    conn.commit()


def get_session(conn, student_id):
    row = conn.execute(
        "SELECT block_index, round_count, round_cap FROM sessions WHERE student_id = ?",
        (student_id,)
    ).fetchone()
    return dict(row) if row is not None else None


def increment_session_round(conn, student_id):
    conn.execute(
        "UPDATE sessions SET round_count = round_count + 1, updated_at = datetime('now') "
        "WHERE student_id = ?", (student_id,)
    )
    conn.commit()


def extend_session(conn, student_id, extra_rounds):
    """Raises the round cap on the current session -- the "keep going"
    action from a soft-pause screen, without resetting round_count."""
    conn.execute(
        "UPDATE sessions SET round_cap = round_cap + ?, updated_at = datetime('now') "
        "WHERE student_id = ?", (extra_rounds, student_id)
    )
    conn.commit()


def clear_session(conn, student_id):
    """Ends the active session outright (e.g. its block just got completed),
    so the next /next call reports no_session and routes back to the block
    picker instead of silently continuing on a block that's already done."""
    conn.execute("DELETE FROM sessions WHERE student_id = ?", (student_id,))
    conn.commit()


def get_asked_question_texts(conn, student_id, concept):
    """Every question text already generated for this student on this
    concept, oldest first -- used to tell the LLM what to avoid repeating."""
    rows = conn.execute(
        "SELECT gq.question_json FROM interactions i "
        "JOIN generated_questions gq ON gq.content_id = i.content_id "
        "WHERE i.student_id = ? AND i.concept = ? "
        "ORDER BY i.step_index ASC",
        (student_id, concept)
    ).fetchall()
    return [json.loads(row["question_json"])["question"] for row in rows]
