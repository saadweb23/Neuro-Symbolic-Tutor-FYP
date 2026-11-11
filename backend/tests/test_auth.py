"""Authentication, sessions, password reset and per-student authorisation."""
import re

from fastapi.testclient import TestClient

from serving import accounts
from tests.conftest import placed_student, signup


def _fresh(client):
    return TestClient(client.app)


def test_signup_sets_httponly_cookie_and_me_returns_the_user(client):
    user = signup(client, name="Ada Lovelace", email="ada@example.com")
    assert user["email"] == "ada@example.com" and user["name"] == "Ada Lovelace" and user["student_id"].startswith("u")
    assert "password" not in str(user).lower()
    cookie = client.cookies.get(accounts.COOKIE_NAME)
    assert cookie
    me = client.get("/auth/me")
    assert me.status_code == 200 and me.json()["id"] == user["id"]


def test_cookie_flags(client):
    r = client.post("/auth/signup", json={"name": "Flags", "email": "flags@example.com", "password": "correct-horse-9"})
    header = r.headers["set-cookie"].lower()
    assert "httponly" in header and "samesite=lax" in header and "path=/" in header
    assert "max-age" not in header          # session cookie unless "remember me"
    r2 = _fresh(client).post("/auth/login", json={"email": "flags@example.com", "password": "correct-horse-9", "remember": True})
    assert "max-age=2592000" in r2.headers["set-cookie"].lower()


def test_passwords_are_stored_only_as_salted_hashes(client, db):
    signup(client, email="hash@example.com", password="Sup3rSecret-pw")
    stored = db.execute("SELECT password_hash FROM users WHERE email = ?", ("hash@example.com",)).fetchone()["password_hash"]
    assert stored.startswith("scrypt$") and "Sup3rSecret" not in stored
    signup(client, email="hash2@example.com", password="Sup3rSecret-pw")
    other = db.execute("SELECT password_hash FROM users WHERE email = ?", ("hash2@example.com",)).fetchone()["password_hash"]
    assert stored != other                  # unique salt per user
    tokens = db.execute("SELECT token_hash FROM auth_sessions").fetchall()
    assert all(len(t["token_hash"]) == 64 for t in tokens)   # only SHA-256 digests, never the cookie value


def test_signup_validation_and_duplicates(client):
    bad = [
        {"name": "A", "email": "not-an-email", "password": "correct-horse-9"},
        {"name": "A", "email": "a@example.com", "password": "short1"},
        {"name": "A", "email": "a@example.com", "password": "alllettersnodigits"},
        {"name": "A", "email": "a@example.com", "password": "password123"},
        {"name": "", "email": "a@example.com", "password": "correct-horse-9"},
    ]
    for body in bad:
        assert client.post("/auth/signup", json=body).status_code == 422, body
    signup(client, email="dup@example.com")
    again = _fresh(client).post("/auth/signup", json={"name": "B", "email": "DUP@example.com", "password": "correct-horse-9"})
    assert again.status_code == 409


def test_login_logout_and_generic_failure_message(client):
    signup(client, email="login@example.com", password="correct-horse-9")
    c = _fresh(client)
    wrong = c.post("/auth/login", json={"email": "login@example.com", "password": "wrong-password-1"})
    unknown = c.post("/auth/login", json={"email": "nobody@example.com", "password": "wrong-password-1"})
    assert wrong.status_code == unknown.status_code == 401 and wrong.json() == unknown.json()
    assert c.get("/auth/me").status_code == 401
    assert c.post("/auth/login", json={"email": "LOGIN@example.com", "password": "correct-horse-9"}).status_code == 200
    assert c.get("/auth/me").status_code == 200
    assert c.post("/auth/logout").status_code == 200
    assert c.get("/auth/me").status_code == 401


def test_logout_revokes_the_token_server_side(client):
    signup(client, email="revoke@example.com")
    token = client.cookies.get(accounts.COOKIE_NAME)
    client.post("/auth/logout")
    replay = _fresh(client)
    assert replay.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_every_student_route_requires_sign_in_and_ownership(client, db):
    owner = signup(client, email="owner@example.com")["student_id"]
    placed_student(client, db, owner)
    paths = [("get", "status"), ("get", "summary"), ("get", "history"), ("get", "mastery"), ("get", "mastery/trajectory"),
             ("get", "concepts"), ("get", "resources"), ("get", "recommendation"), ("get", "analytics"), ("get", "blocks"),
             ("get", "session"), ("get", "next"), ("post", "session/continue")]
    anon = _fresh(client)
    intruder = _fresh(client)
    signup(intruder, email="intruder@example.com")
    for method, path in paths:
        url = f"/students/{owner}/{path}"
        assert getattr(anon, method)(url).status_code == 401, url
        assert getattr(intruder, method)(url).status_code == 403, url
    for url, body in [(f"/students/{owner}/session/start", {"block_index": 0}),
                      (f"/students/{owner}/mcq-answer", {"content_id": "x", "selected_index": 0, "time_taken": 5}),
                      (f"/students/{owner}/content-viewed", {"concept": "variables", "content_id": "x", "time_taken": 5}),
                      (f"/students/{owner}/placement/start", None), (f"/students/{owner}/placement/submit", [])]:
        assert anon.post(url, json=body).status_code == 401, url
        assert intruder.post(url, json=body).status_code == 403, url
    # public endpoints stay public
    assert anon.get("/meta").status_code == 200 and anon.get("/graph").status_code == 200
    # the owner still reads their data
    assert client.get(f"/students/{owner}/mastery").status_code == 200


def test_intruder_cannot_change_the_owners_data(client, db):
    owner = signup(client, email="owner2@example.com")["student_id"]
    intruder = _fresh(client)
    signup(intruder, email="intruder2@example.com")
    before = db.execute("SELECT COUNT(*) AS n FROM interactions WHERE student_id = ?", (owner,)).fetchone()["n"]
    intruder.post(f"/students/{owner}/placement/submit", json=[])
    assert db.execute("SELECT COUNT(*) AS n FROM interactions WHERE student_id = ?", (owner,)).fetchone()["n"] == before


def test_expired_session_is_rejected(client, db):
    signup(client, email="expire@example.com")
    db.execute("UPDATE auth_sessions SET expires_at = '2000-01-01 00:00:00'")
    db.commit()
    assert client.get("/auth/me").status_code == 401


def test_forgot_and_reset_flow(client):
    signup(client, email="reset@example.com", password="old-password-1")
    c = _fresh(client)
    unknown = c.post("/auth/forgot", json={"email": "ghost@example.com"}).json()
    assert unknown["dev_reset_link"] is None                     # unknown emails reveal nothing
    known = c.post("/auth/forgot", json={"email": "reset@example.com"}).json()
    link = known["dev_reset_link"]                              # development, no SMTP configured
    token = re.search(r"token=([\w\-]+)", link).group(1)
    assert c.post("/auth/reset", json={"token": "bogus", "password": "new-password-2"}).status_code == 400
    assert c.post("/auth/reset", json={"token": token, "password": "weak"}).status_code == 422
    assert c.post("/auth/reset", json={"token": token, "password": "new-password-2"}).status_code == 200
    assert c.post("/auth/reset", json={"token": token, "password": "another-pass-3"}).status_code == 400   # single use
    assert client.get("/auth/me").status_code == 401            # earlier sessions were revoked
    assert c.post("/auth/login", json={"email": "reset@example.com", "password": "old-password-1"}).status_code == 401
    assert c.post("/auth/login", json={"email": "reset@example.com", "password": "new-password-2"}).status_code == 200


def test_reset_link_is_never_returned_in_production(client, monkeypatch):
    signup(client, email="prod@example.com")
    monkeypatch.setenv("NEURO_ENV", "production")
    out = _fresh(client).post("/auth/forgot", json={"email": "prod@example.com"}).json()
    assert out["dev_reset_link"] is None


def test_change_password_keeps_this_session_and_drops_others(client):
    signup(client, email="chg@example.com", password="old-password-1")
    other = _fresh(client)
    other.post("/auth/login", json={"email": "chg@example.com", "password": "old-password-1"})
    assert client.post("/auth/change-password", json={"current_password": "nope-nope-1", "new_password": "new-password-2"}).status_code == 403
    assert client.post("/auth/change-password", json={"current_password": "old-password-1", "new_password": "old-password-1"}).status_code == 422
    assert client.post("/auth/change-password", json={"current_password": "old-password-1", "new_password": "new-password-2"}).status_code == 200
    assert client.get("/auth/me").status_code == 200
    assert other.get("/auth/me").status_code == 401


def test_profile_update_and_account_deletion(client, db):
    user = signup(client, email="del@example.com", password="correct-horse-9")
    assert client.patch("/auth/profile", json={"name": "New Name"}).json()["name"] == "New Name"
    placed_student(client, db, user["student_id"])
    assert client.post("/auth/delete-account", json={"password": "wrong-pass-1"}).status_code == 403
    assert client.post("/auth/delete-account", json={"password": "correct-horse-9"}).status_code == 200
    for table in ("interactions", "mastery_state", "sessions"):
        assert db.execute(f"SELECT 1 FROM {table} WHERE student_id = ?", (user["student_id"],)).fetchone() is None
    assert db.execute("SELECT 1 FROM users WHERE email = 'del@example.com'").fetchone() is None
    assert client.get("/auth/me").status_code == 401


def test_login_rate_limit(client, monkeypatch):
    monkeypatch.setenv("AUTH_RATE_SCALE", "1")
    accounts.limiter.clear()
    signup(client, email="limit@example.com")
    c = _fresh(client)
    codes = [c.post("/auth/login", json={"email": "limit@example.com", "password": "bad-guess-1"}).status_code for _ in range(10)]
    assert codes[:8] == [401] * 8 and codes[8] == 429
    # the correct password is also refused while locked out, and the response says when to retry
    r = c.post("/auth/login", json={"email": "limit@example.com", "password": "correct-horse-9"})
    assert r.status_code == 429 and "Retry-After" in r.headers
    accounts.limiter.clear()


def test_cross_site_state_changing_requests_are_blocked(client):
    r = client.post("/auth/logout", headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    assert client.post("/auth/logout", headers={"Origin": "http://localhost:5173"}).status_code == 200


def test_auth_responses_are_not_cacheable(client):
    signup(client, email="cache@example.com")
    assert client.get("/auth/me").headers["cache-control"] == "no-store"


def test_builtin_admin_account_logs_in_and_owns_its_student(client, db):
    accounts.seed_admin()
    accounts.seed_admin()   # idempotent
    assert db.execute("SELECT COUNT(*) AS n FROM users WHERE email = 'admin'").fetchone()["n"] == 1
    stored = db.execute("SELECT password_hash FROM users WHERE email = 'admin'").fetchone()["password_hash"]
    assert "admin123" not in stored and stored.startswith("scrypt$")
    r = client.post("/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200 and r.json()["student_id"] == "admin"
    assert client.get("/students/admin/status").status_code == 200
    assert _fresh(client).post("/auth/login", json={"username": "admin", "password": "wrong"}).status_code == 401


def test_self_signup_can_be_turned_off(client, monkeypatch):
    monkeypatch.setenv("AUTH_ALLOW_SIGNUP", "0")
    r = client.post("/auth/signup", json={"name": "X", "email": "x@example.com", "password": "correct-horse-9"})
    assert r.status_code == 403
