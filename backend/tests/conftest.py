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
os.environ["AUTH_ALLOW_SIGNUP"] = "1"   # production default is off; the suite creates users through the endpoint
os.environ["AUTH_RATE_SCALE"] = "1000"   # the suite signs up many users; dedicated tests restore real limits

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def _app():
    from main import app
    with TestClient(app):   # runs the lifespan once: loads PPO + warms the tracker
        yield app


@pytest.fixture()
def client(_app):
    """A fresh client (own cookie jar) per test, so a test only ever holds its own sign-in."""
    return TestClient(_app)


@pytest.fixture()
def db():
    from serving import persistence
    conn = persistence.init_db()
    yield conn
    conn.close()


_counter = [0]


def signup(client, name="Test Student", email=None, password="correct-horse-9"):
    """Creates an account through the real endpoint; the client keeps the session cookie."""
    _counter[0] += 1
    email = email or f"student{_counter[0]}-{os.getpid()}@example.com"
    resp = client.post("/auth/signup", json={"name": name, "email": email, "password": password})
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def sid(client):
    """The student id of a freshly signed-up account; `client` is signed in as its owner."""
    return signup(client)["student_id"]


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
