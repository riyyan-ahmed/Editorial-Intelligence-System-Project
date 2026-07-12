from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_cursor, row_to_dict
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests, re
import config

QWEN_URL   = config.QWEN_URL
QWEN_MODEL = config.QWEN_MODEL
EMBED_URL  = config.EMBED_URL

router = APIRouter(prefix="/generation", tags=["generation"])

TABLES     = {"el": "greek_author_styles", "en": "english_author_styles"}
LANG_LABEL = {"el": "Greek (ελληνικά)",   "en": "English"}


class GenerateRequest(BaseModel):
    lang:        str
    author_id:   str
    author_name: str
    query:       str


# ── Qwen helpers ──────────────────────────────────────────────────────────────

def _qwen(messages: list, max_tokens: int = 600, temperature: float = 0.3) -> str:
    resp = requests.post(
        f"{QWEN_URL}/chat/completions",
        json={"model": QWEN_MODEL, "messages": messages,
              "temperature": temperature, "max_tokens": max_tokens},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def _qwen_with_usage(messages: list, max_tokens: int = 1000,
                     temperature: float = 0.72) -> tuple[str, int, int]:
    resp = requests.post(
        f"{QWEN_URL}/chat/completions",
        json={"model": QWEN_MODEL, "messages": messages,
              "temperature": temperature, "max_tokens": max_tokens},
        timeout=90,
    )
    resp.raise_for_status()
    body          = resp.json()
    content       = body["choices"][0]["message"]["content"].strip()
    usage         = body.get("usage", {})
    return content, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)


# ── Web search + content enrichment ──────────────────────────────────────────

def _clean_date(raw: str) -> str:
    return str(raw)[:10] if raw else ""


def _clean_snippet(text: str) -> str:
    text = re.sub(r'\s+', ' ', text or '').strip()
    return text[:-3].strip() if text.endswith('...') else text


def _fetch_url_content(url: str, max_chars: int = 800) -> str:
    try:
        resp = requests.get(
            url, timeout=5,
            headers={"User-Agent": "Mozilla/5.0 (compatible; EditorialBot/1.0)"},
            allow_redirects=True,
        )
        if resp.status_code != 200:
            return ""
        html = resp.text
        html = re.sub(r'<(script|style|nav|footer|header|aside)[^>]*>.*?</\1>',
                      ' ', html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', html)
        text = re.sub(r'\s+', ' ', text).strip()
        text = text[300:] if len(text) > 300 else text
        return text[:max_chars]
    except Exception:
        return ""


def _sanitise_query(query: str) -> str:
    """
    Strip characters that break DuckDuckGo / Yahoo URL encoding.
    Colons, quotes, and angle brackets are the main offenders.
    """
    return re.sub(r'[:"<>]', ' ', query).strip()


def _web_search_greek(query: str, max_results: int = 3) -> list[dict]:
    """Greek-language DuckDuckGo search — supplements English results for Greek queries."""
    try:
        from ddgs import DDGS
    except ImportError:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            return []

    safe_query = _sanitise_query(query)
    results = []

    for search_type, region in [("news", "gr-el"), ("text", "gr-el")]:
        if results:
            break
        try:
            with DDGS() as ddgs:
                if search_type == "news":
                    hits = list(ddgs.news(safe_query, max_results=max_results, region="gr-el"))
                else:
                    hits = list(ddgs.text(safe_query, max_results=max_results, region="gr-el"))
            for h in hits:
                snippet = _clean_snippet(h.get("body", "") or h.get("snippet", ""))
                if snippet:
                    results.append({
                        "title":        (h.get("title") or "").strip(),
                        "snippet":      snippet,
                        "full_content": "",
                        "source":       (h.get("source") or h.get("url", "")).strip(),
                        "url":          (h.get("url") or h.get("href", "")).strip(),
                        "date":         _clean_date(h.get("date", "")),
                    })
        except Exception:
            continue

    return results


def _web_search(query: str, max_results: int = 6) -> list[dict]:
    try:
        from ddgs import DDGS
    except ImportError:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            return []

    safe_query = _sanitise_query(query)

    # Strategy: try news first; on empty or error fall back to text search;
    # on second error try a shorter version of the query (first 5 words).
    def _try_news(q):
        with DDGS() as ddgs:
            return list(ddgs.news(q, max_results=max_results))

    def _try_text(q):
        with DDGS() as ddgs:
            return list(ddgs.text(q, max_results=max_results))

    short_query = " ".join(safe_query.split()[:5])

    hits = []
    for attempt_fn, attempt_q in [
        (_try_news, safe_query),
        (_try_text, safe_query),
        (_try_news, short_query),
        (_try_text, short_query),
    ]:
        if hits:
            break
        try:
            hits = attempt_fn(attempt_q)
        except Exception:
            continue

    results = []
    for h in hits:
        snippet = _clean_snippet(h.get("body", "") or h.get("snippet", ""))
        if not snippet:
            continue
        results.append({
            "title":        (h.get("title") or "").strip(),
            "snippet":      snippet,
            "full_content": "",
            "source":       (h.get("source") or "").strip(),
            "url":          (h.get("url") or h.get("href", "")).strip(),
            "date":         _clean_date(h.get("date", "")),
        })
    return results


def _enrich_web_results(results: list[dict]) -> list[dict]:
    if not results:
        return results

    def enrich(item):
        url = item.get("url", "")
        if not url:
            return item
        fetched = _fetch_url_content(url)
        if fetched and len(fetched) > len(item["snippet"]) + 100:
            return {**item, "full_content": fetched}
        return {**item, "full_content": item["snippet"]}

    enriched = list(results)
    with ThreadPoolExecutor(max_workers=6) as exe:
        futures = {exe.submit(enrich, r): i for i, r in enumerate(results)}
        try:
            for fut in as_completed(futures, timeout=8):
                idx = futures[fut]
                try:
                    enriched[idx] = fut.result()
                except Exception:
                    enriched[idx]["full_content"] = enriched[idx]["snippet"]
        except Exception:
            # Timeout or other error — use whatever was enriched so far
            pass

    for r in enriched:
        if not r.get("full_content"):
            r["full_content"] = r["snippet"]

    return enriched


# ── Web-fact translation ──────────────────────────────────────────────────────

def _translate_web_block(web_block: str, lang: str, lang_label: str) -> str:
    """
    Pre-translate English web facts into the target language before generation.
    Separating translation from generation is the core fix for non-English quality:
    the 7B model handles one focused task per call instead of translate+style+generate.
    Returns the original block unchanged for English or on any failure.
    """
    if lang == "en" or not web_block or web_block.startswith("No live web"):
        return web_block
    # Cap input to keep within token budget and prevent timeout
    block_to_translate = web_block[:3500]
    try:
        resp = requests.post(
            f"{QWEN_URL}/chat/completions",
            json={
                "model": QWEN_MODEL,
                "messages": [
                    {"role": "system", "content": (
                        f"You are a professional translator specialising in music and culture news. "
                        f"Translate the following news excerpts into natural, idiomatic {lang_label}.\n\n"
                        f"CRITICAL RULES — follow exactly:\n"
                        f"1. PROPER NOUNS — keep in ORIGINAL LATIN spelling, never transliterate:\n"
                        f"   • Person names: Beth Gibbons stays 'Beth Gibbons', not 'Βέθ Χίβονς'\n"
                        f"   • Band/artist names: Portishead stays 'Portishead', not 'Πόρτισχεντ'\n"
                        f"   • Album/song titles: 'Dummy' stays 'Dummy', 'Lives Outgrown' stays 'Lives Outgrown'\n"
                        f"   • Awards: 'Mercury Prize' stays 'Mercury Prize'\n"
                        f"   • Venues/places: keep original unless they have a well-known {lang_label} form\n"
                        f"2. MUSIC TERMINOLOGY — use correct {lang_label} terms:\n"
                        f"   • album → άλμπουμ (NOT ταινία which means film)\n"
                        f"   • band/group → συγκρότημα\n"
                        f"   • vocalist/singer → τραγουδίστρια / τραγουδιστής\n"
                        f"   • songwriter → στιχουργός\n"
                        f"   • ALL music genre names stay in English unchanged:\n"
                        f"     indie, alternative, trip-hop, post-punk, gothic rock, dream-pop,\n"
                        f"     ambient, folk, blues, jazz, hip-hop, electronic — do NOT translate these\n"
                        f"   • song/track → τραγούδι, κομμάτι\n"
                        f"   • EP, LP, single → keep as EP, LP, single\n"
                        f"   • halftime show → σόου ημιχρόνου\n"
                        f"   • streaming → streaming\n"
                        f"   • award show terms: Grammy, Oscar, BAFTA → keep unchanged\n"
                        f"3. Keep ALL dates, numbers, and statistics unchanged\n"
                        f"4. Never translate word-for-word; use natural {lang_label} sentence structure\n"
                        f"5. Maintain the SOURCE labels at the start of each block\n"
                        f"Output ONLY the translated text, nothing else."
                    )},
                    {"role": "user", "content": block_to_translate},
                ],
                "temperature": 0.1,
                "max_tokens": 1800,
            },
            timeout=120,
        )
        resp.raise_for_status()
        translated = resp.json()["choices"][0]["message"]["content"].strip()
        # If input was truncated, append the untranslated remainder so no facts are lost
        if len(web_block) > 3500:
            translated += "\n\n" + web_block[3500:]
        return translated
    except Exception:
        return web_block  # safe fallback — English facts remain usable in Step 1


# ── Embeddings + style retrieval ──────────────────────────────────────────────

def _embed(text: str) -> list[float] | None:
    try:
        resp = requests.post(EMBED_URL, json={"inputs": text}, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return data[0] if isinstance(data, list) and isinstance(data[0], list) else data
    except Exception:
        return None


def _style_articles(cur, tbl: str, author_id: str,
                    query_rewritten: str) -> tuple[list[dict], str]:
    """
    Retrieve up to 3 style reference articles for the author.
    3 is the ceiling: voice is established within 2-3 examples;
    more dilutes attention and pushes facts deeper in the context window.
    """
    # 1. Semantic via bge-m3
    query_vec = _embed(query_rewritten)
    if query_vec is not None:
        vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"
        cur.execute(
            f"""
            SELECT title, LEFT(body, 2000) AS excerpt, word_count, published_at,
                   1 - (embedding <=> %s::vector) AS similarity
            FROM   {tbl}
            WHERE  author_id = %s AND body IS NOT NULL AND embedding IS NOT NULL
            ORDER  BY embedding <=> %s::vector
            LIMIT  3
            """,
            (vec_str, author_id, vec_str),
        )
        rows = cur.fetchall()
        if rows:
            return [row_to_dict(r) for r in rows], "semantic"

    # 2. Keyword ILIKE fallback
    SKIP = {'about', 'their', 'which', 'these', 'those', 'where', 'there',
            'could', 'would', 'should', 'after', 'while', 'being', 'have',
            'with', 'from', 'that', 'this', 'will', 'been', 'were'}
    keywords = [
        w for w in re.sub(r'[^\w\s]', ' ', query_rewritten.lower()).split()
        if len(w) > 4 and w not in SKIP
    ][:4]
    if keywords:
        conditions = " OR ".join(
            "(LOWER(title) LIKE %s OR LOWER(LEFT(body, 2000)) LIKE %s)"
            for _ in keywords
        )
        params = []
        for kw in keywords:
            params.extend([f'%{kw}%', f'%{kw}%'])
        cur.execute(
            f"""
            SELECT title, LEFT(body, 2000) AS excerpt, word_count, published_at
            FROM   {tbl}
            WHERE  author_id = %s AND body IS NOT NULL AND ({conditions})
            ORDER  BY COALESCE(published_at, '2000-01-01'::timestamp) DESC NULLS LAST
            LIMIT  3
            """,
            [author_id] + params,
        )
        rows = cur.fetchall()
        if len(rows) >= 2:
            return [row_to_dict(r) for r in rows], "keyword"

    # 3. Recency fallback
    cur.execute(
        f"""
        SELECT title, LEFT(body, 2000) AS excerpt, word_count, published_at
        FROM   {tbl}
        WHERE  author_id = %s AND body IS NOT NULL
        ORDER  BY COALESCE(published_at, '2000-01-01'::timestamp) DESC NULLS LAST
        LIMIT  3
        """,
        (author_id,),
    )
    return [row_to_dict(r) for r in cur.fetchall()], "recency"


# ── Prompt builders ───────────────────────────────────────────────────────────

def _step1_prompt(web_block: str, lang_label: str, query: str, lang: str,
                  pre_translated: bool = False) -> str:
    if lang != "en":
        if pre_translated:
            lang_instruction = (
                f"1. Language: {lang_label} — write the ENTIRE article in {lang_label}\n"
                f"2. The sources below are already in {lang_label}. Use them directly. "
                f"Preserve ALL proper nouns exactly as written "
                f"(person names, band names, album titles, organisations, places). "
                f"Every sentence must read as if written by a native {lang_label} speaker."
            )
        else:
            lang_instruction = (
                f"1. Language: {lang_label} — write the ENTIRE article in {lang_label}\n"
                f"2. The sources below are in English. As you write, convert the facts naturally "
                f"   into {lang_label}. Preserve ALL proper nouns exactly as written "
                f"   (person names, band names, album titles, organisations, places). "
                f"   Never translate word-for-word — use natural {lang_label} equivalents for English idioms. "
                f"   Every sentence must read as if written by a native {lang_label} speaker."
            )
    else:
        lang_instruction = f"1. Language: English — write the entire article in English"

    return f"""You are a professional news editor producing a factual article draft.
Your sole objective at this stage is factual accuracy and clear journalistic structure.
Do NOT apply any specific journalist's style — write in a clean, neutral editorial voice.

════════════════════════════════════════
FACTUAL SOURCES — your only reference for this article
════════════════════════════════════════
{web_block}

════════════════════════════════════════
TASK: Write a factual news article about: "{query}"
════════════════════════════════════════

REQUIREMENTS:
{lang_instruction}
3. Accuracy: draw ONLY from the sources above; never invent names, dates, figures, or events
4. Structure:
   — Headline: clear, factual, specific
   — Lead paragraph: answers who / what / when / where in 2-3 sentences
   — Body: develop the key facts and context from the sources
   — Close: a forward-looking observation or implication (no invented quotes)
5. Length: 400–500 words
6. Tone: clear, neutral, informative — no opinion, no editorialising
7. Omission rule: if a detail is absent from the sources, omit it entirely — never guess"""


def _step2_prompt(style_block: str, author_name: str, lang_label: str, lang: str) -> str:
    """
    Step 2 — Style Transfer.
    Style examples appear first (the primary constraint in this call).
    The factual draft arrives via the user message, completely separate from the
    style examples, which prevents content from either side contaminating the other.
    The model's only task here is to change HOW the article reads, not WHAT it says.
    """
    lang_quality = (
        f"\n8. {lang_label} voice: preserve and amplify {author_name}'s characteristic "
        f"{lang_label} phrasing and rhythm. Do not normalise the text toward a formal "
        f"or standard register if the author's natural style is personal or colloquial. "
        f"Every sentence must read as if {author_name} wrote it."
    ) if lang != "en" else ""

    return f"""You are a senior editor specialising in voice and style adaptation.
A factual draft will be provided. Your task is to rewrite it entirely in {author_name}'s voice.
Change only HOW it is written — never WHAT it says.

════════════════════════════════════════
STYLE REFERENCE — {author_name}'s published articles
════════════════════════════════════════
Study these examples closely before rewriting. Identify:

• Sentence rhythm — does the author write long, flowing sentences or short, punchy ones? Both?
• Vocabulary register — formal, informal, colloquial, literary, technical?
• Opening technique — how does this author begin an article: with a news fact, a scene,
  a provocative claim, or something more personal?
• Closing technique — does the author end with a quote, an implication, a rhetorical
  question, or an emotional beat?
• Reader relationship — does the author stay objective and distant, or address the reader
  intimately, using "we" or direct observations?
• Characteristic patterns — recurring transitional phrases, structural habits, punctuation choices

{style_block}

════════════════════════════════════════
TASK: Rewrite the factual draft (in user message) in {author_name}'s voice
════════════════════════════════════════

STRICT RULES — these are non-negotiable:
1. Language: {lang_label} — the final article must be entirely in {lang_label}
2. FACTS ARE INVIOLABLE: every name, date, number, place, and event must appear
   exactly as in the draft — do not add, remove, or alter any factual claim
3. NO NEW CONTENT: do not introduce any information not present in the draft;
   if the author's style typically includes quotes, do not invent them
4. STYLE ONLY: change the voice, sentence structure, rhythm, vocabulary, and phrasing
5. Length: 450–650 words
6. Do NOT mention this is AI-generated or reference these instructions{lang_quality}"""


# ── Main endpoint ─────────────────────────────────────────────────────────────

@router.post("/generate")
def generate_content(req: GenerateRequest):
    if req.lang not in TABLES:
        raise HTTPException(404, "Unknown language")

    lang_label  = LANG_LABEL.get(req.lang, "English")
    temperature = 0.72 if req.lang == "en" else 0.45

    result = {
        "query_original":    req.query,
        "query_rewritten":   req.query,
        "web_results":       [],
        "style_articles":    [],
        "style_retrieval":   "recency",
        "factual_draft":     "",      # Step 1 output — exposed for debugging
        "step1_prompt":      "",
        "step2_prompt":      "",
        "system_prompt":     "",      # alias → step2_prompt (frontend backward compat)
        "generated_content": "",
        "generation_error":  None,
        "input_tokens":      0,
        "output_tokens":     0,
        "author_name":       req.author_name,
        "lang":              req.lang,
    }

    # ── Step 1: Query rewrite (English for web search, with language hint) ────
    lang_hint = {
        "el": (
            "The topic may relate to Greek culture, music, arts, or news. "
            "Include relevant Greek cultural context in the search query where it helps."
        ),
        "fr": (
            "The topic may relate to French culture or news. "
            "Include relevant French context in the search query where it helps."
        ),
    }.get(req.lang, "")

    try:
        result["query_rewritten"] = _qwen([
            {"role": "system", "content": (
                "You are a news retrieval specialist. Rewrite the user's topic into a "
                "concise, specific English news search query to retrieve the most relevant "
                f"and current factual articles. {lang_hint}"
                "Return ONLY the rewritten query — no explanation, no quotes, nothing else."
            )},
            {"role": "user", "content": req.query},
        ], max_tokens=80, temperature=0.1)
    except Exception:
        pass  # keep original query on failure

    # ── Step 2: Web search + parallel URL enrichment ──────────────────────────
    raw_results = _web_search(result["query_rewritten"])

    # For Greek, also search in Greek (original query) and merge unique results
    if req.lang == "el":
        greek_hits = _web_search_greek(req.query, max_results=3)
        seen_urls = {r["url"] for r in raw_results}
        for r in greek_hits:
            if r["url"] and r["url"] not in seen_urls:
                raw_results.append(r)
                seen_urls.add(r["url"])

    result["web_results"] = _enrich_web_results(raw_results)

    # ── Step 3: Style articles (max 3) ───────────────────────────────────────
    tbl = TABLES[req.lang]
    with get_cursor() as cur:
        articles, retrieval_method = _style_articles(
            cur, tbl, req.author_id, result["query_rewritten"]
        )
        result["style_articles"]  = articles
        result["style_retrieval"] = retrieval_method

    # ── Step 4: Build web block ───────────────────────────────────────────────
    if result["web_results"]:
        web_block_raw = "\n\n".join(
            f"SOURCE {i+1} [{r['source']}] {r['date']} — {r['title']}:\n{r['full_content']}"
            for i, r in enumerate(result["web_results"])
        )
    else:
        web_block_raw = (
            "No live web results retrieved. Draw only on well-established, verifiable "
            "general knowledge about the topic. Do not fabricate specific recent events, "
            "statistics, or attributed statements."
        )

    # ── Step 4.5: Pre-translate web block for non-English ────────────────────
    # Separating translation from generation is the core fix for Greek quality:
    # the 7B model handles one focused task at a time instead of translate+write together.
    web_block = _translate_web_block(web_block_raw, req.lang, lang_label)
    pre_translated = (req.lang != "en" and web_block != web_block_raw)

    # ── Step 5: Build style block ─────────────────────────────────────────────
    style_block = "\n\n---\n\n".join(
        f"ARTICLE {i+1} — \"{a.get('title') or 'untitled'}\":\n{a.get('excerpt', '').strip()}"
        for i, a in enumerate(result["style_articles"])
    ) or "No style examples available for this author."

    # ── Step 6: Generate factual draft ───────────────────────────────────────
    # No style constraint in this call — the model focuses entirely on accuracy.
    # Facts first in the prompt = highest attention at generation time.
    step1_sys = _step1_prompt(web_block, lang_label, req.query, req.lang,
                              pre_translated=pre_translated)
    result["step1_prompt"] = step1_sys

    try:
        draft, tok_in_1, tok_out_1 = _qwen_with_usage(
            [
                {"role": "system", "content": step1_sys},
                {"role": "user",   "content": "Write the factual draft now."},
            ],
            max_tokens=900,
            temperature=temperature,
        )
        result["factual_draft"]  = draft
        result["input_tokens"]  += tok_in_1
        result["output_tokens"] += tok_out_1
    except Exception as e:
        result["generation_error"] = f"Step 1 (factual draft) failed: {e}"
        return result  # cannot proceed without a draft

    # ── Step 7: Style transfer ────────────────────────────────────────────────
    # Style examples live in system prompt; draft arrives as user message.
    # This separation prevents style-article content from contaminating facts
    # and prevents facts from diluting the style signal.
    #
    # If no style articles exist for this author, return the factual draft as-is
    # rather than running a style-transfer call with nothing to transfer from.
    if not result["style_articles"]:
        result["generated_content"] = draft
        result["system_prompt"]     = step1_sys
        return result

    step2_sys = _step2_prompt(style_block, req.author_name, lang_label, req.lang)
    result["step2_prompt"] = step2_sys
    result["system_prompt"] = step2_sys  # frontend debug panel shows this

    try:
        final, tok_in_2, tok_out_2 = _qwen_with_usage(
            [
                {"role": "system", "content": step2_sys},
                {"role": "user",   "content": (
                    f"Here is the factual draft. Rewrite it in {req.author_name}'s voice "
                    f"following all rules above. Every fact must be preserved exactly.\n\n"
                    f"DRAFT:\n{draft}"
                )},
            ],
            max_tokens=1200,
            temperature=temperature,
        )
        result["generated_content"] = final
        result["input_tokens"]      += tok_in_2
        result["output_tokens"]     += tok_out_2
    except Exception as e:
        # Step 2 failure is non-fatal — the factual draft is still useful output.
        result["generated_content"] = draft
        result["generation_error"]  = f"Step 2 (style transfer) failed, returning factual draft: {e}"

    return result
