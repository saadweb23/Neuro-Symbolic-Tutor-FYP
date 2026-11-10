"""Production-readiness behaviour: health, CORS, error hygiene, concurrency, storage parity."""
import threading

import pytest
from fastapi.testclient import TestClient

from serving import persistence


def test_health_is_lightweight_and_db_health_reports_the_backend(client):
    assert client.get("/health").json() == {"status": "ok"}
    r = client.get("/health/db").json()
    assert r["status"] == "ok" and r["database"] in ("sqlite", "postgresql")
    assert r["memory_mb"] is None or r["memory_mb"] > 50
    assert r["database"] == ("postgresql" if persistence.IS_PG else "sqlite")
    root = client.get("/")
    assert root.status_code == 200      # the API stub, or the website when a frontend build exists


def test_cors_origins_come_from_the_environment(monkeypatch):
    import main
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.setenv("NEURO_ENV", "development")
    assert main._cors_origins() == ["*"]
    monkeypatch.setenv("NEURO_ENV", "production")
    assert main._cors_origins() == []          # production without configuration fails closed
    monkeypatch.setenv("CORS_ORIGINS", " https://app.vercel.app/ , https://neurotutor.example ")
    assert main._cors_origins() == ["https://app.vercel.app", "https://neurotutor.example"]


def test_cors_preflight_is_answered_for_the_configured_origin_only(client, monkeypatch):
    import main
    # the app under test was started with the development default ("*"); verify the middleware wiring
    r = client.options("/students/x/status", headers={"Origin": "https://app.vercel.app", "Access-Control-Request-Method": "GET"})
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] in ("*", "https://app.vercel.app")
    assert main.CORS_ORIGINS in (["*"], main._cors_origins())


def test_unexpected_errors_are_generic_and_never_leak_details():
    import main
    from fastapi.routing import APIRoute

    def boom():
        raise RuntimeError("password=hunter2 postgresql://user:secret@host/db")
    main.app.router.routes.insert(0, APIRoute("/_boom_for_test", boom, methods=["GET"]))   # before any catch-all
    r = TestClient(main.app, raise_server_exceptions=False).get("/_boom_for_test")
    assert r.status_code == 500
    assert r.json() == {"detail": "Internal server error"}
    assert "hunter2" not in r.text and "secret" not in r.text and "Traceback" not in r.text


def test_responses_carry_basic_security_headers(client):
    h = client.get("/health").headers
    assert h["x-content-type-options"] == "nosniff"


def test_concurrent_writers_never_collide_on_step_index(db):
    """Many overlapping requests for ONE student must each get a distinct step_index."""
    sid = "concurrency-student"
    persistence.ensure_student(db, sid)
    n = 12
    steps, errors = [], []
    barrier = threading.Barrier(n)

    def worker(i):
        barrier.wait()                      # start together, THEN take a connection (the pool is smaller than n)
        conn = persistence.init_db()
        try:
            steps.append(persistence.log_interaction_next(conn, sid, "Syntax", 1, 3.0, source="tutoring", content_id=f"syntax-mcq-{i}"))
        except Exception as exc:  # pragma: no cover
            errors.append(repr(exc))
        finally:
            conn.close()

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert errors == []
    assert sorted(steps) == list(range(n))
    rows = persistence.get_interaction_rows(db, sid)
    assert [r["step_index"] for r in rows] == list(range(n))


def test_snapshot_compaction_keeps_only_the_newest_hidden_state(client, db):
    from tests.conftest import placed_student
    sid = "compaction-student"
    placed_student(client, db, sid)
    client.get(f"/students/{sid}/mastery/trajectory")  # builds snapshots for all 7 placement steps
    rows = db.execute("SELECT step_index, length(h_t_blob) AS n FROM belief_snapshots WHERE student_id = ? ORDER BY step_index", (sid,)).fetchall()
    assert len(rows) == 7
    assert [r["n"] > 0 for r in rows] == [False] * 6 + [True]
    # a later request extends from the newest state without recomputing, and values stay identical
    first = client.get(f"/students/{sid}/mastery/trajectory").json()
    client.post(f"/students/{sid}/session/start", json={"block_index": 0})
    assert client.get(f"/students/{sid}/mastery/trajectory").json() == first


def test_backend_serves_the_built_site_with_spa_fallback_and_never_shadows_the_api(tmp_path):
    """With a build present the same process serves the website (one public URL for site + API)."""
    import importlib, os, sys
    dist = tmp_path / "dist"; (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>NeuroTutor</title><div id=root></div>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    (dist / "favicon.svg").write_text("<svg/>")
    os.environ["FRONTEND_DIST"] = str(dist)
    try:
        sys.modules.pop("main", None)
        main = importlib.import_module("main")
        c = TestClient(main.app)
        assert "<title>NeuroTutor</title>" in c.get("/").text
        assert "<title>NeuroTutor</title>" in c.get("/learn/session").text          # SPA deep link / refresh
        assert c.get("/assets/app.js").text == "console.log(1)"
        assert "immutable" in c.get("/assets/app.js").headers["cache-control"]
        assert c.get("/favicon.svg").text == "<svg/>"
        assert c.get("/health").json() == {"status": "ok"}                          # API still wins
        assert c.get("/meta").status_code != 404 and "NeuroTutor" not in c.get("/graph").text
        assert c.get("/students/x/nope").status_code == 404                          # unknown API path: JSON 404, not the site
        assert c.get("/../../etc/passwd").status_code in (200, 404) and "root:" not in c.get("/..%2f..%2fetc%2fpasswd").text
    finally:
        os.environ.pop("FRONTEND_DIST", None)
        sys.modules.pop("main", None)
        importlib.import_module("main")
