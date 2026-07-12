from fastapi import APIRouter, HTTPException, Query
from database import get_cursor, row_to_dict
from collections import Counter
import re, math, os, json, requests
from dotenv import load_dotenv

load_dotenv()

QWEN_URL   = os.getenv("QWEN_URL",   "http://localhost:8002/v1")
QWEN_MODEL = os.getenv("QWEN_MODEL", "Qwen/Qwen2.5-7B-Instruct")


# ── Real linguistic trait computation ────────────────────────────────────────

def compute_traits(bodies: list[str]) -> dict:
    """
    Compute genuine linguistic style metrics from article bodies.
    No LLM needed — pure text analysis.
    """
    if not bodies:
        return {}

    sent_lengths   = []   # words per sentence
    quote_rates    = []   # fraction of sentences containing a quote
    richness_vals  = []   # unique/total word ratio
    q_rates        = []   # question marks per sentence
    para_counts    = []   # paragraphs per article

    for body in bodies:
        if not body or len(body) < 50:
            continue

        # Paragraph count
        paras = [p.strip() for p in body.split('\n') if len(p.strip()) > 20]
        para_counts.append(max(1, len(paras)))

        # Sentence splitting (handles Greek and English)
        sents = [s.strip() for s in re.split(r'(?<=[.!?])\s+', body) if len(s.strip()) > 8]
        if not sents:
            continue

        # Words per sentence
        wps = [len(s.split()) for s in sents if s.split()]
        sent_lengths.extend(wps)

        # Quote density — straight quote, smart quotes (U+201C/201D), guillemets
        quoted = sum(1 for s in sents if '"' in s or '“' in s or '”' in s or '«' in s or '»' in s)
        quote_rates.append(quoted / len(sents))

        # Question rate
        q_rates.append(body.count('?') / len(sents))

        # Vocabulary richness (type-token ratio on first 300 words)
        words = re.findall(r'\w+', body.lower())[:300]
        if words:
            richness_vals.append(len(set(words)) / len(words))

    if not sent_lengths:
        return {}

    avg_sl  = sum(sent_lengths) / len(sent_lengths)
    avg_qd  = sum(quote_rates)  / len(quote_rates)  if quote_rates  else 0
    avg_qr  = sum(q_rates)      / len(q_rates)      if q_rates      else 0
    avg_vr  = sum(richness_vals)/ len(richness_vals) if richness_vals else 0
    avg_par = sum(para_counts)  / len(para_counts)  if para_counts  else 0

    # ── Derive human-readable labels ──────────────────────────────────────
    if avg_sl < 14:
        sentence_style = "Short, declarative — one idea per sentence (wire-service style)"
        opening_style  = "Fact-first — key information in the first sentence"
    elif avg_sl < 22:
        sentence_style = "Moderate length — clear with some embedded detail"
        opening_style  = "Mixed — may set context before the main fact"
    else:
        sentence_style = "Long, complex — subordinate clauses and embedded analysis"
        opening_style  = "Scene-setting — context and background before the main fact"

    if avg_qd > 0.35:
        attribution = "Heavy — frequent direct quotes from sources"
        editorialising = "Low — writer stays close to source material"
    elif avg_qd > 0.15:
        attribution = "Moderate — mix of direct quotes and paraphrase"
        editorialising = "Moderate — some interpretation alongside facts"
    else:
        attribution = "Sparse — paraphrase and narrative dominate"
        editorialising = "High — writer draws conclusions and interprets events"

    if avg_vr > 0.62:
        vocabulary = "Rich and varied — sophisticated word choice"
    elif avg_vr > 0.48:
        vocabulary = "Standard — clear and accessible vocabulary"
    else:
        vocabulary = "Focused — consistent terminology, limited variation"

    structure = (
        "Inverted pyramid — most important facts first, background last"
        if avg_sl < 16
        else "Narrative — scene → context → analysis → implications"
    )

    return {
        "metrics": {
            "avg_sentence_length":      round(avg_sl, 1),
            "avg_paragraphs":           round(avg_par, 1),
            "quote_density_pct":        round(avg_qd * 100, 1),
            "vocabulary_richness":      round(avg_vr, 3),
            "question_rate":            round(avg_qr, 3),
        },
        "traits": {
            "opening_sentence":  opening_style,
            "sentence_length":   sentence_style,
            "attribution":       attribution,
            "editorialising":    editorialising,
            "vocabulary":        vocabulary,
            "structure":         structure,
        },
    }

router = APIRouter(prefix="/exploration", tags=["exploration"])


@router.get("/corpus-stats")
def corpus_stats():
    """Aggregate stats across both tables — used by the landing page."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT
                (SELECT COUNT(*)              FROM greek_author_styles)   +
                (SELECT COUNT(*)              FROM english_author_styles) AS total_articles,

                (SELECT COUNT(DISTINCT author_id) FROM greek_author_styles)   +
                (SELECT COUNT(DISTINCT author_id) FROM english_author_styles) AS total_authors,

                (SELECT COUNT(DISTINCT publisher_id) FROM greek_author_styles)   +
                (SELECT COUNT(DISTINCT publisher_id) FROM english_author_styles) AS total_publishers,

                2 AS total_languages
        """)
        row = cur.fetchone()
    return {
        "total_articles":   int(row["total_articles"]),
        "total_authors":    int(row["total_authors"]),
        "total_publishers": int(row["total_publishers"]),
        "total_languages":  2,
        "vector_dims":      1024,
    }

TABLES = {
    "el": "greek_author_styles",
    "en": "english_author_styles",
}

# ── Qwen-based trait generation ───────────────────────────────────────────────

_qwen_trait_cache: dict = {}   # author_id → trait dict, persists for server lifetime

TRAIT_PROMPT = """You are an editorial style analyst. Read the following {n} articles written by {author} and identify their distinctive writing style.

{articles}

Now fill in this JSON template based ONLY on what you observe in these articles. Be specific and concise (1-2 sentences per field):

{{
  "opening_sentence": "<how does this author typically begin their articles — scene-setting, fact-first, question, anecdote?>",
  "sentence_length": "<how long and complex are their sentences, and what effect does it create?>",
  "language_style": "<vocabulary level, tone, and register — analytical, conversational, formal, neutral?>",
  "editorialising": "<do they express opinions and draw conclusions, or stay strictly factual? Give a short example if you see one.>",
  "structure": "<how is each article organized — inverted pyramid, narrative arc, thematic sections?>",
  "closing_paragraph": "<how do they typically end — forward-looking, summary, quote, abrupt?>",
  "voice": "<overall authorial personality — authoritative, empathetic, detached, investigative, opinionated?>"
}}

Return ONLY valid JSON. No explanation, no markdown fences."""


def generate_traits_qwen(bodies: list[str], author_name: str, lang: str) -> dict | None:
    """
    Call Qwen on EC2 to generate LLM-based style traits.
    Returns a dict with 'source' and 'traits', or None if Qwen is unavailable.
    """
    samples = [b[:2000] for b in bodies[:5] if b]   # up to 5 articles, 2k chars each
    if not samples:
        return None

    articles_block = "\n\n---\n\n".join(
        f"ARTICLE {i+1}:\n{body}" for i, body in enumerate(samples)
    )

    prompt = TRAIT_PROMPT.format(
        n=len(samples),
        author=author_name,
        articles=articles_block,
    )

    try:
        resp = requests.post(
            f"{QWEN_URL}/chat/completions",
            json={
                "model":       QWEN_MODEL,
                "messages":    [
                    {"role": "system", "content": "You are an editorial analyst. Return only valid JSON."},
                    {"role": "user",   "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens":  600,
            },
            timeout=45,
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"].strip()

        # Strip markdown fences if model wraps its response
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        traits = json.loads(raw.strip())
        return {"source": "qwen", "traits": traits}

    except Exception:
        return None   # caller will fall back to rule-based

STOPWORDS = {
    "el": {
        'και', 'σε', 'για', 'από', 'με', 'που', 'την', 'τον', 'της', 'του', 'τα',
        'τη', 'τις', 'τους', 'να', 'ότι', 'αλλά', 'ή', 'μια', 'ένα', 'είναι', 'θα',
        'ο', 'η', 'οι', 'το', 'ήταν', 'αυτό', 'αυτή', 'αυτός', 'πως', 'μπορεί',
        'δεν', 'τώρα', 'εδώ', 'στο', 'στη', 'στην', 'στον', 'αν', 'κι', 'πιο',
        'ακόμα', 'μόνο', 'πολύ', 'όλα', 'μέσα', 'ωστόσο', 'αφού', 'έτσι', 'ως',
        'άλλο', 'κάθε', 'πριν', 'μετά', 'χωρίς', 'οποία', 'οποίο', 'οποίος',
        'αυτά', 'αυτές', 'μας', 'σας', 'τους', 'είπε', 'έχει', 'έχουν', 'όπου',
    },
    "en": {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
        'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'it', 'its', 'this', 'that', 'they',
        'their', 'there', 'he', 'she', 'his', 'her', 'we', 'our', 'you', 'your',
        'i', 'my', 'me', 'us', 'him', 'them', 'not', 'no', 'so', 'if', 'then',
        'than', 'about', 'after', 'before', 'over', 'under', 'more', 'also',
        'into', 'up', 'out', 'all', 'who', 'which', 'what', 'when', 'where',
        'how', 'why', 'new', 'first', 'last', 'one', 'two', 'three', 'says',
        'said', 'say', 'just', 'like', 'well', 'too', 'can', 'its', 'been',
        'after', 'while', 'still', 'back', 'even', 'here', 'those', 'some',
    },
}

# Bulk / admin accounts to exclude from author charts and dropdown
EXCLUDE_SQL = """
    author_name NOT LIKE 'Author #%'
    AND author_name NOT LIKE '%Δελτίο Τύπου%'
    AND author_name NOT IN ('news.team', 'Newsroom', 'NEWSROOM', 'editorial', 'Editorial')
    AND LENGTH(TRIM(author_name)) > 2
"""

_cache: dict = {}


def _keywords(titles: list, lang: str) -> list[str]:
    sw = STOPWORDS.get(lang, set())
    words: list[str] = []
    for t in titles:
        if not t:
            continue
        for w in re.sub(r"[^\w\s]", " ", t.lower()).split():
            if len(w) > 3 and w not in sw and not w.isdigit():
                words.append(w)
    return [w for w, _ in Counter(words).most_common(7)]


# ── /overview ────────────────────────────────────────────────────────────────

@router.get("/{lang}/overview")
def overview(lang: str):
    if lang not in TABLES:
        raise HTTPException(404, f"Unknown language: {lang}")

    cache_key = f"overview_{lang}"
    if cache_key in _cache:
        return _cache[cache_key]

    tbl = TABLES[lang]

    with get_cursor() as cur:
        # Global stats
        cur.execute(f"""
            SELECT
                COUNT(*)                                                      AS total_articles,
                COUNT(DISTINCT author_id)                                     AS total_authors,
                COUNT(DISTINCT publisher_id)                                  AS total_publishers,
                ROUND(AVG(word_count))                                        AS avg_word_count,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY word_count)) AS median_word_count
            FROM {tbl}
        """)
        stats = row_to_dict(cur.fetchone())
        for k in stats:
            if stats[k] is not None:
                stats[k] = int(stats[k])

        # Top 10 authors
        cur.execute(f"""
            SELECT author_id, author_name,
                   COUNT(*)             AS article_count,
                   ROUND(AVG(word_count)) AS avg_word_count
            FROM   {tbl}
            WHERE  {EXCLUDE_SQL}
            GROUP  BY author_id, author_name
            ORDER  BY article_count DESC
            LIMIT  10
        """)
        top_authors = [row_to_dict(r) for r in cur.fetchall()]

        # Publisher breakdown
        cur.execute(f"""
            SELECT publisher_id, COUNT(*) AS article_count
            FROM   {tbl}
            GROUP  BY publisher_id
            ORDER  BY article_count DESC
        """)
        publishers = [row_to_dict(r) for r in cur.fetchall()]

        # Word-count distribution
        cur.execute(f"""
            SELECT bucket_id, label, COUNT(*) AS count
            FROM (
                SELECT
                    CASE
                        WHEN word_count <  100 THEN 1
                        WHEN word_count <  200 THEN 2
                        WHEN word_count <  300 THEN 3
                        WHEN word_count <  500 THEN 4
                        WHEN word_count <  800 THEN 5
                        WHEN word_count < 1200 THEN 6
                        WHEN word_count < 2000 THEN 7
                        ELSE 8
                    END AS bucket_id,
                    CASE
                        WHEN word_count <  100 THEN '< 100'
                        WHEN word_count <  200 THEN '100–200'
                        WHEN word_count <  300 THEN '200–300'
                        WHEN word_count <  500 THEN '300–500'
                        WHEN word_count <  800 THEN '500–800'
                        WHEN word_count < 1200 THEN '800–1.2k'
                        WHEN word_count < 2000 THEN '1.2k–2k'
                        ELSE '2k+'
                    END AS label
                FROM {tbl}
            ) b
            GROUP  BY bucket_id, label
            ORDER  BY bucket_id
        """)
        word_dist = [{"range": r["label"], "count": int(r["count"])} for r in cur.fetchall()]

        # Articles-per-year (for timeline chart)
        cur.execute(f"""
            SELECT EXTRACT(YEAR FROM published_at)::int AS year, COUNT(*) AS count
            FROM   {tbl}
            WHERE  published_at IS NOT NULL
              AND  published_at > '2000-01-01'
            GROUP  BY year
            ORDER  BY year
        """)
        yearly = [{"year": int(r["year"]), "count": int(r["count"])} for r in cur.fetchall()]

    result = {
        "stats":              stats,
        "top_authors":        top_authors,
        "publisher_breakdown": publishers,
        "word_distribution":  word_dist,
        "yearly_articles":    yearly,
    }
    _cache[cache_key] = result
    return result


# ── /authors ──────────────────────────────────────────────────────────────────

@router.get("/{lang}/authors")
def authors(lang: str):
    if lang not in TABLES:
        raise HTTPException(404, f"Unknown language: {lang}")

    cache_key = f"authors_{lang}"
    if cache_key in _cache:
        return _cache[cache_key]

    tbl = TABLES[lang]
    with get_cursor() as cur:
        cur.execute(f"""
            SELECT author_id, author_name, COUNT(*) AS article_count
            FROM   {tbl}
            WHERE  {EXCLUDE_SQL}
            GROUP  BY author_id, author_name
            HAVING COUNT(*) >= 5
            ORDER  BY article_count DESC
        """)
        result = [row_to_dict(r) for r in cur.fetchall()]

    _cache[cache_key] = result
    return result


# ── /author-topics (lightweight — no Qwen, instant) ──────────────────────────

@router.get("/{lang}/author-topics")
def author_topics(lang: str, author_id: str = Query(...)):
    """Return top topic keywords for an author from their article titles only.
    No Qwen, no body analysis — responds in < 200 ms."""
    if lang not in TABLES:
        raise HTTPException(404, f"Unknown language: {lang}")

    cache_key = f"topics_{lang}_{author_id}"
    if cache_key in _cache:
        return _cache[cache_key]

    tbl = TABLES[lang]
    with get_cursor() as cur:
        cur.execute(f"""
            SELECT title FROM {tbl}
            WHERE  author_id = %s AND title IS NOT NULL
            ORDER  BY COALESCE(published_at, '2000-01-01'::timestamp) DESC NULLS LAST
            LIMIT  80
        """, (author_id,))
        titles = [r["title"] for r in cur.fetchall()]

    # Return top 10 to give GenerateContent more to show
    # Extra noise words — generic journalistic verbs that appear in titles universally
    TOPIC_NOISE = {
        'study', 'finds', 'found', 'shows', 'show', 'says', 'said', 'say',
        'suggests', 'suggest', 'claims', 'claim', 'report', 'reports', 'reported',
        'scientists', 'researchers', 'experts', 'official', 'officials', 'sources',
        'review', 'analysis', 'news', 'update', 'latest', 'first', 'year', 'years',
        'week', 'month', 'make', 'makes', 'made', 'take', 'takes', 'taken',
        'people', 'person', 'world', 'time', 'times', 'days', 'week', 'weeks',
        'publisher', 'investigator', 'mail', 'daily', 'weekly',
        'τίτλο', 'ανακοινώνει', 'ανακοινώνουν', 'ανακοινώνει', 'ανακοινώνω',
    }
    sw = STOPWORDS.get(lang, set()) | TOPIC_NOISE
    words: list[str] = []
    for t in titles:
        if not t:
            continue
        for w in re.sub(r"[^\w\s]", " ", t.lower()).split():
            if len(w) > 3 and w not in sw and not w.isdigit():
                words.append(w)
    topics = [w for w, _ in Counter(words).most_common(10)]

    result = {"author_id": author_id, "topics": topics}
    _cache[cache_key] = result
    return result


# ── /author ───────────────────────────────────────────────────────────────────

@router.get("/{lang}/author")
def author_detail(lang: str, author_id: str = Query(...)):
    if lang not in TABLES:
        raise HTTPException(404, f"Unknown language: {lang}")

    tbl = TABLES[lang]
    with get_cursor() as cur:
        # Aggregate stats
        cur.execute(f"""
            SELECT
                author_name,
                COUNT(*)                                                            AS article_count,
                ROUND(AVG(word_count))                                              AS avg_word_count,
                MIN(word_count)                                                     AS min_word_count,
                MAX(word_count)                                                     AS max_word_count,
                MIN(CASE WHEN published_at > '2000-01-01' THEN published_at END)   AS first_article,
                MAX(CASE WHEN published_at > '2000-01-01' THEN published_at END)   AS last_article,
                array_agg(DISTINCT publisher_id)                                    AS publishers
            FROM {tbl}
            WHERE author_id = %s
            GROUP BY author_name
            LIMIT 1
        """, (author_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Author not found")

        stats = row_to_dict(row)
        stats["article_count"]   = int(stats.get("article_count") or 0)
        stats["avg_word_count"]  = int(stats.get("avg_word_count") or 0)
        stats["min_word_count"]  = int(stats.get("min_word_count") or 0)
        stats["max_word_count"]  = int(stats.get("max_word_count") or 0)

        # Years active
        f, l = stats.get("first_article"), stats.get("last_article")
        years_active = None
        if f and l:
            try:
                years_active = max(1, int(str(l)[:4]) - int(str(f)[:4]) + 1)
            except Exception:
                pass
        stats["years_active"] = years_active

        # Publishers list (psycopg2 returns a Python list for array_agg)
        pubs = stats.get("publishers") or []
        stats["publishers"] = [str(p) for p in pubs if p]

        # Style label
        avg = stats["avg_word_count"]
        stats["style_label"] = (
            "Short-form"        if avg < 200  else
            "Medium-length"     if avg < 500  else
            "Long-form"         if avg < 1000 else
            "In-depth / Feature"
        )

        # Sample articles (5 most recent) — excerpt for card, full body for modal
        cur.execute(f"""
            SELECT article_id, title,
                   LEFT(body, 300) AS excerpt,
                   body,
                   word_count, published_at
            FROM   {tbl}
            WHERE  author_id = %s
            ORDER  BY COALESCE(published_at, '2000-01-01'::timestamp) DESC NULLS LAST
            LIMIT  5
        """, (author_id,))
        articles = []
        for r in cur.fetchall():
            d = row_to_dict(r)
            d["word_count"] = int(d.get("word_count") or 0)
            articles.append(d)

        # Fetch up to 30 full bodies for trait computation
        cur.execute(f"""
            SELECT body, title FROM {tbl}
            WHERE  author_id = %s
            ORDER  BY COALESCE(published_at, '2000-01-01'::timestamp) DESC NULLS LAST
            LIMIT  30
        """, (author_id,))
        body_rows  = cur.fetchall()
        bodies     = [r["body"]  for r in body_rows if r.get("body")]
        all_titles = [r["title"] for r in body_rows if r.get("title")]

        keywords = _keywords(all_titles, lang)

    # ── 1. Math metrics — always computed, never fails ────────────────────
    math_metrics = compute_traits(bodies).get("metrics", {})

    # ── 2. LLM traits — Qwen if tunnel open, rule-based fallback ─────────
    cache_key = f"traits_{lang}_{author_id}"
    if cache_key in _qwen_trait_cache:
        llm_result = _qwen_trait_cache[cache_key]
    else:
        llm_result = generate_traits_qwen(bodies, stats["author_name"], lang)
        if llm_result:
            _qwen_trait_cache[cache_key] = llm_result

    # If Qwen failed, derive qualitative labels from the math
    if llm_result:
        traits        = llm_result["traits"]
        traits_source = "qwen"
    else:
        rule          = compute_traits(bodies)
        traits        = rule.get("traits", {})
        traits_source = "computed"

    return {
        "stats":           stats,
        "sample_articles": articles,
        "keywords":        keywords,
        "style": {
            "metrics":       math_metrics,    # always math-based
            "traits":        traits,          # Qwen or rule-based
            "traits_source": traits_source,   # "qwen" | "computed"
        },
    }
