"""Authentication / authorisation dependencies shared by every route that touches student data."""
from typing import Optional

from fastapi import Depends, HTTPException, Request

from api.schemas import StudentId
from serving import accounts


def session_token(request: Request) -> Optional[str]:
    """The session token: the HttpOnly cookie, or `Authorization: Bearer <token>` for non-browser clients."""
    token = request.cookies.get(accounts.COOKIE_NAME)
    if token:
        return token
    auth = request.headers.get("authorization", "")
    return auth[7:].strip() if auth.lower().startswith("bearer ") else None


def optional_user(request: Request) -> Optional[dict]:
    cached = getattr(request.state, "auth_user", False)
    if cached is not False:
        return cached
    user = accounts.user_for_token(session_token(request))
    request.state.auth_user = user
    return user


def require_user(user: Optional[dict] = Depends(optional_user)) -> dict:
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in to continue.", headers={"WWW-Authenticate": "Bearer"})
    return user


def authorize_student(student_id: StudentId, user: dict = Depends(require_user)) -> dict:
    """401 when signed out, 403 when the signed-in account does not own this student id."""
    if user["student_id"] != student_id:
        raise HTTPException(status_code=403, detail="You can only access your own learning data.")
    return user
