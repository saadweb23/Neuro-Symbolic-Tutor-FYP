"""Copies student records from a SQLite file into a PostgreSQL database (e.g. Neon).

    python scripts/migrate_sqlite_to_postgres.py --sqlite tutor_state.db --database-url "$DATABASE_URL"
    python scripts/migrate_sqlite_to_postgres.py --sqlite tutor_state.db --dry-run

Safety:
  * The SQLite file is opened READ-ONLY and is never modified, moved or deleted.
  * Nothing is overwritten or deleted in PostgreSQL: rows are inserted with ON CONFLICT DO NOTHING,
    so the script can be re-run safely (idempotent), and rows that already exist are left alone.
  * Copied: students, interactions (the source of truth), generated_questions (needed to show and
    grade served questions) and sessions. NOT copied: mastery_state and belief_snapshots -- they are
    derived caches tagged with the model checkpoint's file time and are rebuilt automatically from
    `interactions` on first use.
  * Afterwards every copied table is verified by row count and by a content checksum, and the
    script exits non-zero if anything differs.
"""
import argparse
import hashlib
import os
import sqlite3
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

# (table, columns copied, order-by for a stable checksum, primary key columns)
TABLES = [
    ("students", ["student_id", "created_at"], "student_id", ["student_id"]),
    ("interactions", ["id", "student_id", "step_index", "concept", "passed", "time_taken", "source",
                      "content_id", "selected_index", "created_at"], "student_id, step_index", ["student_id", "step_index"]),
    ("generated_questions", ["content_id", "concept", "difficulty", "question_json", "created_at"], "content_id", ["content_id"]),
    ("sessions", ["student_id", "block_index", "round_count", "round_cap", "updated_at"], "student_id", ["student_id"]),
]


def checksum(rows):
    h = hashlib.sha256()
    for r in rows:
        h.update(repr(tuple(None if v is None else (round(v, 6) if isinstance(v, float) else v) for v in r)).encode())
    return h.hexdigest()[:16]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sqlite", default=os.path.join(BACKEND, "tutor_state.db"), help="path of the SQLite file (read-only)")
    ap.add_argument("--database-url", default=os.environ.get("DATABASE_URL"), help="PostgreSQL connection string (default: $DATABASE_URL)")
    ap.add_argument("--dry-run", action="store_true", help="only report what would be copied")
    a = ap.parse_args()

    if not os.path.exists(a.sqlite):
        sys.exit(f"SQLite file not found: {a.sqlite}")
    if not a.database_url or not a.database_url.startswith(("postgres://", "postgresql://")):
        sys.exit("A PostgreSQL --database-url (or DATABASE_URL) is required.")
    os.environ["DATABASE_URL"] = a.database_url  # before importing persistence

    src = sqlite3.connect(f"file:{a.sqlite}?mode=ro", uri=True)
    src.row_factory = sqlite3.Row
    have = {t["name"] for t in src.execute("SELECT name FROM sqlite_master WHERE type='table'")}

    from serving import persistence  # noqa: E402  (selects the PostgreSQL backend)
    dst = persistence.init_db()      # creates missing tables only; never drops anything

    failures = 0
    for table, cols, order, key in TABLES:
        if table not in have:
            print(f"{table:20s} (not in the SQLite file, skipped)")
            continue
        existing = {r["name"] for r in src.execute(f"PRAGMA table_info({table})")}
        select = ", ".join(c if c in existing else f"NULL AS {c}" for c in cols)  # older files lack newer columns
        rows = [tuple(r) for r in src.execute(f"SELECT {select} FROM {table} ORDER BY {order}")]
        before = dst.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"]
        inserted = 0
        if not a.dry_run:
            placeholders = ", ".join("?" for _ in cols)
            conflict = ", ".join(key)
            for r in rows:
                cur = dst.execute(
                    f"INSERT INTO {table} ({', '.join(cols)}) OVERRIDING SYSTEM VALUE VALUES ({placeholders}) "
                    f"ON CONFLICT ({conflict}) DO NOTHING" if table == "interactions" else
                    f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders}) ON CONFLICT ({conflict}) DO NOTHING", r)
                inserted += cur.rowcount
            dst.commit()
            if table == "interactions":
                dst.execute("SELECT setval(pg_get_serial_sequence('interactions', 'id'), "
                            "GREATEST((SELECT COALESCE(MAX(id), 1) FROM interactions), 1))")
                dst.commit()
        after = dst.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"]
        # verify: the copied rows must exist unchanged in PostgreSQL
        status = "dry-run"
        if not a.dry_run:
            keycols = ", ".join(cols)
            pg_rows = [tuple(r[c] for c in cols) for r in dst.execute(f"SELECT {keycols} FROM {table} ORDER BY {order}").fetchall()]
            src_keys = {tuple(r[cols.index(k)] for k in key) for r in rows}
            pg_subset = [r for r in pg_rows if tuple(r[cols.index(k)] for k in key) in src_keys]
            ok = len(pg_subset) == len(rows) and checksum(pg_subset) == checksum(rows)
            status = "verified" if ok else "MISMATCH"
            failures += 0 if ok else 1
        print(f"{table:20s} sqlite={len(rows):6d}  postgres before={before:6d} inserted={inserted:6d} after={after:6d}  {status}")
    src.close()
    dst.close()
    persistence.close_pool()
    if failures:
        sys.exit("Verification FAILED: see MISMATCH above. Nothing was deleted; fix and re-run.")
    print("Done. The SQLite file was not modified.")


if __name__ == "__main__":
    main()
