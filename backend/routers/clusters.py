from fastapi import APIRouter, Header, HTTPException, Query

from database import get_cursor, row_to_dict
from routers.auth import require_auth


router = APIRouter(prefix="/clusters", tags=["clusters"])

PINNED_CLUSTERS = {
    "el": [374788, 369895, 369725, 391651, 402883, 391995],
    "en": [426230, 426232, 426157],
}

VALID_LANGS = {"el", "en"}
VALID_SORTS = {"score", "articles", "recent"}


def _require_user(authorization: str | None):
    return require_auth(authorization)


def _validate_lang(lang: str):
    if lang not in VALID_LANGS:
        raise HTTPException(400, "Unsupported language. Use 'el' or 'en'.")


@router.get("/stats")
def cluster_stats(authorization: str | None = Header(None)):
    _require_user(authorization)
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                np.language,
                COUNT(np.id) AS articles,
                COUNT(np.embedding) AS embedded_articles,
                (
                    SELECT COUNT(*)
                    FROM topic_clusters tc
                    WHERE tc.language = np.language
                      AND tc.status = 'active'
                ) AS clusters,
                (
                    SELECT COUNT(*)
                    FROM topic_clusters tc
                    WHERE tc.language = np.language
                      AND tc.status = 'active'
                      AND tc.articles_count >= 2
                ) AS multi_article_clusters
            FROM news_pool np
            GROUP BY np.language
            ORDER BY np.language
            """
        )
        return [row_to_dict(r) for r in cur.fetchall()]


@router.get("")
def list_clusters(
    lang: str = Query("el"),
    category: str | None = Query(None),
    search: str | None = Query(None),
    sort: str = Query("score"),
    min_articles: int = Query(2, ge=1, le=1000),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    include_pinned: bool = Query(True),
    authorization: str | None = Header(None),
):
    _require_user(authorization)
    _validate_lang(lang)
    if sort not in VALID_SORTS:
        raise HTTPException(400, "Unsupported sort. Use score, articles, or recent.")

    filters = ["tc.language = %s", "tc.status = 'active'", "tc.articles_count >= %s"]
    params: list = [lang, min_articles]

    if category:
        filters.append("COALESCE(tc.main_category, 'other') = %s")
        params.append(category)

    if search:
        if search.isdigit():
            filters.append("tc.id = %s")
            params.append(int(search))
        else:
            filters.append("(tc.title ILIKE %s OR tc.summary ILIKE %s)")
            q = f"%{search}%"
            params.extend([q, q])

    order_sql = {
        "score": "tc.final_score DESC NULLS LAST, tc.articles_count DESC",
        "articles": "tc.articles_count DESC, tc.final_score DESC NULLS LAST",
        "recent": "tc.last_seen_at DESC NULLS LAST, tc.final_score DESC NULLS LAST",
    }[sort]

    params.extend([limit, offset])
    pinned = PINNED_CLUSTERS.get(lang, []) if include_pinned and not search and offset == 0 else []

    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT
                tc.id,
                tc.title,
                tc.summary,
                tc.main_category,
                tc.language,
                tc.primary_country,
                tc.articles_count,
                tc.sources_count,
                COALESCE(tc.final_score, 0)::float AS final_score,
                tc.first_seen_at::date AS first_seen,
                tc.last_seen_at::date AS last_seen,
                EXTRACT(DAY FROM tc.last_seen_at - tc.first_seen_at)::int AS span_days
            FROM topic_clusters tc
            WHERE {' AND '.join(filters)}
            ORDER BY {order_sql}
            LIMIT %s OFFSET %s
            """,
            tuple(params),
        )
        rows = [row_to_dict(r) for r in cur.fetchall()]

        pinned_rows = []
        if pinned:
            placeholders = ",".join(["%s"] * len(pinned))
            cur.execute(
                f"""
                SELECT
                    tc.id,
                    tc.title,
                    tc.summary,
                    tc.main_category,
                    tc.language,
                    tc.primary_country,
                    tc.articles_count,
                    tc.sources_count,
                    COALESCE(tc.final_score, 0)::float AS final_score,
                    tc.first_seen_at::date AS first_seen,
                    tc.last_seen_at::date AS last_seen,
                    EXTRACT(DAY FROM tc.last_seen_at - tc.first_seen_at)::int AS span_days
                FROM topic_clusters tc
                WHERE tc.id IN ({placeholders})
                  AND tc.status = 'active'
                """,
                tuple(pinned),
            )
            order = {cid: idx for idx, cid in enumerate(pinned)}
            pinned_rows = [row_to_dict(r) for r in cur.fetchall()]
            pinned_rows.sort(key=lambda r: order.get(r["id"], 999))
            for row in pinned_rows:
                row["pinned"] = True

    pinned_ids = {r["id"] for r in pinned_rows}
    merged = pinned_rows + [r for r in rows if r["id"] not in pinned_ids]
    for row in merged:
        row.setdefault("pinned", False)

    return {
        "items": merged,
        "limit": limit,
        "offset": offset,
        "count": len(merged),
    }


@router.get("/{cluster_id}")
def get_cluster(cluster_id: int, authorization: str | None = Header(None)):
    _require_user(authorization)
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                tc.id,
                tc.cluster_key,
                tc.title,
                tc.summary,
                tc.main_category,
                tc.language,
                tc.primary_country,
                tc.articles_count,
                tc.sources_count,
                tc.status,
                tc.first_seen_at::date AS first_seen_at,
                tc.last_seen_at::date AS last_seen_at,
                tc.final_score,
                tc.main_topic,
                COALESCE(cs.recency_score, 0)::float AS recency_score,
                COALESCE(cs.volume_score, 0)::float AS volume_score,
                COALESCE(cs.source_quality_score, 0)::float AS source_quality_score,
                COALESCE(cs.trend_score, 0)::float AS trend_score,
                COALESCE(cs.publisher_relevance_score, 0)::float AS publisher_relevance_score,
                COALESCE(cs.final_score, tc.final_score, 0)::float AS score_final
            FROM topic_clusters tc
            LEFT JOIN cluster_scores cs ON cs.cluster_id = tc.id
            WHERE tc.id = %s
            """,
            (cluster_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Cluster not found")
        return row_to_dict(row)


@router.get("/{cluster_id}/sources")
def get_cluster_sources(
    cluster_id: int,
    limit: int = Query(25, ge=1, le=100),
    authorization: str | None = Header(None),
):
    _require_user(authorization)
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                source_domain,
                source_name,
                article_count,
                freshness::date AS freshness
            FROM cluster_sources
            WHERE cluster_id = %s
            ORDER BY article_count DESC
            LIMIT %s
            """,
            (cluster_id, limit),
        )
        return [row_to_dict(r) for r in cur.fetchall()]


@router.get("/{cluster_id}/articles")
def get_cluster_articles(
    cluster_id: int,
    limit: int = Query(25, ge=1, le=100),
    authorization: str | None = Header(None),
):
    _require_user(authorization)
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                np.article_id,
                np.title,
                np.source_domain,
                np.author,
                np.published_at::date AS pub_date,
                np.category,
                LEFT(np.content, 400) AS preview,
                LENGTH(COALESCE(np.content, '')) AS content_len,
                COALESCE(cm.similarity_score, 0)::float AS similarity_score,
                cm.mmr_rank,
                cm.is_primary
            FROM cluster_members cm
            JOIN news_pool np ON cm.article_id = np.article_id
            WHERE cm.cluster_id = %s
              AND np.title IS NOT NULL
            ORDER BY cm.similarity_score DESC NULLS LAST,
                     LENGTH(COALESCE(np.content, '')) DESC
            LIMIT %s
            """,
            (cluster_id, limit),
        )
        return [row_to_dict(r) for r in cur.fetchall()]


@router.get("/{cluster_id}/rag-context")
def get_rag_context(
    cluster_id: int,
    limit: int = Query(5, ge=1, le=10),
    authorization: str | None = Header(None),
):
    _require_user(authorization)
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                np.article_id,
                np.title,
                np.source_domain,
                np.published_at::date AS published_at,
                np.author,
                LEFT(np.content, 1000) AS preview,
                LENGTH(COALESCE(np.content, '')) AS content_len,
                COALESCE(cm.similarity_score, 0)::float AS similarity_score,
                cm.mmr_rank,
                cm.is_primary
            FROM cluster_members cm
            JOIN news_pool np ON cm.article_id = np.article_id
            WHERE cm.cluster_id = %s
              AND np.content IS NOT NULL
              AND LENGTH(np.content) > 200
            ORDER BY cm.mmr_rank ASC NULLS LAST,
                     cm.similarity_score DESC NULLS LAST,
                     LENGTH(COALESCE(np.content, '')) DESC
            LIMIT %s
            """,
            (cluster_id, limit),
        )
        articles = [row_to_dict(r) for r in cur.fetchall()]

    return {
        "cluster_id": cluster_id,
        "selection_method": "mmr_rank_then_similarity_then_content_length",
        "limit": limit,
        "articles": articles,
    }
