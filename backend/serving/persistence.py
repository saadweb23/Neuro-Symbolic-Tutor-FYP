import io
import json
import logging
import os
import sqlite3
import threading

import torch

log = logging.getLogger("neurotutor.db")

# ---------------------------------------------------------------------------------------------
# Two interchangeable storage backends behind the same functions below:
#   * SQLite (default): a local file. TUTOR_DB_PATH points tests / demos at a throwaway file.
#   * PostgreSQL: used whenever DATABASE_URL is set (e.g. Neon in production). Hosts with an
#     ephemeral filesystem (Render's free tier) cannot keep a SQLite file, so student progress
#     must live in an external database there.
# The schema, column names, stored formats (timestamps are 'YYYY-MM-DD HH:MM:SS' UTC text) and
# every function's behaviour are identical on both, so nothing above this module can tell.
# ---------------------------------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
IS_PG = DATABASE_URL.startswith(("postgres://", "postgresql://"))

# backend/ root, regardless of this file's own package depth
# TUTOR_DB_PATH lets tests/demos use a throwaway database instead of the real student records.
DEFAULT_DB_PATH = os.environ.get('TUTOR_DB_PATH') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tutor_state.db')

_NOW = "(to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))" if IS_PG else "datetime('now')"

_pool = None
_pool_lock = threading.Lock()
_schema_ready = False


def describe_backend():
    """Safe-to-log description of the active storage backend (never includes credentials)."""
    return "postgresql" if IS_PG else f"sqlite:{os.path.basename(DEFAULT_DB_PATH)}"


def _get_pool():
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                from psycopg.rows import dict_row
                from psycopg_pool import ConnectionPool
                # prepare_threshold=None: server-side prepared statements break behind PgBouncer
                # (Neon's pooled endpoint). check: a connection that Neon suspended while idle is
                # replaced transparently instead of failing a request.
                _pool = ConnectionPool(
                    DATABASE_URL,
                    min_size=0,
                    max_size=int(os.environ.get("DB_POOL_MAX", "6")),
                    timeout=30,
                    max_idle=240,
                    max_lifetime=1800,
                    check=ConnectionPool.check_connection,
                    kwargs={"row_factory": dict_row, "prepare_threshold": None, "connect_timeout": 15},
                    open=False,
                    name="neurotutor",
                )
                _pool.open(wait=False)
    return _pool


def close_pool():
    """Closes the PostgreSQL pool (server shutdown / end of a script). Safe to call when unused."""
    global _pool, _schema_ready
    with _pool_lock:
        if _pool is not None:
            _pool.close()
            _pool = None
            _schema_ready = False


class _PgConnection:
    """Adapts a pooled psycopg connection to the small sqlite3-style surface this module uses
    (`execute`, `commit`, `close`), translating `?` placeholders. `close()` returns the
    connection to the pool; a connection that is dropped without close() is returned on GC."""

    def __init__(self, pool):
        self._pool = pool
        self._conn = pool.getconn()

    def execute(self, sql, params=()):
        return self._conn.execute(sql.replace("?", "%s"), params)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        conn, self._conn = self._conn, None
        if conn is None:
            return
        try:
            conn.rollback()  # ends any open read transaction; a no-op after commit()
        finally:
            self._pool.putconn(conn)

    def __del__(self):  # safety net: never leak a pooled connection on an exception path
        try:
            self.close()
        except Exception:  # pragma: no cover
            pass


def get_connection(db_path=DEFAULT_DB_PATH):
    if IS_PG:
        return _PgConnection(_get_pool())
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


_PG_SCHEMA = [
    f"""CREATE TABLE IF NOT EXISTS students (
        student_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT {_NOW}
    )""",
    f"""CREATE TABLE IF NOT EXISTS interactions (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES students(student_id),
        step_index INTEGER NOT NULL,
        concept TEXT NOT NULL,
        passed INTEGER NOT NULL,
        time_taken DOUBLE PRECISION NOT NULL,
        source TEXT NOT NULL DEFAULT 'quiz',
        content_id TEXT,
        selected_index INTEGER,
        created_at TEXT NOT NULL DEFAULT {_NOW},
        UNIQUE(student_id, step_index)
    )""",
    f"""CREATE TABLE IF NOT EXISTS mastery_state (
        student_id TEXT PRIMARY KEY REFERENCES students(student_id),
        h_t_blob BYTEA NOT NULL,
        model_version TEXT NOT NULL,
        last_step_index INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT {_NOW}
    )""",
    f"""CREATE TABLE IF NOT EXISTS generated_questions (
        content_id TEXT PRIMARY KEY,
        concept TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        question_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT {_NOW}
    )""",
    """CREATE TABLE IF NOT EXISTS belief_snapshots (
        student_id TEXT NOT NULL REFERENCES students(student_id),
        step_index INTEGER NOT NULL,
        model_version TEXT NOT NULL,
        beliefs_json TEXT NOT NULL,
        h_t_blob BYTEA NOT NULL,
        PRIMARY KEY (student_id, step_index, model_version)
    )""",
    f"""CREATE TABLE IF NOT EXISTS sessions (
        student_id TEXT PRIMARY KEY REFERENCES students(student_id),
        block_index INTEGER NOT NULL,
        round_count INTEGER NOT NULL DEFAULT 0,
        round_cap INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT {_NOW}
    )""",
    "CREATE INDEX IF NOT EXISTS idx_interactions_student_content ON interactions (student_id, content_id)",
]


def _ensure_pg_schema(conn):
    """Creates the tables once per process (every statement is IF NOT EXISTS, so concurrent
    starts and re-runs are harmless). Never drops or alters existing data."""
    global _schema_ready
    if _schema_ready:
        return
    with _pool_lock:
        if _schema_ready:
            return
        for stmt in _PG_SCHEMA:
            conn.execute(stmt)
        conn.commit()
        _schema_ready = True
        log.info("PostgreSQL schema verified")


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
    if IS_PG:
        _ensure_pg_schema(conn)
        return conn
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
    """Adds a column to an existing SQLite DB created before that column existed,
    so the schema can evolve without deleting real student data. (PostgreSQL databases are
    created with the full schema.)"""
    columns = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}")
        conn.commit()


def ensure_student(conn, student_id):
    conn.execute("INSERT INTO students (student_id) VALUES (?) ON CONFLICT DO NOTHING", (student_id,))
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
    requests for the same student can't both pick the same index. Returns the step_index used.

    SQLite serialises writers, so the single statement is enough there. On PostgreSQL two
    concurrent transactions can still compute the same MAX+1; the loser hits the
    UNIQUE(student_id, step_index) constraint and simply retries with the new maximum."""
    sql = (
        "INSERT INTO interactions (student_id, step_index, concept, passed, time_taken, source, content_id, "
        "selected_index) "
        "SELECT CAST(? AS TEXT), COALESCE(MAX(step_index), -1) + 1, CAST(? AS TEXT), CAST(? AS INTEGER), "
        "CAST(? AS DOUBLE PRECISION), CAST(? AS TEXT), CAST(? AS TEXT), CAST(? AS INTEGER) "
        "FROM interactions WHERE student_id = ? RETURNING step_index"
    ) if IS_PG else (
        "INSERT INTO interactions (student_id, step_index, concept, passed, time_taken, source, content_id, "
        "selected_index) "
        "SELECT ?, COALESCE(MAX(step_index), -1) + 1, ?, ?, ?, ?, ?, ? FROM interactions WHERE student_id = ? "
        "RETURNING step_index"
    )
    params = (student_id, concept, int(passed), float(time_taken), source, content_id,
              None if selected_index is None else int(selected_index), student_id)
    for attempt in range(6):
        try:
            row = conn.execute(sql, params).fetchone()
            conn.commit()
            return row["step_index"]
        except Exception as exc:  # sqlite3.IntegrityError / psycopg.errors.UniqueViolation
            conn.rollback()
            unique_clash = type(exc).__name__ in ("UniqueViolation", "IntegrityError")
            if not unique_clash or attempt == 5:
                raise
            log.info("step_index clash for a student; retrying (%d)", attempt + 1)


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
    """{step_index: {"beliefs": [...25 floats in concept-id order], "h_t": tensor | None}} for this
    student under this model version. Only the newest snapshot keeps its hidden state (older
    ones are compacted to save space), so `h_t` is None for those."""
    rows = conn.execute(
        "SELECT step_index, beliefs_json, h_t_blob FROM belief_snapshots "
        "WHERE student_id = ? AND model_version = ? ORDER BY step_index ASC",
        (student_id, model_version)
    ).fetchall()
    return {r["step_index"]: {"beliefs": json.loads(r["beliefs_json"]),
                              "h_t": _deserialize_tensor(bytes(r["h_t_blob"])) if r["h_t_blob"] else None}
            for r in rows}


def save_belief_snapshot(conn, student_id, step_index, model_version, beliefs, h_t):
    conn.execute(
        "INSERT INTO belief_snapshots (student_id, step_index, model_version, beliefs_json, h_t_blob) "
        "VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT (student_id, step_index, model_version) DO UPDATE SET "
        "beliefs_json = excluded.beliefs_json, h_t_blob = excluded.h_t_blob",
        (student_id, step_index, model_version, json.dumps(beliefs), _serialize_tensor(h_t))
    )


def compact_belief_snapshots(conn, student_id, model_version, keep_step_index):
    """Drops the (6.6 KB) hidden state of every snapshot older than `keep_step_index`. Incremental
    extension only ever resumes from the newest one, so this shrinks storage ~25x -- which matters
    on a 0.5 GB free database -- without losing any belief value."""
    conn.execute(
        "UPDATE belief_snapshots SET h_t_blob = ? "
        "WHERE student_id = ? AND model_version = ? AND step_index < ?",
        (b"", student_id, model_version, keep_step_index)
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
        f"VALUES (?, ?, ?, ?, {_NOW}) "
        "ON CONFLICT(student_id) DO UPDATE SET "
        "h_t_blob=excluded.h_t_blob, model_version=excluded.model_version, "
        f"last_step_index=excluded.last_step_index, updated_at={_NOW}",
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
        "h_t": _deserialize_tensor(bytes(row["h_t_blob"])),
        "model_version": row["model_version"],
        "last_step_index": row["last_step_index"],
    }


def save_generated_question(conn, content_id, concept, difficulty, question_payload):
    conn.execute(
        "INSERT INTO generated_questions (content_id, concept, difficulty, question_json) "
        "VALUES (?, ?, ?, ?) "
        "ON CONFLICT (content_id) DO UPDATE SET concept = excluded.concept, "
        "difficulty = excluded.difficulty, question_json = excluded.question_json",
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
        f"VALUES (?, ?, 0, ?, {_NOW}) "
        "ON CONFLICT(student_id) DO UPDATE SET "
        "block_index=excluded.block_index, round_count=0, round_cap=excluded.round_cap, "
        f"updated_at={_NOW}",
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
        f"UPDATE sessions SET round_count = round_count + 1, updated_at = {_NOW} "
        "WHERE student_id = ?", (student_id,)
    )
    conn.commit()


def extend_session(conn, student_id, extra_rounds):
    """Raises the round cap on the current session -- the "keep going"
    action from a soft-pause screen, without resetting round_count."""
    conn.execute(
        f"UPDATE sessions SET round_cap = round_cap + ?, updated_at = {_NOW} "
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
