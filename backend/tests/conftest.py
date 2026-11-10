"""Backend tests run against a throwaway SQLite database and the pre-generated question bank,
with the real tracker and PPO checkpoints. Environment must be set BEFORE `main` is imported
because the database path is read at import time."""
import os
import sys
import tempfile

_TMP = tempfile.mkdtemp(prefix="neurotutor-tests-")
os.environ["TUTOR_DB_PATH"] = os.path.join(_TMP, "test.db")
os.environ["USE_QUESTION_BANK"] = "true"
os.environ.pop("MOCK_LLM", None)

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from main import app
    with TestClient(app) as c:   # runs the lifespan: loads PPO + warms the tracker
        yield c


@pytest.fixture()
def db():
    from serving import persistence
    conn = persistence.init_db()
    yield conn
    conn.close()


_counter = [0]


@pytest.fixture()
def sid():
    """A fresh student id per test, so tests don't depend on each other's data."""
    _counter[0] += 1
    return f"test-student-{_counter[0]}"


def placed_student(client, db, student_id, pass_all=True):
    """Runs the real placement flow (start -> answer -> submit) and returns the beliefs."""
    from serving import persistence
    questions = client.post(f"/students/{student_id}/placement/start").json()["questions"]
    answers = []
    for q in questions:
        payload = persistence.get_generated_question(db, q["content_id"])
        correct = payload["correct_index"]
        pick = correct if pass_all else (correct + 1) % 4
        answers.append({"content_id": q["content_id"], "selected_index": pick, "time_taken": 12.0})
    resp = client.post(f"/students/{student_id}/placement/submit", json=answers)
    assert resp.status_code == 200, resp.text
    return resp.json()["beliefs"]
