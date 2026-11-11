"""Accounts, sessions and password reset.

Security model
* Passwords: salted scrypt (stdlib), constant-time comparison; never stored or logged in plain text.
* Sessions: an opaque random token in an HttpOnly cookie; only its SHA-256 digest is stored, so a
  leaked database cannot be replayed. Sessions expire and are revoked on logout / password change.
* Reset tokens: random, single-use, 1 hour, stored as digests; a reset revokes every session.
* Rate limits (in memory, per process) slow credential guessing and signup / reset abuse.
Every account owns exactly one `student_id`; the API authorises each /students/{id} request against it.
"""
import base64
import hashlib
import hmac
import logging
import os
import re
import secrets
import smtplib
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from serving import persistence

log = logging.getLogger("neurotutor.auth")

COOKIE_NAME = "nt_session"
SESSION_HOURS = 12
REMEMBER_DAYS = 30
RESET_MINUTES = 60

_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2 ** 14, 8, 1
_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)+$")
_COMMON = {
    "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwertyuiop", "qwerty123",
    "iloveyou", "11111111", "abc12345", "letmein123", "welcome123", "admin123", "passw0rd", "neurotutor",
}


class AuthError(Exception):
    """Raised with a user-safe message and the HTTP status the route should answer with."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


# ---- time helpers (timestamps are 'YYYY-MM-DD HH:MM:SS' UTC text, like the rest of the database) ----
def _fmt(dt):
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _now():
    return datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None)


# ---- passwords -------------------------------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=32)
    return "scrypt${}${}${}${}${}".format(_SCRYPT_N, _SCRYPT_R, _SCRYPT_P,
                                          base64.b64encode(salt).decode(), base64.b64encode(digest).decode())


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, digest_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(digest_b64)
        actual = hashlib.scrypt(password.encode(), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected))
    except Exception:
        return False
    return hmac.compare_digest(actual, expected)


_DUMMY_HASH = None


def _dummy_verify(password):
    """Spends the same time as a real check so 'unknown email' and 'wrong password' are indistinguishable."""
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = hash_password("dummy-password-for-timing")
    verify_password(password, _DUMMY_HASH)


def password_problem(password: str, email: str = "", name: str = ""):
    """Returns a human-readable reason the password is unacceptable, or None."""
    if len(password) < 8:
        return "Use at least 8 characters."
    if len(password) > 128:
        return "Use at most 128 characters."
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        return "Include at least one letter and one number."
    low = password.lower()
    if low in _COMMON:
        return "That password is too common."
    if email and low == email.lower():
        return "The password must not be your email."
    return None


def normalize_email(email: str) -> str:
    email = (email or "").strip().lower()
    if len(email) > 254 or not _EMAIL_RE.match(email):
        raise AuthError("Enter a valid email address.", 422)
    return email


_USERNAME_RE = re.compile(r"^[a-z0-9._\-]{1,64}$")


def normalize_identifier(value: str) -> str:
    """Sign-in identifier: an email address, or a plain username (e.g. the seeded administrator)."""
    value = (value or "").strip().lower()
    if "@" in value:
        return normalize_email(value)
    if not _USERNAME_RE.match(value):
        raise AuthError("Enter your username.", 422)
    return value


def clean_name(name: str) -> str:
    name = re.sub(r"\s+", " ", (name or "").strip())
    if not 1 <= len(name) <= 60 or re.search(r"[\x00-\x1f<>]", name):
        raise AuthError("Enter your name (1-60 characters).", 422)
    return name


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---- rate limiting ---------------------------------------------------------------------------------
class RateLimiter:
    def __init__(self):
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_s: int):
        """Records an attempt; raises AuthError(429) when `limit` attempts happened inside the window."""
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window_s:
                q.popleft()
            if len(q) >= limit:
                retry = int(window_s - (now - q[0])) + 1
                raise AuthError(f"Too many attempts. Try again in {max(1, retry // 60) if retry >= 60 else retry} "
                                f"{'minute(s)' if retry >= 60 else 'second(s)'}.", 429)
            q.append(now)
            if len(self._hits) > 20000:   # bound memory under a flood of distinct keys
                for k in [k for k, v in self._hits.items() if not v or now - v[-1] > window_s][:5000]:
                    self._hits.pop(k, None)

    def reset(self, key: str):
        with self._lock:
            self._hits.pop(key, None)

    def clear(self):
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def _scale() -> float:
    """Tests raise every limit (AUTH_RATE_SCALE) so the suite is not throttled; production uses 1."""
    try:
        return float(os.environ.get("AUTH_RATE_SCALE", "1"))
    except ValueError:
        return 1.0


def throttle(action: str, key: str, limit: int, window_s: int):
    limiter.check(f"{action}:{key}", max(1, int(limit * _scale())), window_s)


# ---- users -----------------------------------------------------------------------------------------
def _user_dict(row):
    return {
        "id": row["id"], "email": row["email"], "name": row["display_name"], "student_id": row["student_id"],
        "created_at": row["created_at"], "last_login_at": row["last_login_at"],
    }


def create_user(name, email, password):
    name, email = clean_name(name), normalize_email(email)
    problem = password_problem(password, email, name)
    if problem:
        raise AuthError(problem, 422)
    user_id = secrets.token_hex(12)
    student_id = "u" + secrets.token_hex(8)
    pw_hash = hash_password(password)
    now = _fmt(_now())
    conn = persistence.init_db()
    try:
        if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
            raise AuthError("An account with this email already exists. Try signing in.", 409)
        persistence.ensure_student(conn, student_id)
        cur = conn.execute(
            "INSERT INTO users (id, email, display_name, password_hash, student_id, created_at, last_login_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING", (user_id, email, name, pw_hash, student_id, now, now))
        conn.commit()
        if cur.rowcount == 0:   # lost a race with a concurrent signup for the same email
            raise AuthError("An account with this email already exists. Try signing in.", 409)
        return _user_dict(conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())
    finally:
        conn.close()


def authenticate(email, password):
    try:
        email = normalize_identifier(email)
    except AuthError:
        _dummy_verify(password)
        raise AuthError("Incorrect username or password.", 401)
    conn = persistence.init_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row is None:
            _dummy_verify(password)
            raise AuthError("Incorrect username or password.", 401)
        if not verify_password(password, row["password_hash"]):
            raise AuthError("Incorrect username or password.", 401)
        conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (_fmt(_now()), row["id"]))
        conn.commit()
        return _user_dict(row)
    finally:
        conn.close()


def get_user(user_id):
    conn = persistence.init_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return _user_dict(row) if row else None
    finally:
        conn.close()


# ---- sessions --------------------------------------------------------------------------------------
def create_session(user_id, remember=False, user_agent=None):
    """Returns (token, max_age_seconds_or_None). The cookie is persistent only with `remember`."""
    token = secrets.token_urlsafe(32)
    ttl = timedelta(days=REMEMBER_DAYS) if remember else timedelta(hours=SESSION_HOURS)
    now = _now()
    conn = persistence.init_db()
    try:
        conn.execute("DELETE FROM auth_sessions WHERE expires_at < ?", (_fmt(now),))   # opportunistic cleanup
        conn.execute(
            "INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)",
            (_digest(token), user_id, _fmt(now), _fmt(now + ttl), (user_agent or "")[:200]))
        conn.commit()
    finally:
        conn.close()
    return token, (int(ttl.total_seconds()) if remember else None)


def user_for_token(token):
    if not token:
        return None
    conn = persistence.init_db()
    try:
        row = conn.execute(
            "SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id "
            "WHERE s.token_hash = ? AND s.expires_at > ?", (_digest(token), _fmt(_now()))).fetchone()
        return _user_dict(row) if row else None
    finally:
        conn.close()


def revoke_session(token):
    if not token:
        return
    conn = persistence.init_db()
    try:
        conn.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (_digest(token),))
        conn.commit()
    finally:
        conn.close()


def revoke_user_sessions(user_id, keep_token=None):
    conn = persistence.init_db()
    try:
        if keep_token:
            conn.execute("DELETE FROM auth_sessions WHERE user_id = ? AND token_hash <> ?", (user_id, _digest(keep_token)))
        else:
            conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()


# ---- password management ---------------------------------------------------------------------------
def change_password(user_id, current, new, keep_token=None):
    conn = persistence.init_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None or not verify_password(current, row["password_hash"]):
            raise AuthError("Your current password is incorrect.", 403)
        problem = password_problem(new, row["email"], row["display_name"])
        if problem:
            raise AuthError(problem, 422)
        if verify_password(new, row["password_hash"]):
            raise AuthError("Choose a password you have not used on this account.", 422)
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new), user_id))
        conn.commit()
    finally:
        conn.close()
    revoke_user_sessions(user_id, keep_token=keep_token)


def update_name(user_id, name):
    name = clean_name(name)
    conn = persistence.init_db()
    try:
        conn.execute("UPDATE users SET display_name = ? WHERE id = ?", (name, user_id))
        conn.commit()
    finally:
        conn.close()
    return get_user(user_id)


def create_reset_token(email):
    """Returns (user, token) for a known email, else None. The caller must answer identically either way."""
    try:
        email = normalize_email(email)
    except AuthError:
        return None
    conn = persistence.init_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row is None:
            return None
        token = secrets.token_urlsafe(32)
        now = _now()
        conn.execute("DELETE FROM password_resets WHERE user_id = ?", (row["id"],))
        conn.execute("INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                     (_digest(token), row["id"], _fmt(now), _fmt(now + timedelta(minutes=RESET_MINUTES))))
        conn.commit()
        return _user_dict(row), token
    finally:
        conn.close()


def reset_password(token, new_password):
    conn = persistence.init_db()
    try:
        row = conn.execute(
            "SELECT r.user_id, r.used_at, r.expires_at, u.email, u.display_name FROM password_resets r "
            "JOIN users u ON u.id = r.user_id WHERE r.token_hash = ?", (_digest(token or ""),)).fetchone()
        if row is None or row["used_at"] or row["expires_at"] <= _fmt(_now()):
            raise AuthError("This reset link is invalid or has expired. Request a new one.", 400)
        problem = password_problem(new_password, row["email"], row["display_name"])
        if problem:
            raise AuthError(problem, 422)
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new_password), row["user_id"]))
        conn.execute("UPDATE password_resets SET used_at = ? WHERE token_hash = ?", (_fmt(_now()), _digest(token)))
        conn.commit()
        user_id = row["user_id"]
    finally:
        conn.close()
    revoke_user_sessions(user_id)


def delete_account(user_id, password):
    """Deletes the account and every record of its student (interactions, caches, sessions)."""
    conn = persistence.init_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None or not verify_password(password, row["password_hash"]):
            raise AuthError("Your password is incorrect.", 403)
        student_id = row["student_id"]
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))   # cascades auth_sessions / password_resets
        persistence.delete_student_data(conn, student_id)
        conn.commit()
    finally:
        conn.close()


# ---- reset delivery --------------------------------------------------------------------------------
def smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST"))


def send_reset_email(user, link):
    msg = EmailMessage()
    msg["Subject"] = "Reset your NeuroTutor password"
    msg["From"] = os.environ.get("SMTP_FROM") or os.environ.get("SMTP_USER") or "noreply@neurotutor.local"
    msg["To"] = user["email"]
    msg.set_content(
        f"Hi {user['name']},\n\nUse this link to choose a new password (valid for {RESET_MINUTES} minutes, one use):\n\n"
        f"{link}\n\nIf you did not ask for this, ignore this email; your password has not changed.\n")
    host, port = os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=15) as smtp:
        smtp.starttls()
        if os.environ.get("SMTP_USER"):
            smtp.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
        smtp.send_message(msg)


def seed_admin():
    """Ensures the built-in administrator account exists (username `admin`, password `admin123` unless
    ADMIN_USERNAME / ADMIN_PASSWORD override them). Only the hash is stored. Never overwrites an existing
    account, so changing the password later sticks. AUTH_SEED_ADMIN=0 turns this off."""
    if os.environ.get("AUTH_SEED_ADMIN", "1") == "0":
        return
    username = (os.environ.get("ADMIN_USERNAME") or "admin").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD") or "admin123"
    conn = persistence.init_db()
    try:
        if conn.execute("SELECT 1 FROM users WHERE email = ?", (username,)).fetchone():
            return
        student_id = "admin" if username == "admin" else "u" + secrets.token_hex(8)
        persistence.ensure_student(conn, student_id)
        now = _fmt(_now())
        conn.execute(
            "INSERT INTO users (id, email, display_name, password_hash, student_id, created_at, last_login_at) "
            "VALUES (?, ?, ?, ?, ?, ?, NULL) ON CONFLICT DO NOTHING",
            (secrets.token_hex(12), username, "Administrator", hash_password(password), student_id, now))
        conn.commit()
        log.warning("created the built-in '%s' account; change its password (ADMIN_PASSWORD) before exposing the app", username)
    finally:
        conn.close()
