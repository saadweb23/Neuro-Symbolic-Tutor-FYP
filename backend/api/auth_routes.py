"""Account endpoints: sign up / in / out, current user, password reset and change, profile, delete."""
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from api.deps import optional_user, require_user, session_token
from serving import accounts
from serving.accounts import AuthError

log = logging.getLogger("neurotutor.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    student_id: str
    created_at: str
    last_login_at: Optional[str] = None


class SignupIn(BaseModel):
    name: str = Field(max_length=200)
    email: str = Field(max_length=320)
    password: str = Field(max_length=1000)
    remember: bool = False


class LoginIn(BaseModel):
    username: Optional[str] = Field(default=None, max_length=320)
    email: Optional[str] = Field(default=None, max_length=320)   # alias accepted for API clients
    password: str = Field(max_length=1000)
    remember: bool = False


class ForgotIn(BaseModel):
    email: str = Field(max_length=320)


class ForgotOut(BaseModel):
    message: str
    # Only when the server has no email service AND is not in production: the link that would have been
    # emailed, so a local install can still complete a reset. Never present in production.
    dev_reset_link: Optional[str] = None


class ResetIn(BaseModel):
    token: str = Field(max_length=200)
    password: str = Field(max_length=1000)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=1000)
    new_password: str = Field(max_length=1000)


class ProfileIn(BaseModel):
    name: str = Field(max_length=200)


class DeleteAccountIn(BaseModel):
    password: str = Field(max_length=1000)


class MessageOut(BaseModel):
    message: str


def _is_https(request: Request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto", "").split(",")[0].strip() == "https"


def _set_cookie(request: Request, response: Response, token: str, max_age: Optional[int]):
    samesite = os.environ.get("COOKIE_SAMESITE", "lax").lower()
    if samesite not in ("lax", "strict", "none"):
        samesite = "lax"
    response.set_cookie(
        accounts.COOKIE_NAME, token, max_age=max_age, httponly=True, path="/",
        secure=_is_https(request) or samesite == "none", samesite=samesite)


def _clear_cookie(response: Response):
    response.delete_cookie(accounts.COOKIE_NAME, path="/")


def _client_ip(request: Request) -> str:
    if os.environ.get("TRUST_PROXY") == "1":
        fwd = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for", "")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _raise(exc: AuthError):
    headers = {"Retry-After": "60"} if exc.status == 429 else None
    raise HTTPException(status_code=exc.status, detail=exc.message, headers=headers)


@router.post("/signup", response_model=UserOut, status_code=201)
def signup(body: SignupIn, request: Request, response: Response):
    if os.environ.get("AUTH_ALLOW_SIGNUP", "0") != "1":
        raise HTTPException(status_code=403, detail="Self-service sign-up is turned off on this server.")
    try:
        accounts.throttle("signup", _client_ip(request), 10, 3600)
        user = accounts.create_user(body.name, body.email, body.password)
    except AuthError as exc:
        _raise(exc)
    token, max_age = accounts.create_session(user["id"], body.remember, request.headers.get("user-agent"))
    _set_cookie(request, response, token, max_age)
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, request: Request, response: Response):
    identifier = body.username or body.email or ""
    ip, email_key = _client_ip(request), identifier.strip().lower()
    try:
        accounts.throttle("login-ip", ip, 40, 900)
        accounts.throttle("login-email", email_key, 8, 900)   # slows guessing one account from many IPs
        user = accounts.authenticate(identifier, body.password)
    except AuthError as exc:
        _raise(exc)
    accounts.limiter.reset(f"login-email:{email_key}")
    token, max_age = accounts.create_session(user["id"], body.remember, request.headers.get("user-agent"))
    _set_cookie(request, response, token, max_age)
    return user


@router.post("/logout", response_model=MessageOut)
def logout(request: Request, response: Response):
    accounts.revoke_session(session_token(request))
    _clear_cookie(response)
    return {"message": "Signed out."}


@router.post("/logout-all", response_model=MessageOut)
def logout_all(response: Response, user: dict = Depends(require_user)):
    accounts.revoke_user_sessions(user["id"])
    _clear_cookie(response)
    return {"message": "Signed out on every device."}


@router.get("/me", response_model=UserOut)
def me(user: Optional[dict] = Depends(optional_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Not signed in.")
    return user


@router.post("/forgot", response_model=ForgotOut)
def forgot(body: ForgotIn, request: Request):
    """Always answers the same way, so it cannot be used to discover which emails have accounts."""
    try:
        accounts.throttle("forgot", _client_ip(request), 5, 3600)
    except AuthError as exc:
        _raise(exc)
    result = accounts.create_reset_token(body.email)
    out = {"message": "If an account exists for that email, a reset link is on its way."}
    if result is None:
        return out
    user, token = result
    base = (request.headers.get("origin") or str(request.base_url)).rstrip("/")
    link = f"{base}/reset-password?token={token}"
    if accounts.smtp_configured():
        try:
            accounts.send_reset_email(user, link)
        except Exception:
            log.exception("could not send the password reset email")
    elif os.environ.get("NEURO_ENV", "development").lower() != "production":
        out["dev_reset_link"] = link
        out["message"] = "Email is not configured on this server, so the reset link is shown below instead."
    else:
        log.warning("password reset requested but SMTP is not configured; the link was not delivered")
    return out


@router.post("/reset", response_model=MessageOut)
def reset(body: ResetIn, request: Request):
    try:
        accounts.throttle("reset", _client_ip(request), 10, 3600)
        accounts.reset_password(body.token, body.password)
    except AuthError as exc:
        _raise(exc)
    return {"message": "Password updated. Sign in with your new password."}


@router.post("/change-password", response_model=MessageOut)
def change_password(body: ChangePasswordIn, request: Request, user: dict = Depends(require_user)):
    try:
        accounts.throttle("change-password", user["id"], 8, 900)
        accounts.change_password(user["id"], body.current_password, body.new_password, keep_token=session_token(request))
    except AuthError as exc:
        _raise(exc)
    return {"message": "Password changed. Other devices were signed out."}


@router.patch("/profile", response_model=UserOut)
def profile(body: ProfileIn, user: dict = Depends(require_user)):
    try:
        return accounts.update_name(user["id"], body.name)
    except AuthError as exc:
        _raise(exc)


@router.post("/delete-account", response_model=MessageOut)
def delete_account(body: DeleteAccountIn, response: Response, user: dict = Depends(require_user)):
    try:
        accounts.throttle("delete", user["id"], 5, 900)
        accounts.delete_account(user["id"], body.password)
    except AuthError as exc:
        _raise(exc)
    _clear_cookie(response)
    return {"message": "Your account and learning data were deleted."}
