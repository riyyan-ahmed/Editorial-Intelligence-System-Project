#!/usr/bin/env python3
import sys
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from database import get_cursor  # noqa: E402
from services.auth_service import make_token  # noqa: E402


BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5045"


def main():
    with get_cursor() as cur:
        cur.execute("SELECT id, username, role FROM app_users WHERE role = %s ORDER BY id LIMIT 1", ("admin",))
        user = cur.fetchone()
        if not user:
            raise SystemExit("No admin user found for smoke test")

        cur.execute(
            """
            SELECT author_id, author_name
            FROM english_author_styles
            WHERE author_id IS NOT NULL AND author_name IS NOT NULL
            GROUP BY author_id, author_name
            ORDER BY COUNT(*) DESC
            LIMIT 1
            """
        )
        author = cur.fetchone()
        if not author:
            raise SystemExit("No English author found for smoke test")

        cur.execute(
            """
            SELECT id
            FROM topic_clusters
            WHERE language = 'en'
              AND status = 'active'
              AND articles_count >= 2
            ORDER BY articles_count DESC
            LIMIT 1
            """
        )
        cluster = cur.fetchone()
        if not cluster:
            raise SystemExit("No English cluster found for smoke test")

    token = make_token({"id": user["id"], "username": user["username"], "role": user["role"]})
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "cluster_id": cluster["id"],
        "style_mode": "author",
        "author_id": author["author_id"],
        "author_name": author["author_name"],
        "rag_limit": 3,
    }

    response = requests.post(
        f"{BASE_URL}/api/generation/cluster-generate",
        json=payload,
        headers=headers,
        timeout=240,
    )
    print("cluster_generate_status", response.status_code)
    if response.status_code != 200:
        print(response.text[:1000])
        raise SystemExit(1)

    body = response.json()
    print("cluster_id", body["cluster"]["id"])
    print("author_name", body.get("author_name"))
    print("rag_articles", len(body.get("rag_articles", [])))
    print("rag_mmr_ranks", [a.get("mmr_rank") for a in body.get("rag_articles", [])])
    print("style_articles", len(body.get("style_articles", [])))
    print("history_id", body.get("generation_history_id"))
    print("generated_chars", len(body.get("generated_content") or ""))
    print("error", body.get("generation_error"))

    if not body.get("generation_history_id"):
        raise SystemExit("No generation_history_id returned")
    if len(body.get("generated_content") or "") < 200:
        raise SystemExit("Generated content too short")
    if not body.get("rag_articles"):
        raise SystemExit("No RAG articles returned")

    print("ok")


if __name__ == "__main__":
    main()
