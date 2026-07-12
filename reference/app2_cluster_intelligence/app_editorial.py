#!/usr/bin/env python3
"""
Editorial Intelligence Dashboard
Run: streamlit run "Code/app_editorial.py" --server.port 8105

Prerequisites (run once before starting the app):
  SSH tunnel for DB:
    ssh -i "/path/to/editorial-engine-key.pem" \
        -L 5433:localhost:5432 -N ubuntu@98.84.126.189 &
  MareNostrum tunnel must be live on localhost:8101
"""

import html as html_lib
import os
import re
import streamlit as st
import psycopg2
import psycopg2.extras
import requests

# ── CONFIG ───────────────────────────────────────────────────────────────────
DB_HOST  = "localhost"
DB_PORT  = 5433          # SSH tunnel → EC2:5432
DB_NAME  = "editorial_intelligence"
DB_USER  = "postgres"
DB_PASS  = os.getenv("DB_PASSWORD", "")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
QWEN3_URL          = "https://openrouter.ai/api/v1/chat/completions"
QWEN3_MODEL        = "qwen/qwen3-32b"

CLUSTER_LIMIT = 500   # max clusters loaded per language (keeps grid fast)
RAG_TOP_N     = 5     # articles passed to generation

# ── PINNED CLUSTERS shown at the very top of each language feed ──────────────
# Hand-picked, deeply validated clusters — best quality for demo
PINNED_CLUSTERS = {
    "el": [374788, 369895, 369725, 391651, 402883, 391995],
    "en": [426230, 426232, 426157],
}

CATEGORY_COLORS = {
    "sports":        ("#dcfce7", "#166534"),
    "politics":      ("#f3e8ff", "#6b21a8"),
    "business":      ("#dbeafe", "#1e3a8a"),
    "technology":    ("#ccfbf1", "#134e4a"),
    "entertainment": ("#ffedd5", "#9a3412"),
    "world":         ("#e0e7ff", "#1e1b4b"),
    "crime":         ("#ffe4e6", "#881337"),
    "lifestyle":     ("#fce7f3", "#831843"),
    "education":     ("#ecfccb", "#365314"),
    "top":           ("#fee2e2", "#7f1d1d"),
    "health":        ("#fee2e2", "#7f1d1d"),
    "science":       ("#cffafe", "#164e63"),
}

# ── PAGE SETUP ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Editorial Intelligence",
    page_icon="📰",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── CSS ───────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
[data-testid="stAppViewContainer"] > .main { padding-top: 12px; }
[data-testid="stHeader"] { display: none; }
#MainMenu, footer { visibility: hidden; }
button[kind="primary"] { font-weight: 700 !important; }

/* ── Header ── */
.ei-header {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: white; padding: 18px 26px; border-radius: 14px; margin-bottom: 18px;
    display: flex; align-items: center; justify-content: space-between;
}
.ei-header h1 { font-size: 19px; font-weight: 700; margin: 0; }
.ei-header .tagline { font-size: 11.5px; color: #94a3b8; margin: 3px 0 0; }
.ei-header .stats   { font-size: 11px; color: #64748b; text-align: right; line-height: 1.8; }

/* ── Home language buttons ── */
.home-wrap { text-align: center; margin: 50px 0 30px; }
.home-wrap h2 { font-size: 16px; color: #475569; margin-bottom: 30px; }

/* ── Cluster card ── */
.cluster-card {
    background: white; border-radius: 12px; padding: 15px 16px;
    border: 1px solid #e2e8f0; margin-bottom: 2px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.cat-badge {
    display: inline-block; padding: 2px 9px; border-radius: 99px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.4px;
    text-transform: uppercase; margin-bottom: 8px;
}
.card-title {
    font-size: 13.5px; font-weight: 700; color: #0f172a;
    line-height: 1.4; margin-bottom: 5px;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
}
.card-summary {
    font-size: 11.5px; color: #64748b; line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 10px;
}
.card-stat  { font-size: 11.5px; color: #475569; }
.score-track { height: 4px; background: #f1f5f9; border-radius: 2px; margin: 8px 0 3px; }
.score-fill  { height: 4px; border-radius: 2px;
    background: linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%); }
.card-dates  { font-size: 10.5px; color: #94a3b8; margin-top: 4px; }

/* ── Cluster detail header ── */
.detail-hero {
    background: white; border-radius: 14px; padding: 22px 26px;
    border: 1px solid #e2e8f0; margin-bottom: 18px;
}
.detail-hero h2 {
    font-size: 21px; font-weight: 700; color: #0f172a;
    margin: 0 0 13px; line-height: 1.35;
}
.badge-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 13px; }
.badge {
    padding: 4px 13px; border-radius: 99px; font-size: 12px;
    font-weight: 600; border: 1px solid transparent;
}
.b-cat   { background: #e0e7ff; color: #1e1b4b; }
.b-lang  { background: #dcfce7; color: #14532d; }
.b-score { background: #fef9c3; color: #713f12; }
.b-art   { background: #dbeafe; color: #1e40af; }
.b-src   { background: #fce7f3; color: #831843; }
.cluster-summary {
    font-size: 14px; color: #374151; line-height: 1.75;
    background: #f8fafc; border-left: 4px solid #3b82f6;
    padding: 12px 16px; border-radius: 0 10px 10px 0; margin-top: 12px;
}

/* ── Score bar ── */
.sbar-row  { display: flex; align-items: center; margin: 8px 0; }
.sbar-name { width: 130px; font-size: 12px; color: #475569; }
.sbar-bg   { flex: 1; height: 7px; background: #f1f5f9; border-radius: 4px;
    overflow: hidden; margin: 0 10px; }
.sbar-fill { height: 7px; border-radius: 4px;
    background: linear-gradient(90deg, #3b82f6, #06b6d4); }
.sbar-val  { width: 42px; font-size: 12px; font-weight: 700;
    color: #1e40af; text-align: right; }

/* ── Source chip ── */
.src-chip {
    display: inline-block; padding: 3px 10px; background: #f1f5f9;
    border-radius: 99px; font-size: 11px; color: #475569; margin: 3px;
    border: 1px solid #e2e8f0;
}

/* ── Article mini card ── */
.art-card {
    background: #f8fafc; border-radius: 8px; padding: 12px 14px;
    margin-bottom: 8px; border: 1px solid #e2e8f0;
}
.art-title { font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 3px; }
.art-meta  { font-size: 11px; color: #64748b; margin-bottom: 5px; }
.art-body  { font-size: 12px; color: #475569; line-height: 1.5; }

/* ── Generation page ── */
.rag-card {
    background: #f0f9ff; border-radius: 10px; padding: 14px 16px;
    margin-bottom: 10px; border: 1px solid #bae6fd;
}
.rag-num {
    display: inline-block; width: 22px; height: 22px; background: #0284c7;
    border-radius: 50%; color: white; font-size: 11px; font-weight: 700;
    text-align: center; line-height: 22px; margin-right: 7px; flex-shrink: 0;
}
.rag-title { font-size: 13px; font-weight: 700; color: #0c4a6e; }
.rag-meta  { font-size: 11px; color: #0369a1; margin: 4px 0 6px; padding-left: 29px; }
.rag-body  { font-size: 12px; color: #1e293b; line-height: 1.55; padding-left: 29px; }

.gen-output {
    background: white; border-radius: 14px; padding: 28px 32px;
    border: 1px solid #e2e8f0; font-size: 15.5px; line-height: 1.85;
    color: #1e293b; box-shadow: 0 4px 16px rgba(0,0,0,0.07);
    white-space: pre-wrap; word-wrap: break-word;
}
.gen-model-tag {
    display: inline-block; padding: 4px 14px; background: #dcfce7;
    border-radius: 99px; font-size: 11px; font-weight: 700;
    color: #14532d; margin-bottom: 14px;
}

/* ── Shared ── */
.sec-title {
    font-size: 14px; font-weight: 700; color: #0f172a;
    padding-bottom: 7px; border-bottom: 2px solid #e2e8f0; margin: 20px 0 13px;
}
</style>
""", unsafe_allow_html=True)


# ── SESSION STATE ─────────────────────────────────────────────────────────────
for _k, _v in {
    "page": "home",
    "language": None,
    "cluster_id": None,
    "generated": None,
    "rag_used": None,
}.items():
    if _k not in st.session_state:
        st.session_state[_k] = _v


# ── DB HELPERS ────────────────────────────────────────────────────────────────
def _new_conn():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASS, connect_timeout=8,
        options="-c statement_timeout=30000",
    )


def _qry(sql, params=()):
    """Create a fresh connection per query — avoids stale cached connections."""
    conn = _new_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception:
        try:
            conn.close()
        except Exception:
            pass
        raise


@st.cache_data(ttl=120, show_spinner=False)
def fetch_db_stats() -> dict:
    rows = _qry("""
        SELECT
            np.language,
            COUNT(np.id)                                        AS articles,
            (SELECT COUNT(*) FROM topic_clusters tc2
             WHERE tc2.language = np.language
               AND tc2.status = 'active')                       AS clusters
        FROM news_pool np
        GROUP BY np.language
    """)
    return {r["language"]: r for r in rows}


@st.cache_data(ttl=120, show_spinner=False)
def fetch_pinned(language: str) -> list:
    """Fetch pinned clusters directly by ID — always shown at top of feed."""
    ids = PINNED_CLUSTERS.get(language, [])
    if not ids:
        return []
    placeholders = ",".join(["%s"] * len(ids))
    rows = _qry(f"""
        SELECT tc.id, tc.title, tc.summary, tc.main_category,
               tc.articles_count, tc.sources_count,
               COALESCE(tc.final_score, 0)::float AS final_score,
               tc.first_seen_at::date AS first_seen,
               tc.last_seen_at::date  AS last_seen,
               EXTRACT(DAY FROM tc.last_seen_at - tc.first_seen_at)::int AS span_days
        FROM topic_clusters tc
        WHERE tc.id IN ({placeholders}) AND tc.status = 'active'
    """, tuple(ids))
    # Preserve the pinned order
    order = {cid: i for i, cid in enumerate(ids)}
    rows.sort(key=lambda r: order.get(r["id"], 99))
    for r in rows:
        r["_pinned"] = True
    return rows


@st.cache_data(ttl=120, show_spinner=False)
def fetch_clusters(language: str) -> list:
    return _qry("""
        SELECT
            tc.id, tc.title, tc.summary, tc.main_category,
            tc.articles_count, tc.sources_count,
            COALESCE(tc.final_score, 0)::float AS final_score,
            tc.first_seen_at::date AS first_seen,
            tc.last_seen_at::date  AS last_seen,
            EXTRACT(DAY FROM tc.last_seen_at - tc.first_seen_at)::int AS span_days
        FROM topic_clusters tc
        WHERE tc.language = %s
          AND tc.articles_count >= 2
          AND tc.status = 'active'
        ORDER BY tc.final_score DESC NULLS LAST, tc.articles_count DESC
        LIMIT %s
    """, (language, CLUSTER_LIMIT))


@st.cache_data(ttl=300, show_spinner=False)
def fetch_cluster(cluster_id: int) -> dict:
    rows = _qry("""
        SELECT
            tc.*,
            COALESCE(cs.recency_score, 0)::float            AS recency_score,
            COALESCE(cs.volume_score, 0)::float             AS volume_score,
            COALESCE(cs.source_quality_score, 0)::float     AS source_quality_score,
            COALESCE(cs.trend_score, 0)::float              AS trend_score,
            COALESCE(cs.publisher_relevance_score, 0)::float AS publisher_relevance_score,
            COALESCE(cs.final_score, tc.final_score, 0)::float AS score_final
        FROM topic_clusters tc
        LEFT JOIN cluster_scores cs ON cs.cluster_id = tc.id
        WHERE tc.id = %s
    """, (cluster_id,))
    return rows[0] if rows else None


@st.cache_data(ttl=300, show_spinner=False)
def fetch_sources(cluster_id: int) -> list:
    return _qry("""
        SELECT source_domain, source_name, article_count,
               freshness::date AS freshness
        FROM cluster_sources
        WHERE cluster_id = %s
        ORDER BY article_count DESC
        LIMIT 25
    """, (cluster_id,))


@st.cache_data(ttl=300, show_spinner=False)
def fetch_articles(cluster_id: int) -> list:
    return _qry("""
        SELECT
            np.article_id, np.title, np.source_domain, np.author,
            np.published_at::date             AS pub_date,
            np.category,
            LEFT(np.content, 400)             AS preview,
            np.content                        AS full_content,
            LENGTH(COALESCE(np.content, ''))  AS content_len,
            COALESCE(cm.similarity_score, 0)::float AS sim,
            cm.is_primary
        FROM cluster_members cm
        JOIN news_pool np ON cm.article_id = np.article_id
        WHERE cm.cluster_id = %s
          AND np.title IS NOT NULL
        ORDER BY cm.similarity_score DESC NULLS LAST,
                 LENGTH(COALESCE(np.content, '')) DESC
        LIMIT 25
    """, (cluster_id,))


def fetch_rag_articles(cluster_id: int) -> list:
    """Full content for top-N articles — NOT cached (called right before generation)."""
    return _qry("""
        SELECT
            np.title, np.source_domain, np.published_at, np.author, np.content
        FROM cluster_members cm
        JOIN news_pool np ON cm.article_id = np.article_id
        WHERE cm.cluster_id = %s
          AND np.content IS NOT NULL
          AND LENGTH(np.content) > 200
        ORDER BY LENGTH(np.content) DESC
        LIMIT %s
    """, (cluster_id, RAG_TOP_N))


# ── GENERATION ────────────────────────────────────────────────────────────────
def generate_article(cluster: dict, rag_articles: list) -> str:
    lang      = cluster.get("language", "el")
    lang_name = "Greek" if lang == "el" else "English"

    # Build RAG context
    ctx  = f"TOPIC: {cluster['title']}\n"
    if cluster.get("summary"):
        ctx += f"SUMMARY: {cluster['summary']}\n"
    ctx += f"CATEGORY: {cluster.get('main_category', '')}\n\n"
    ctx += "SOURCE ARTICLES:\n\n"
    for i, a in enumerate(rag_articles, 1):
        ctx += f"[Article {i}]\n"
        ctx += f"Headline: {a['title']}\n"
        ctx += f"Source: {a['source_domain']}  |  Date: {str(a['published_at'])[:10]}\n"
        if a.get("author"):
            ctx += f"Author: {a['author']}\n"
        ctx += (a.get("content") or "")[:2500].strip() + "\n\n"

    payload = {
        "model": QWEN3_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    f"You are a senior editorial journalist at a major {lang_name}-language newsroom. "
                    f"Write factually grounded, publication-ready news articles in {lang_name}. "
                    f"Every claim must be supported by the provided source material. "
                    f"Never invent facts, names, quotes, or figures."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"/no_think\n\n"
                    f"Write a complete, professional {lang_name} news article about:\n"
                    f"{cluster['title']}\n\n"
                    f"REQUIREMENTS:\n"
                    f"- Start with a strong, specific headline (not generic)\n"
                    f"- Write 4–6 substantive paragraphs\n"
                    f"- Include specific facts, figures, names, dates, and direct quotes from the sources\n"
                    f"- Do NOT add any information not found in the source articles below\n"
                    f"- Professional {lang_name} editorial register throughout\n"
                    f"- No filler sentences, no clichéd conclusions\n"
                    f"- End with a substantive factual statement, not a generic outlook\n\n"
                    f"{ctx}"
                ),
            },
        ],
        "max_tokens": 1600,
        "temperature": 0.3,
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://editorial-intelligence.mubi.ai",
        "X-Title":       "Editorial Intelligence System",
    }
    r = requests.post(QWEN3_URL, json=payload, headers=headers, timeout=120)
    r.raise_for_status()
    text = r.json()["choices"][0]["message"]["content"]

    # Strip <think> blocks
    if "</think>" in text:
        text = text.split("</think>", 1)[-1].strip()
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    return text


# ── UI HELPERS ────────────────────────────────────────────────────────────────
def e(s):
    """HTML-escape a value from the DB."""
    return html_lib.escape(str(s or ""))


def score_bar_html(label: str, value: float) -> str:
    w = min(max(float(value or 0) * 100, 0), 100)
    return (
        f'<div class="sbar-row">'
        f'<span class="sbar-name">{label}</span>'
        f'<div class="sbar-bg"><div class="sbar-fill" style="width:{w:.0f}%"></div></div>'
        f'<span class="sbar-val">{float(value or 0):.3f}</span>'
        f'</div>'
    )


# ── PAGE: HOME ────────────────────────────────────────────────────────────────
def page_home():
    # Fetch live stats from DB
    try:
        stats = fetch_db_stats()
        el = stats.get("el", {})
        en = stats.get("en", {})
        el_arts  = f"{int(el.get('articles', 0)):,}"
        el_clust = f"{int(el.get('clusters', 0)):,}"
        en_arts  = f"{int(en.get('articles', 0)):,}"
        en_clust = f"{int(en.get('clusters', 0)):,}"
    except Exception:
        el_arts = el_clust = en_arts = en_clust = "—"

    st.markdown(f"""
    <div class="ei-header">
      <div class="ei-header-left">
        <h1>📰 Editorial Intelligence System</h1>
        <div class="tagline">
          Cluster-based · RAG-grounded · Qwen3-32B generation · bge-m3 1024-dim embeddings
        </div>
      </div>
      <div class="stats">
        {el_arts} Greek articles · {el_clust} clusters<br>
        {en_arts} English articles · {en_clust} clusters<br>
        cosine threshold 0.80 · pgvector HNSW
      </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("---")
    st.markdown("### Select language pipeline")
    st.markdown("<br>", unsafe_allow_html=True)

    col1, col2, col3 = st.columns([2, 2, 6])
    with col1:
        if st.button("🇬🇷  Greek (ελληνικά)", use_container_width=True):
            st.session_state.language = "el"
            st.session_state.page = "feed"
            st.rerun()
    with col2:
        if st.button("🇬🇧  English", use_container_width=True):
            st.session_state.language = "en"
            st.session_state.page = "feed"
            st.rerun()

    st.markdown("<br><br>", unsafe_allow_html=True)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Greek articles",  el_arts)
    c2.metric("Greek clusters",  el_clust)
    c3.metric("English articles", en_arts)
    c4.metric("English clusters", en_clust)

    st.info(
        "**How it works:** Articles are ingested from Newsdata.io (Greek) and The Guardian (English), "
        "embedded with bge-m3 (1024-dim), and clustered by cosine similarity (0.80 threshold). "
        "When you click Generate, the top 5 articles by content length are sent as RAG context to "
        "Qwen3-32B generation."
    )


# ── PAGE: FEED ────────────────────────────────────────────────────────────────
def page_feed():
    lang  = st.session_state.language
    flag  = "🇬🇷" if lang == "el" else "🇬🇧"
    label = "Greek" if lang == "el" else "English"

    # Header row
    hcol, bcol = st.columns([8, 2])
    with hcol:
        st.markdown(f"""
        <div class="ei-header">
          <div class="ei-header-left">
            <h1>{flag} {label} Cluster Feed</h1>
            <div class="tagline">Multi-article clusters only (≥2 articles) · sorted by score</div>
          </div>
        </div>""", unsafe_allow_html=True)
    with bcol:
        st.write("")
        st.write("")
        if st.button("← Home", use_container_width=True):
            st.session_state.page = "home"
            st.rerun()

    # Load
    with st.spinner("Loading clusters from database..."):
        try:
            pinned   = fetch_pinned(lang)
            clusters = fetch_clusters(lang)
            # Merge: pinned first, then rest (de-duplicated)
            pinned_ids = {c["id"] for c in pinned}
            rest = [c for c in clusters if c["id"] not in pinned_ids]
            clusters = pinned + rest
        except Exception as ex:
            st.error(
                f"**Database connection failed:** {ex}\n\n"
                "Set up the SSH tunnel first:\n"
                "```\n"
                'ssh -i "/path/to/editorial-engine-key.pem" '
                "-L 5433:localhost:5432 -N ubuntu@98.84.126.189 &\n"
                "```"
            )
            return

    if not clusters:
        st.warning("No clusters found.")
        return

    # Filters
    fc1, fc2, fc3 = st.columns([4, 2, 2])
    with fc1:
        search = st.text_input(
            "search", placeholder="🔍  Search by title or cluster ID...",
            label_visibility="collapsed"
        )
    with fc2:
        cats = ["All categories"] + sorted(
            {c.get("main_category") or "other" for c in clusters}
        )
        cat_sel = st.selectbox("cat", cats, label_visibility="collapsed")
    with fc3:
        sort_sel = st.selectbox(
            "sort", ["Score ↓", "Articles ↓", "Most recent ↓"],
            label_visibility="collapsed"
        )

    # Apply
    shown = clusters
    if search:
        kw = search.strip()
        if kw.isdigit():
            # ID search: navigate directly to cluster — no button click needed
            cid = int(kw)
            # Verify the cluster exists (check loaded set first, then DB)
            exists = any(c.get("id") == cid for c in clusters)
            if not exists:
                check = _qry(
                    "SELECT id FROM topic_clusters WHERE id=%s AND status='active'",
                    (cid,)
                )
                exists = bool(check)
            if exists:
                st.session_state.cluster_id = cid
                st.session_state.page       = "cluster"
                st.session_state.generated  = None
                st.session_state.rag_used   = None
                st.rerun()
            else:
                st.warning(f"No active cluster found with ID {cid}.")
                return
        else:
            kw_l = kw.lower()
            shown = [c for c in shown if kw_l in (c.get("title") or "").lower()
                                       or kw_l in (c.get("summary") or "").lower()]
    if cat_sel != "All categories":
        shown = [c for c in shown if (c.get("main_category") or "other") == cat_sel]
    if sort_sel == "Articles ↓":
        shown = sorted(shown, key=lambda x: x.get("articles_count") or 0, reverse=True)
    elif sort_sel == "Most recent ↓":
        shown = sorted(shown, key=lambda x: str(x.get("last_seen") or ""), reverse=True)

    st.caption(
        f"Showing **{len(shown)}** of **{len(clusters)}** clusters "
        f"(top {CLUSTER_LIMIT} by score · filtered to ≥2 articles)"
    )

    if not shown:
        st.info("No clusters match your search.")
        return

    # Grid — 3 columns
    grid_cols = st.columns(3)
    for i, c in enumerate(shown):
        col     = grid_cols[i % 3]
        cat     = c.get("main_category") or "other"
        score   = float(c.get("final_score") or 0)
        title   = e(c.get("title") or "Untitled")
        summary = e(c.get("summary") or "")[:160]
        arts    = c.get("articles_count") or 0
        srcs    = c.get("sources_count") or 0
        d0      = str(c.get("first_seen") or "")[:10]
        d1      = str(c.get("last_seen")  or "")[:10]
        bg, fg  = CATEGORY_COLORS.get(cat, ("#f1f5f9", "#334155"))
        bar_w   = min(score * 100, 100)

        is_pinned = c.get("_pinned", False)
        pin_banner = (
            '<div style="font-size:10px;font-weight:700;color:#059669;'
            'letter-spacing:0.05em;margin-bottom:5px">⭐ FEATURED CLUSTER</div>'
            if is_pinned else ""
        )
        card_border = "border:2px solid #059669;" if is_pinned else ""

        with col:
            st.markdown(f"""
            <div class="cluster-card" style="{card_border}">
              {pin_banner}
              <span class="cat-badge" style="background:{bg};color:{fg}">{e(cat).upper()}</span>
              <div class="card-title">{title}</div>
              {"<div class='card-summary'>" + summary + "…</div>" if summary else ""}
              <div style="display:flex;gap:14px;margin-bottom:4px">
                <span class="card-stat">📰 {arts} articles</span>
                <span class="card-stat">🏢 {srcs} sources</span>
              </div>
              <div class="card-dates">📅 {d0} → {d1} &nbsp;·&nbsp; {c.get("span_days",0)}d span</div>
              <div class="score-track">
                <div class="score-fill" style="width:{bar_w:.1f}%"></div>
              </div>
              <div style="font-size:10.5px;color:#94a3b8">Score: {score:.3f} &nbsp;·&nbsp; ID: {c['id']}</div>
            </div>
            """, unsafe_allow_html=True)

            if st.button("Open cluster →", key=f"o_{c['id']}", use_container_width=True):
                st.session_state.cluster_id = c["id"]
                st.session_state.page       = "cluster"
                st.session_state.generated  = None
                st.session_state.rag_used   = None
                st.rerun()


# ── PAGE: CLUSTER DETAIL ─────────────────────────────────────────────────────
def page_cluster():
    cluster_id = st.session_state.cluster_id
    lang  = st.session_state.language
    flag  = "🇬🇷" if lang == "el" else "🇬🇧"

    if st.button(f"← Back to {flag} Feed"):
        st.session_state.page = "feed"
        st.rerun()

    with st.spinner("Loading cluster detail..."):
        try:
            cluster  = fetch_cluster(cluster_id)
            sources  = fetch_sources(cluster_id)
            articles = fetch_articles(cluster_id)
        except Exception as ex:
            st.error(f"Error loading cluster: {ex}")
            return

    if not cluster:
        st.error("Cluster not found.")
        return

    cat   = cluster.get("main_category") or "other"
    score = float(cluster.get("score_final") or cluster.get("final_score") or 0)
    arts  = cluster.get("articles_count") or 0
    srcs  = cluster.get("sources_count")  or 0
    clang = cluster.get("language", "el")
    clang_label = "Greek" if clang == "el" else "English"
    d0    = str(cluster.get("first_seen_at") or "")[:10]
    d1    = str(cluster.get("last_seen_at")  or "")[:10]

    # ── Hero ──
    summary_html = (
        f'<div class="cluster-summary">{e(cluster["summary"])}</div>'
        if cluster.get("summary") else ""
    )
    st.markdown(f"""
    <div class="detail-hero">
      <h2>{e(cluster.get("title", ""))}</h2>
      <div class="badge-strip">
        <span class="badge b-cat">🗂 {e(cat).upper()}</span>
        <span class="badge b-lang">{clang_label}</span>
        <span class="badge b-score">⭐ Score {score:.3f}</span>
        <span class="badge b-art">📰 {arts} articles</span>
        <span class="badge b-src">🏢 {srcs} sources</span>
        <span class="badge" style="background:#f0fdf4;color:#14532d;border:1px solid #bbf7d0">
          📅 {d0} → {d1}
        </span>
      </div>
      {summary_html}
    </div>
    """, unsafe_allow_html=True)

    # ── Scoring + Sources ──
    col_sc, col_src = st.columns([1, 1])

    with col_sc:
        st.markdown('<div class="sec-title">Cluster Scoring Breakdown</div>', unsafe_allow_html=True)
        bars = "".join([
            score_bar_html("Recency",     cluster.get("recency_score")            or 0),
            score_bar_html("Volume",      cluster.get("volume_score")             or 0),
            score_bar_html("Source Q.",   cluster.get("source_quality_score")     or 0),
            score_bar_html("Trend",       cluster.get("trend_score")              or 0),
            score_bar_html("Relevance",   cluster.get("publisher_relevance_score") or 0),
            score_bar_html("Final",       score),
        ])
        st.markdown(bars, unsafe_allow_html=True)

    with col_src:
        st.markdown(
            f'<div class="sec-title">Sources ({len(sources)} domains)</div>',
            unsafe_allow_html=True
        )
        if sources:
            chips = "".join(
                f'<span class="src-chip">{e(s["source_domain"])} '
                f'<strong>({s["article_count"]})</strong></span>'
                for s in sources
            )
            st.markdown(chips, unsafe_allow_html=True)
        else:
            st.caption("No source data available.")

    # ── Articles ──
    st.markdown(
        f'<div class="sec-title">Articles in this Cluster ({len(articles)} shown)</div>',
        unsafe_allow_html=True
    )

    if articles:
        for a in articles:
            sim          = float(a.get("sim") or 0)
            primary_tag  = " ✦ PRIMARY" if a.get("is_primary") else ""
            author       = f" · {a['author']}" if a.get("author") else ""
            preview      = (a.get("preview") or "").strip()
            full_content = (a.get("full_content") or "").strip()
            content_len  = a.get("content_len", 0)
            has_more     = content_len > 400

            label = (
                f"{'✦ ' if a.get('is_primary') else ''}"
                f"{a.get('title','Untitled')}  "
                f"— {a.get('source_domain','')}  ·  {str(a.get('pub_date',''))[:10]}"
                f"  |  sim {sim:.3f}{primary_tag}"
            )
            with st.expander(label, expanded=False):
                if author:
                    st.caption(f"Author: {author.strip(' ·')}")
                if full_content:
                    st.markdown(full_content)
                elif preview:
                    st.markdown(preview + ("…" if has_more else ""))
                else:
                    st.caption("No content available.")
                st.caption(f"Content length: {content_len:,} chars")
    else:
        st.caption("No articles found for this cluster.")

    # ── Generate button ──
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("---")
    st.markdown("### Generate Article")
    st.markdown(
        "Click below to build RAG context from the top 5 articles "
        "and generate a publication-quality article with **Qwen3-32B**."
    )

    col_btn, _ = st.columns([3, 7])
    with col_btn:
        if st.button(
            "🤖  Generate Article with Qwen3-32B",
            use_container_width=True,
            type="primary",
        ):
            lang_name = "Greek" if clang == "el" else "English"

            with st.spinner("Fetching top articles for RAG context..."):
                try:
                    rag_arts = fetch_rag_articles(cluster_id)
                except Exception as ex:
                    st.error(f"Error fetching RAG articles: {ex}")
                    return

            if not rag_arts:
                st.error("No articles with content found. Cannot generate.")
                return

            with st.spinner(
                f"Generating {lang_name} article with Qwen3-32B… "
                f"(30–90 seconds)"
            ):
                try:
                    output = generate_article(cluster, rag_arts)
                except requests.exceptions.ConnectionError:
                    st.error(
                        "Generation failed. Please try again in a moment. "
                        "Check your internet connection or API key."
                    )
                    return
                except Exception as ex:
                    st.error(f"Generation failed: {ex}")
                    return

            st.session_state.generated = output
            st.session_state.rag_used  = rag_arts
            st.session_state.page      = "generation"
            st.rerun()


# ── PAGE: GENERATION ──────────────────────────────────────────────────────────
def page_generation():
    cluster_id = st.session_state.cluster_id
    lang  = st.session_state.language

    if st.button("← Back to Cluster"):
        st.session_state.page = "cluster"
        st.rerun()

    st.markdown(f"""
    <div class="ei-header">
      <div class="ei-header-left">
        <h1>🤖 Generated Article</h1>
        <div class="tagline">
          Qwen3-32B ·
          RAG-grounded from cluster {cluster_id}
        </div>
      </div>
    </div>""", unsafe_allow_html=True)

    rag_arts  = st.session_state.rag_used  or []
    generated = st.session_state.generated or ""

    left, right = st.columns([5, 5])

    # ── Left: RAG context ──
    with left:
        st.markdown(
            f'<div class="sec-title">RAG Context Used — {len(rag_arts)} Articles</div>',
            unsafe_allow_html=True
        )
        st.caption(
            "These articles were selected from the cluster (top 5 by content length) "
            "and sent as factual context to Qwen3-32B."
        )
        for i, a in enumerate(rag_arts, 1):
            date    = str(a.get("published_at") or "")[:10]
            author  = f" · {e(a['author'])}" if a.get("author") else ""
            preview = e((a.get("content") or "")[:450])
            st.markdown(f"""
            <div class="rag-card">
              <div style="display:flex;align-items:flex-start">
                <span class="rag-num">{i}</span>
                <span class="rag-title">{e(a.get("title",""))}</span>
              </div>
              <div class="rag-meta">
                {e(a.get("source_domain",""))} &nbsp;·&nbsp; {date}{e(author)}
              </div>
              <div class="rag-body">
                {preview}{"…" if len(a.get("content",""))>450 else ""}
              </div>
            </div>
            """, unsafe_allow_html=True)

    # ── Right: Generated article ──
    with right:
        st.markdown('<div class="sec-title">Generated Article</div>', unsafe_allow_html=True)
        st.markdown(
            '<span class="gen-model-tag">✔ Qwen3-32B · RAG-grounded</span>',
            unsafe_allow_html=True
        )
        # Render the article in a styled box — escape for HTML safety
        st.markdown(
            f'<div class="gen-output">{e(generated)}</div>',
            unsafe_allow_html=True
        )
        st.markdown("<br>", unsafe_allow_html=True)
        st.download_button(
            "⬇  Download article (.txt)",
            data=generated,
            file_name=f"generated_cluster_{cluster_id}.txt",
            mime="text/plain",
            use_container_width=True,
        )

        # Regenerate
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("🔄  Regenerate", use_container_width=True):
            cluster = fetch_cluster(cluster_id)
            with st.spinner("Regenerating..."):
                try:
                    output = generate_article(cluster, rag_arts)
                    st.session_state.generated = output
                    st.rerun()
                except Exception as ex:
                    st.error(f"Regeneration failed: {ex}")


# ── ROUTER ────────────────────────────────────────────────────────────────────
def main():
    page = st.session_state.page
    if page == "home":
        page_home()
    elif page == "feed":
        page_feed()
    elif page == "cluster":
        page_cluster()
    elif page == "generation":
        page_generation()


main()
