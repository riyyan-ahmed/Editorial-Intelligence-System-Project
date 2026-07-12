"""
Postgres-backed auth service.
Replaces the old SQLite auth_db.py.
All tables live in the same Postgres DB as the rest of the app.
"""
import hashlib
import os
import time
from jose import jwt, JWTError
import config
from database import get_cursor


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def make_token(user: dict) -> str:
    payload = {
        "sub":      str(user["id"]),
        "username": user["username"],
        "role":     user["role"],
        "exp":      time.time() + config.JWT_EXPIRE_HOURS * 3600,
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
    except JWTError:
        return None


# ── Seeding ───────────────────────────────────────────────────────────────────

def seed_users():
    """Ensure default credentials exist. Idempotent — safe to call on every startup."""
    seeds = [
        ("admin", "admin@editorial.local", os.getenv("SEED_ADMIN_PASSWORD", "change-me-admin"), "admin"),
        ("user1", "user1@editorial.local", os.getenv("SEED_USER1_PASSWORD", "change-me-user1"), "user"),
        ("user2", "user2@editorial.local", os.getenv("SEED_USER2_PASSWORD", "change-me-user2"), "user"),
    ]
    with get_cursor() as cur:
        for username, email, password, role in seeds:
            cur.execute("SELECT id FROM app_users WHERE username = %s", (username,))
            row = cur.fetchone()
            if row:
                cur.execute(
                    "UPDATE app_users SET password = %s, role = %s WHERE username = %s",
                    (_hash(password), role, username),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO app_users (username, email, password, role)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (username, email, _hash(password), role),
                )
        cur.connection.commit()


# ── User CRUD ─────────────────────────────────────────────────────────────────

def create_user(username: str, email: str, password: str, role: str = "user") -> dict | None:
    with get_cursor() as cur:
        try:
            cur.execute(
                """
                INSERT INTO app_users (username, email, password, role)
                VALUES (%s, %s, %s, %s)
                RETURNING id, username, email, role
                """,
                (username.strip(), email.strip().lower(), _hash(password), role),
            )
            row = cur.fetchone()
            cur.connection.commit()
            return dict(row) if row else None
        except Exception:
            cur.connection.rollback()
            return None


def authenticate(username: str, password: str) -> dict | None:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT * FROM app_users
            WHERE (username = %s OR email = %s) AND password = %s
            """,
            (username.strip(), username.strip().lower(), _hash(password)),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_users_by_role(role: str = "user") -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, username, role FROM app_users WHERE role = %s ORDER BY id",
            (role,),
        )
        return [dict(r) for r in cur.fetchall()]


# ── Assignment CRUD ───────────────────────────────────────────────────────────

def get_assignments(user_id: int) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT lang, author_id, author_name
            FROM author_assignments
            WHERE user_id = %s
            ORDER BY lang, author_name
            """,
            (user_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def add_assignment(user_id: int, lang: str, author_id: str, author_name: str) -> bool:
    with get_cursor() as cur:
        try:
            cur.execute(
                """
                INSERT INTO author_assignments (user_id, lang, author_id, author_name)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                """,
                (user_id, lang, author_id, author_name),
            )
            cur.connection.commit()
            return True
        except Exception:
            cur.connection.rollback()
            return False


def remove_assignment(user_id: int, lang: str, author_id: str) -> bool:
    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM author_assignments WHERE user_id = %s AND lang = %s AND author_id = %s",
            (user_id, lang, author_id),
        )
        cur.connection.commit()
        return True


def get_assignment_counts() -> dict[int, int]:
    with get_cursor() as cur:
        cur.execute(
            "SELECT user_id, COUNT(*) AS cnt FROM author_assignments GROUP BY user_id"
        )
        return {r["user_id"]: r["cnt"] for r in cur.fetchall()}
