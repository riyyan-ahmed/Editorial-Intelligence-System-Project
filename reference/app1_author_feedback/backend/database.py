import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from decimal import Decimal
import datetime
import config


def _cfg():
    return {
        "host":     config.DB_HOST,
        "port":     config.DB_PORT,
        "dbname":   config.DB_NAME,
        "user":     config.DB_USER,
        "password": config.DB_PASSWORD,
    }


@contextmanager
def get_cursor():
    conn = psycopg2.connect(**_cfg(), cursor_factory=RealDictCursor)
    try:
        cur = conn.cursor()
        yield cur
    finally:
        conn.close()


def clean(v):
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (datetime.datetime, datetime.date)):
        s = str(v)[:10]
        return None if s.startswith("0000") else s
    return v


def row_to_dict(row) -> dict:
    return {k: clean(v) for k, v in dict(row).items()}


def init_all_tables():
    """Create all application tables if they do not exist. Idempotent."""
    with get_cursor() as cur:
        # ── Users ──────────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS app_users (
                id         SERIAL PRIMARY KEY,
                username   TEXT UNIQUE NOT NULL,
                email      TEXT UNIQUE NOT NULL,
                password   TEXT NOT NULL,
                role       TEXT NOT NULL DEFAULT 'user',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # ── Author assignments (FK → app_users) ───────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS author_assignments (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                lang        TEXT NOT NULL,
                author_id   TEXT NOT NULL,
                author_name TEXT NOT NULL,
                assigned_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, lang, author_id)
            )
        """)

        # ── Evaluations (FK → app_users) ───────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS evaluations (
                id           SERIAL PRIMARY KEY,
                user_id      INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                username     TEXT NOT NULL,
                lang         TEXT NOT NULL,
                author_id    TEXT NOT NULL,
                author_name  TEXT NOT NULL,
                query        TEXT NOT NULL,
                qwen_content TEXT NOT NULL,
                user_content TEXT NOT NULL,
                hter_score   FLOAT,
                chrf_score   FLOAT,
                comet_score  FLOAT,
                evaluated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        cur.connection.commit()
