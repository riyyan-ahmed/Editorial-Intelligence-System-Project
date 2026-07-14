from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from database import get_cursor, row_to_dict
from services import auth_service, metrics_service

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


def _require_auth(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    payload = auth_service.verify_token(authorization[7:])
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    return payload


def _require_admin(authorization: str | None):
    payload = _require_auth(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return payload


class SubmitBody(BaseModel):
    lang:         str
    author_id:    str
    author_name:  str
    query:        str
    qwen_content: str
    user_content: str


class ClusterSubmitBody(BaseModel):
    generation_history_id: int
    user_content: str
    rating: int | None = None
    notes: str | None = None


@router.post("/submit")
def submit_evaluation(body: SubmitBody, authorization: str | None = Header(None)):
    payload  = _require_auth(authorization)
    user_id  = int(payload["sub"])
    username = payload["username"]

    scores = metrics_service.compute_all(
        hypothesis=body.qwen_content,
        reference=body.user_content,
        source=body.query,
    )

    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO evaluations
                (user_id, username, lang, author_id, author_name, query,
                 qwen_content, user_content, hter_score, chrf_score, comet_score)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id, evaluated_at
            """,
            (user_id, username, body.lang, body.author_id, body.author_name,
             body.query, body.qwen_content, body.user_content,
             scores["hter_score"], scores["chrf_score"], scores["comet_score"]),
        )
        row = cur.fetchone()
        cur.connection.commit()

    return {
        "ok":           True,
        "id":           row["id"],
        "evaluated_at": str(row["evaluated_at"]),
        **scores,
    }


@router.post("/cluster-submit")
def submit_cluster_evaluation(body: ClusterSubmitBody, authorization: str | None = Header(None)):
    payload  = _require_auth(authorization)
    user_id  = int(payload["sub"])
    username = payload["username"]

    if body.rating is not None and not 1 <= body.rating <= 5:
        raise HTTPException(400, "rating must be between 1 and 5")

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                gh.id,
                gh.cluster_id,
                gh.author_id,
                gh.author_name,
                gh.publisher_id,
                gh.target_language,
                gh.generated_content,
                tc.title AS cluster_title
            FROM generation_history gh
            LEFT JOIN topic_clusters tc ON tc.id = gh.cluster_id
            WHERE gh.id = %s
            """,
            (body.generation_history_id,),
        )
        gen = cur.fetchone()
        if not gen:
            raise HTTPException(404, "Generation history item not found")

        qwen_content = gen["generated_content"] or ""
        if not qwen_content.strip():
            raise HTTPException(400, "Generation history item has no generated content")

        scores = metrics_service.compute_all(
            hypothesis=qwen_content,
            reference=body.user_content,
            source=gen["cluster_title"] or str(gen["cluster_id"] or ""),
        )

        author_id = gen["author_id"] or gen["publisher_id"] or "cluster"
        author_name = gen["author_name"] or gen["publisher_id"] or "cluster"
        lang = gen["target_language"] or "unknown"
        query = gen["cluster_title"] or f"Cluster {gen['cluster_id']}"

        cur.execute(
            """
            INSERT INTO evaluations
                (user_id, username, lang, author_id, author_name, query,
                 qwen_content, user_content, hter_score, chrf_score, comet_score)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id, evaluated_at
            """,
            (
                user_id,
                username,
                lang,
                author_id,
                author_name,
                query,
                qwen_content,
                body.user_content,
                scores["hter_score"],
                scores["chrf_score"],
                scores["comet_score"],
            ),
        )
        evaluation_row = cur.fetchone()

        cur.execute(
            """
            INSERT INTO editor_corrections
                (generation_id, editor_user_id, action_type, original_text, edited_text, field)
            VALUES (%s,%s,%s,%s,%s,%s)
            RETURNING id, created_at
            """,
            (
                body.generation_history_id,
                user_id,
                "cluster_feedback",
                qwen_content,
                body.user_content,
                "generated_content",
            ),
        )
        correction_row = cur.fetchone()

        cur.execute(
            """
            INSERT INTO cluster_feedback
                (generation_history_id, cluster_id, user_id, username, rating, notes,
                 original_content, edited_content, hter_score, chrf_score, comet_score)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id, created_at
            """,
            (
                body.generation_history_id,
                gen["cluster_id"],
                user_id,
                username,
                body.rating,
                body.notes,
                qwen_content,
                body.user_content,
                scores["hter_score"],
                scores["chrf_score"],
                scores["comet_score"],
            ),
        )
        feedback_row = cur.fetchone()
        cur.connection.commit()

    return {
        "ok": True,
        "generation_history_id": body.generation_history_id,
        "evaluation_id": evaluation_row["id"],
        "editor_correction_id": correction_row["id"],
        "cluster_feedback_id": feedback_row["id"],
        "created_at": str(feedback_row["created_at"]),
        "evaluated_at": str(evaluation_row["evaluated_at"]),
        **scores,
    }


@router.get("/list")
def list_evaluations(authorization: str | None = Header(None)):
    _require_admin(authorization)
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, user_id, username, lang, author_id, author_name,
                   query, qwen_content, user_content,
                   hter_score, chrf_score, comet_score, evaluated_at
            FROM evaluations
            ORDER BY evaluated_at DESC
        """)
        return [row_to_dict(r) for r in cur.fetchall()]


@router.get("/stats")
def evaluation_stats(authorization: str | None = Header(None)):
    _require_admin(authorization)
    with get_cursor() as cur:
        cur.execute("""
            SELECT
                lang,
                COUNT(*)           AS count,
                AVG(hter_score)    AS avg_hter,
                AVG(chrf_score)    AS avg_chrf,
                AVG(comet_score)   AS avg_comet,
                MIN(hter_score)    AS best_hter,
                MIN(chrf_score)    AS worst_chrf,
                MAX(chrf_score)    AS best_chrf
            FROM evaluations
            GROUP BY lang
            ORDER BY lang
        """)
        by_lang = {}
        for r in cur.fetchall():
            by_lang[r["lang"]] = {
                "count":      r["count"],
                "avg_hter":   round(float(r["avg_hter"]),  4) if r["avg_hter"]  else None,
                "avg_chrf":   round(float(r["avg_chrf"]),  2) if r["avg_chrf"]  else None,
                "avg_comet":  round(float(r["avg_comet"]), 4) if r["avg_comet"] else None,
                "best_hter":  round(float(r["best_hter"]), 4) if r["best_hter"] else None,
                "best_chrf":  round(float(r["best_chrf"]), 2) if r["best_chrf"] else None,
            }

        cur.execute("SELECT COUNT(*) AS total FROM evaluations")
        total = cur.fetchone()["total"]

    return {"total": total, "by_lang": by_lang}


@router.get("/my")
def my_evaluations(authorization: str | None = Header(None)):
    payload = _require_auth(authorization)
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, lang, author_name, query, qwen_content, user_content,
                   hter_score, chrf_score, comet_score, evaluated_at
            FROM evaluations
            WHERE user_id = %s
            ORDER BY evaluated_at DESC
        """, (int(payload["sub"]),))
        return [row_to_dict(r) for r in cur.fetchall()]
