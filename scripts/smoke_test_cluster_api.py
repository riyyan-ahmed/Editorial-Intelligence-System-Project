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


def check(name, response, ok_status=200):
    print(name, response.status_code)
    if response.status_code != ok_status:
        print(response.text[:500])
        raise SystemExit(1)
    return response


def main():
    check("health", requests.get(f"{BASE_URL}/api/health", timeout=10))
    check(
        "clusters_no_auth",
        requests.get(f"{BASE_URL}/api/clusters/stats", timeout=10),
        ok_status=401,
    )

    with get_cursor() as cur:
        cur.execute(
            "SELECT id, username, role FROM app_users WHERE role = %s ORDER BY id LIMIT 1",
            ("admin",),
        )
        user = cur.fetchone()
        if not user:
            raise SystemExit("No admin user found for smoke test")

    token = make_token({"id": user["id"], "username": user["username"], "role": user["role"]})
    headers = {"Authorization": f"Bearer {token}"}

    stats = check("stats", requests.get(f"{BASE_URL}/api/clusters/stats", headers=headers, timeout=20)).json()
    print("stats_languages", [row["language"] for row in stats])

    clusters = check(
        "clusters",
        requests.get(
            f"{BASE_URL}/api/clusters",
            params={"lang": "el", "limit": 3},
            headers=headers,
            timeout=20,
        ),
    ).json()
    print("cluster_count", clusters["count"])
    if not clusters["items"]:
        raise SystemExit("No clusters returned")

    cluster_id = clusters["items"][0]["id"]
    print("first_cluster_id", cluster_id)

    detail = check(
        "detail",
        requests.get(f"{BASE_URL}/api/clusters/{cluster_id}", headers=headers, timeout=20),
    ).json()
    print("detail_title_present", bool(detail.get("title")))

    sources = check(
        "sources",
        requests.get(
            f"{BASE_URL}/api/clusters/{cluster_id}/sources",
            params={"limit": 5},
            headers=headers,
            timeout=20,
        ),
    ).json()
    print("source_rows", len(sources))

    articles = check(
        "articles",
        requests.get(
            f"{BASE_URL}/api/clusters/{cluster_id}/articles",
            params={"limit": 5},
            headers=headers,
            timeout=20,
        ),
    ).json()
    print("article_rows", len(articles))

    rag = check(
        "rag_context",
        requests.get(
            f"{BASE_URL}/api/clusters/{cluster_id}/rag-context",
            params={"limit": 5},
            headers=headers,
            timeout=20,
        ),
    ).json()
    print("rag_articles", len(rag["articles"]))
    print("rag_selection_method", rag["selection_method"])
    print("rag_mmr_ranks", [a.get("mmr_rank") for a in rag["articles"]])

    print("ok")


if __name__ == "__main__":
    main()
