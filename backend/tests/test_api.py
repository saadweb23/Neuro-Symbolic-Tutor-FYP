import pytest

from knowledge_graph.graph_builder import CONCEPTS, build_python_dag
from serving import persistence
from tests.conftest import placed_student


def counts(db, student_id):
    n = db.execute("SELECT COUNT(*) AS n FROM interactions WHERE student_id = ?", (student_id,)).fetchone()["n"]
    s = db.execute("SELECT round_count FROM sessions WHERE student_id = ?", (student_id,)).fetchone()
    return n, (s["round_count"] if s else None)


# ---------------------------------------------------------------- meta / graph
def test_meta_reports_backend_constants(client):
    r = client.get("/meta").json()
    assert r["status"] == "ok"
    assert r["config"]["mastery_threshold"] == 0.65
    assert r["config"]["concept_floor"] == 0.5
    assert r["config"]["session_round_cap"] == 15
    assert r["config"]["difficulty_cutoffs"] == {"easy_below": 0.4, "medium_below": 0.7}
    assert r["config"]["concept_count"] == 25 and r["config"]["block_count"] == 5
    assert len(r["config"]["placement_concepts"]) == 7
    assert r["models"]["ppo"].endswith(".zip") and r["models"]["tracker"].endswith(".pth")


def test_graph_matches_knowledge_graph(client):
    g = client.get("/graph").json()
    dag = build_python_dag()
    assert len(g["nodes"]) == 25 and len(g["edges"]) == dag.number_of_edges()
    ids = {n["concept"]: n["id"] for n in g["nodes"]}
    assert ids == {c: i for i, c in enumerate(CONCEPTS)}
    depth = {n["id"]: n["depth"] for n in g["nodes"]}
    for e in g["edges"]:
        assert depth[e["source"]] < depth[e["target"]]
    assert [b["name"] for b in g["blocks"]][0] == "Fundamentals"


# ---------------------------------------------------------------- validation
def test_student_id_validation(client):
    assert client.get("/students/" + "x" * 65 + "/status").status_code == 422
    assert client.get("/students/" + "x" * 64 + "/status").status_code == 200


def test_ids_are_case_sensitive(client, db):
    placed_student(client, db, "CaseSens")
    assert client.get("/students/CaseSens/status").json()["placement_completed"] is True
    assert client.get("/students/casesens/status").json()["exists"] is False


def test_session_start_rejects_out_of_range_block(client, sid):
    for bad in (-1, 5, 99):
        assert client.post(f"/students/{sid}/session/start", json={"block_index": bad}).status_code == 422
    assert client.post(f"/students/{sid}/session/start", json={"block_index": 4}).status_code == 200


# ---------------------------------------------------------------- status / placement
def test_status_does_not_create_students(client, db, sid):
    s = client.get(f"/students/{sid}/status").json()
    assert s["exists"] is False and s["placement_completed"] is False and s["session"] is None
    assert db.execute("SELECT 1 FROM students WHERE student_id = ?", (sid,)).fetchone() is None


def test_placement_flow_and_resubmit_guard(client, db, sid):
    beliefs = placed_student(client, db, sid)
    assert set(beliefs) == set(CONCEPTS)
    st = client.get(f"/students/{sid}/status").json()
    assert st["exists"] and st["placement_completed"] and st["counts"]["answered_questions"] == 7
    assert st["placement_completed_at"].endswith("Z")

    # a second start / submit is refused and must not touch the existing history
    before = counts(db, sid)
    assert client.post(f"/students/{sid}/placement/start").status_code == 409
    assert client.post(f"/students/{sid}/placement/submit", json=[]).status_code == 409
    assert counts(db, sid) == before


def test_placement_rows_keep_question_and_selected_index(client, db, sid):
    placed_student(client, db, sid)
    rows = persistence.get_interaction_rows(db, sid)
    assert len(rows) == 7
    assert all(r["source"] == "placement" and r["content_id"] and r["selected_index"] is not None for r in rows)
    h = client.get(f"/students/{sid}/history?limit=100").json()
    assert h["total"] == 7 and all(i["question_text"] and i["content_type"] == "placement" for i in h["items"])


def test_placement_submit_with_missing_answers_is_400(client, sid):
    qs = client.post(f"/students/{sid}/placement/start").json()["questions"]
    a = [{"content_id": qs[0]["content_id"], "selected_index": 0, "time_taken": 5}]
    assert client.post(f"/students/{sid}/placement/submit", json=a).status_code == 400


# ---------------------------------------------------------------- read-only guarantee
READ_ONLY = ["status", "summary", "history", "mastery/trajectory", "concepts", "resources",
             "recommendation", "analytics", "blocks", "mastery", "session"]


def test_insight_endpoints_never_consume_rounds(client, db, sid):
    placed_student(client, db, sid)
    client.post(f"/students/{sid}/session/start", json={"block_index": 0})
    before = counts(db, sid)
    questions_before = db.execute("SELECT COUNT(*) AS n FROM generated_questions").fetchone()["n"]
    for path in READ_ONLY:
        r = client.get(f"/students/{sid}/{path}")
        assert r.status_code == 200, (path, r.text)
    assert counts(db, sid) == before
    assert before[1] == 0   # round_count still 0: nothing advanced it
    # ...and no question was generated/stored by the previews
    assert db.execute("SELECT COUNT(*) AS n FROM generated_questions").fetchone()["n"] == questions_before


def test_next_is_the_only_endpoint_that_consumes_a_round(client, db, sid):
    placed_student(client, db, sid)
    client.post(f"/students/{sid}/session/start", json={"block_index": 1})
    step = client.get(f"/students/{sid}/next").json()
    assert step["content_type"] in ("video", "practice_problem", "escalation")
    assert step["block"]["index"] == 1 and step["block"]["round_count"] == 1
    assert counts(db, sid)[1] == 1


def test_recommendation_preview_shape(client, db, sid):
    placed_student(client, db, sid, pass_all=False)
    r = client.get(f"/students/{sid}/recommendation").json()
    assert r["session_active"] is False and r["suggested"] is True
    assert r["state"] == "ready" and len(r["candidates"]) == 3
    assert all(0 <= c["probability"] <= 1 and c["explanation"] for c in r["candidates"])
    block_concepts = client.get("/graph").json()["blocks"][r["block_index"]]["concepts"]
    assert all(c["concept"] in block_concepts for c in r["candidates"])
    # after a session starts, the preview follows it and is no longer a suggestion
    client.post(f"/students/{sid}/session/start", json={"block_index": 2})
    r2 = client.get(f"/students/{sid}/recommendation").json()
    assert r2["session_active"] and not r2["suggested"] and r2["block_index"] == 2


# ---------------------------------------------------------------- answering
def serve_practice(client, db, sid, tries=40):
    """Calls /next until it serves a practice question (videos are marked viewed on the way)."""
    for _ in range(tries):
        step = client.get(f"/students/{sid}/next").json()
        if step["content_type"] == "practice_problem":
            return step
        if step["content_type"] in ("video", "escalation"):
            r = client.post(f"/students/{sid}/content-viewed",
                            json={"concept": step["concept"], "content_id": step["content"]["id"], "time_taken": 5})
            assert r.status_code == 200
        else:
            break
    pytest.fail("never served a practice question")


def test_mcq_answer_stores_selected_index_and_is_idempotent(client, db, sid):
    placed_student(client, db, sid)
    client.post(f"/students/{sid}/session/start", json={"block_index": 0})
    step = serve_practice(client, db, sid)
    cid = step["content"]["id"]
    assert "correct_index" not in step["content"]          # answer key never leaves the server
    body = {"content_id": cid, "selected_index": 2, "time_taken": 9.5}
    r1 = client.post(f"/students/{sid}/mcq-answer", json=body).json()
    n = counts(db, sid)[0]
    r2 = client.post(f"/students/{sid}/mcq-answer", json={**body, "selected_index": 0}).json()
    assert counts(db, sid)[0] == n                          # duplicate not logged
    assert r1["passed"] == r2["passed"]                     # first outcome is replayed
    row = persistence.get_interaction_by_content_id(db, sid, cid)
    assert db.execute("SELECT selected_index FROM interactions WHERE student_id=? AND content_id=?",
                      (sid, cid)).fetchone()["selected_index"] == 2
    assert row["passed"] == int(r1["passed"])


def test_mcq_answer_validation(client, db, sid):
    placed_student(client, db, sid)
    client.post(f"/students/{sid}/session/start", json={"block_index": 0})
    cid = serve_practice(client, db, sid)["content"]["id"]
    assert client.post(f"/students/{sid}/mcq-answer",
                       json={"content_id": cid, "selected_index": 7, "time_taken": 1}).status_code == 422
    assert client.post(f"/students/{sid}/mcq-answer",
                       json={"content_id": "nope", "selected_index": 1, "time_taken": 1}).status_code == 400
    # negative / absurd durations are clamped, not rejected
    r = client.post(f"/students/{sid}/mcq-answer", json={"content_id": cid, "selected_index": 1, "time_taken": -50})
    assert r.status_code == 200
    assert db.execute("SELECT time_taken FROM interactions WHERE student_id=? AND content_id=?",
                      (sid, cid)).fetchone()["time_taken"] == 0.0


def test_content_viewed_validation_and_idempotency(client, db, sid):
    placed_student(client, db, sid)
    bad = {"concept": "Nope", "content_id": "nope-video", "time_taken": 1}
    assert client.post(f"/students/{sid}/content-viewed", json=bad).status_code == 400
    wrong = {"concept": "Lists", "content_id": "syntax-video", "time_taken": 1}
    assert client.post(f"/students/{sid}/content-viewed", json=wrong).status_code == 400
    ok = {"concept": "Lists", "content_id": "lists-video", "time_taken": 30}
    n = counts(db, sid)[0]
    client.post(f"/students/{sid}/content-viewed", json=ok)
    client.post(f"/students/{sid}/content-viewed", json=ok)   # double-tap
    assert counts(db, sid)[0] == n + 1


# ---------------------------------------------------------------- escalation fix
def test_escalation_resets_after_deep_dive_is_read():
    from serving.content_engine import select_content_type
    fail = {"passed": 0, "content_id": "lists-mcq-1"}
    ok = {"passed": 1, "content_id": "lists-mcq-2"}
    dive = {"passed": 1, "content_id": "lists-deepdive"}
    assert select_content_type([]) == "video"
    assert select_content_type([fail]) == "practice_problem"
    assert select_content_type([fail, fail]) == "escalation"
    # regression: after reading the deep-dive the student must get practice questions again
    assert select_content_type([fail, fail, dive]) == "practice_problem"
    assert select_content_type([fail, fail, dive, fail]) == "practice_problem"
    assert select_content_type([fail, fail, dive, fail, fail]) == "escalation"
    assert select_content_type([fail, ok, fail]) == "escalation"


def test_deep_dive_can_be_logged_again_for_a_later_escalation(client, db, sid):
    placed_student(client, db, sid)
    dive = {"concept": "Lists", "content_id": "lists-deepdive", "time_taken": 20}
    n = counts(db, sid)[0]
    client.post(f"/students/{sid}/content-viewed", json=dive)
    client.post(f"/students/{sid}/content-viewed", json=dive)        # double-tap: ignored
    assert counts(db, sid)[0] == n + 1
    persistence.log_interaction_next(db, sid, "Lists", 0, 5, source="tutoring", content_id="lists-mcq-x")
    client.post(f"/students/{sid}/content-viewed", json=dive)        # later, legitimate: logged
    assert counts(db, sid)[0] == n + 3


# ---------------------------------------------------------------- insights data
def test_history_summary_trajectory_analytics_are_consistent(client, db, sid):
    placed_student(client, db, sid, pass_all=False)
    client.post(f"/students/{sid}/session/start", json={"block_index": 0})
    for _ in range(3):
        step = serve_practice(client, db, sid)
        client.post(f"/students/{sid}/mcq-answer",
                    json={"content_id": step["content"]["id"], "selected_index": 0, "time_taken": 11})

    rows = persistence.get_interaction_rows(db, sid)
    h = client.get(f"/students/{sid}/history?limit=100").json()
    assert h["total"] == len(rows)
    assert [i["step_index"] for i in h["items"]] == sorted([r["step_index"] for r in rows], reverse=True)
    assert all(0 <= i["belief_before"] <= 1 and 0 <= i["belief_after"] <= 1 for i in h["items"])

    t = client.get(f"/students/{sid}/mastery/trajectory").json()
    assert len(t["steps"]) == len(rows) and all(len(s["blocks"]) == 5 for s in t["steps"])
    assert client.get(f"/students/{sid}/mastery/trajectory").json() == t       # cached == recomputed
    mastery = client.get(f"/students/{sid}/mastery").json()["beliefs"]
    final_avg = sum(mastery.values()) / 25
    assert t["steps"][-1]["average"] == pytest.approx(final_avg, abs=1e-6)

    s = client.get(f"/students/{sid}/summary?tz=Asia/Karachi").json()
    answered = [r for r in rows if r["source"] == "placement" or "-mcq-" in (r["content_id"] or "")]
    assert s["answered_questions"] == len(answered)
    assert s["correct_answers"] == sum(r["passed"] for r in answered)
    assert s["active_days"] >= 1 and s["current_streak_days"] >= 1

    a = client.get(f"/students/{sid}/analytics").json()
    assert sum(d["answered"] for d in a["activity"]) == len(answered)
    assert a["content_mix"]["placement"] == 7
    assert sum(v["answered"] for v in a["difficulty"].values()) == len(answered)
    assert len(a["blocks"]) == 5

    c = client.get(f"/students/{sid}/concepts").json()["concepts"]
    assert len(c) == 25 and sum(x["attempts"] for x in c) == len(answered)

    # filters + pagination
    only_fail = client.get(f"/students/{sid}/history?result=failed&limit=2").json()
    assert all(i["passed"] is False for i in only_fail["items"]) and len(only_fail["items"]) <= 2
    page1 = client.get(f"/students/{sid}/history?limit=3").json()
    page2 = client.get(f"/students/{sid}/history?limit=3&cursor={page1['next_cursor']}").json()
    assert page1["items"][-1]["step_index"] > page2["items"][0]["step_index"]


def test_bad_query_params_are_422(client, sid):
    assert client.get(f"/students/{sid}/summary?tz=Mars/Base").status_code == 422
    assert client.get(f"/students/{sid}/history?concept=Nope").status_code == 422
    assert client.get(f"/students/{sid}/history?limit=0").status_code == 422
    assert client.get(f"/students/{sid}/mastery/trajectory?concepts=Nope").status_code == 422


def test_unknown_student_reads_are_empty_not_errors(client, sid):
    assert client.get(f"/students/{sid}/history").json() == {"items": [], "next_cursor": None, "total": 0}
    assert client.get(f"/students/{sid}/summary").json()["answered_questions"] == 0
    assert client.get(f"/students/{sid}/mastery/trajectory").json()["steps"] == []
    assert client.get(f"/students/{sid}/analytics").json()["activity"] == []


def test_resources_seen_flags(client, db, sid):
    placed_student(client, db, sid)
    client.post(f"/students/{sid}/content-viewed",
                json={"concept": "While Loops", "content_id": "while-loops-video", "time_taken": 30})
    items = {i["concept"]: i for i in client.get(f"/students/{sid}/resources").json()["items"]}
    assert items["While Loops"]["video"]["seen"] is True and items["For Loops"]["video"]["seen"] is False
    assert "For Loops" in items["While Loops"]["shares_video_with"]   # same URL, shown as shared
