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
        print(response.text[:1000])
        raise SystemExit(1)
    return response


def main():
    with get_cursor() as cur:
        cur.execute("SELECT id, username, role FROM app_users WHERE role = %s ORDER BY id LIMIT 1", ("admin",))
        user = cur.fetchone()
        if not user:
            raise SystemExit("No admin user found")

        cur.execute(
            """
            SELECT id, generated_content
            FROM generation_history
            WHERE generated_content IS NOT NULL
              AND LENGTH(generated_content) > 200
            ORDER BY id DESC
            LIMIT 1
            """
        )
        generation = cur.fetchone()
        if not generation:
            raise SystemExit("No generated draft found. Run smoke_test_cluster_generation.py first.")

    token = make_token({"id": user["id"], "username": user["username"], "role": user["role"]})
    headers = {"Authorization": f"Bearer {token}"}
    generation_id = generation["id"]

    history = check(
        "history",
        requests.get(f"{BASE_URL}/api/generation/history", headers=headers, timeout=20),
    ).json()
    print("history_items", len(history.get("items", [])))

    detail = check(
        "history_detail_before",
        requests.get(f"{BASE_URL}/api/generation/history/{generation_id}", headers=headers, timeout=20),
    ).json()
    print("detail_id", detail["id"])
    print("feedback_before", len(detail.get("feedback", [])))

    edited = generation["generated_content"] + "\n\n[Editorial test note: reviewed draft for workflow validation.]"
    feedback = check(
        "cluster_submit",
        requests.post(
            f"{BASE_URL}/api/evaluation/cluster-submit",
            headers=headers,
            json={
                "generation_history_id": generation_id,
                "user_content": edited,
                "rating": 4,
                "notes": "Smoke test feedback for unified workflow.",
            },
            timeout=30,
        ),
    ).json()
    print("evaluation_id", feedback["evaluation_id"])
    print("editor_correction_id", feedback["editor_correction_id"])
    print("cluster_feedback_id", feedback["cluster_feedback_id"])
    print("hter_score", feedback["hter_score"])
    print("chrf_score", feedback["chrf_score"])

    detail_after = check(
        "history_detail_after",
        requests.get(f"{BASE_URL}/api/generation/history/{generation_id}", headers=headers, timeout=20),
    ).json()
    print("feedback_after", len(detail_after.get("feedback", [])))

    if not feedback.get("cluster_feedback_id"):
        raise SystemExit("No cluster feedback id returned")
    if len(detail_after.get("feedback", [])) <= len(detail.get("feedback", [])):
        raise SystemExit("Feedback count did not increase")

    print("ok")


if __name__ == "__main__":
    main()
