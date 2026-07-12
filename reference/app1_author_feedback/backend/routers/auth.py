from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Auth helpers ──────────────────────────────────────────────────────────────

def require_admin(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    payload = auth_service.verify_token(authorization[7:])
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    if payload.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return payload


def require_auth(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    payload = auth_service.verify_token(authorization[7:])
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    return payload


# ── Pydantic models ───────────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    username: str
    email:    str
    password: str


class LoginBody(BaseModel):
    username: str
    password: str


class AssignBody(BaseModel):
    user_id:     int
    lang:        str
    author_id:   str
    author_name: str


# ── Auth endpoints ────────────────────────────────────────────────────────────

@router.post("/register")
def register(body: RegisterBody):
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    user = auth_service.create_user(body.username, body.email, body.password, role="user")
    if not user:
        raise HTTPException(400, "Username or email already exists")
    return {
        "token":    auth_service.make_token(user),
        "username": user["username"],
        "role":     user["role"],
    }


@router.post("/login")
def login(body: LoginBody):
    user = auth_service.authenticate(body.username, body.password)
    if not user:
        raise HTTPException(401, "Invalid username or password")
    return {
        "token":    auth_service.make_token(user),
        "username": user["username"],
        "role":     user["role"],
    }


# ── User management (admin only) ──────────────────────────────────────────────

@router.get("/users")
def list_users(authorization: str | None = Header(None)):
    require_admin(authorization)
    users  = auth_service.get_users_by_role("user")
    counts = auth_service.get_assignment_counts()
    for u in users:
        u["assignment_count"] = counts.get(u["id"], 0)
    return users


# ── Assignment endpoints ──────────────────────────────────────────────────────

@router.get("/assignments")
def get_assignments(user_id: int = Query(...), authorization: str | None = Header(None)):
    require_admin(authorization)
    return auth_service.get_assignments(user_id)


@router.post("/assignments")
def add_assignment(body: AssignBody, authorization: str | None = Header(None)):
    require_admin(authorization)
    auth_service.add_assignment(body.user_id, body.lang, body.author_id, body.author_name)
    return {"ok": True}


@router.delete("/assignments")
def remove_assignment(
    user_id:   int = Query(...),
    lang:      str = Query(...),
    author_id: str = Query(...),
    authorization: str | None = Header(None),
):
    require_admin(authorization)
    auth_service.remove_assignment(user_id, lang, author_id)
    return {"ok": True}


@router.get("/my-assignments")
def my_assignments(authorization: str | None = Header(None)):
    payload = require_auth(authorization)
    return auth_service.get_assignments(int(payload["sub"]))
