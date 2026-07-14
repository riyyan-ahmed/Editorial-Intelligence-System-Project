# Frontend API Contract

All endpoints are under `/api` and require the existing JWT token unless noted.

Frontend should send:

```http
Authorization: Bearer <token>
```

## Cluster Dashboard

### `GET /api/clusters/stats`

Returns article and cluster counts by language.

### `GET /api/clusters`

Query params:

```text
lang=el|en
category=<optional>
search=<optional title or cluster id>
sort=score|articles|recent
min_articles=2
limit=50
offset=0
include_pinned=true
```

Returns:

```json
{
  "items": [
    {
      "id": 374788,
      "title": "...",
      "summary": "...",
      "main_category": "sports",
      "language": "el",
      "articles_count": 10,
      "sources_count": 4,
      "final_score": 0.73,
      "first_seen": "2026-04-01",
      "last_seen": "2026-04-03",
      "span_days": 2,
      "pinned": true
    }
  ],
  "limit": 50,
  "offset": 0,
  "count": 50
}
```

## Cluster Detail

### `GET /api/clusters/{cluster_id}`

Returns cluster metadata and scores.

### `GET /api/clusters/{cluster_id}/sources?limit=25`

Returns source distribution for the cluster.

### `GET /api/clusters/{cluster_id}/articles?limit=25`

Returns article list for inspection.

### `GET /api/clusters/{cluster_id}/rag-context?limit=5`

Returns the source articles selected for generation.

Important: selection uses existing MMR rank first.

```json
{
  "cluster_id": 374788,
  "selection_method": "mmr_rank_then_similarity_then_content_length",
  "articles": [
    {
      "article_id": "...",
      "title": "...",
      "source_domain": "...",
      "published_at": "2026-05-18",
      "author": "...",
      "preview": "...",
      "content_len": 1200,
      "similarity_score": 0.94,
      "mmr_rank": 1
    }
  ]
}
```

## Cluster Generation

### `POST /api/generation/cluster-generate`

Generates a draft from selected cluster + selected author/publisher style.

Author style request:

```json
{
  "cluster_id": 426230,
  "style_mode": "author",
  "author_id": "author-id",
  "author_name": "Author Name",
  "rag_limit": 5
}
```

Publisher style request:

```json
{
  "cluster_id": 426230,
  "style_mode": "publisher",
  "publisher_id": "newsit.gr",
  "rag_limit": 5
}
```

Response:

```json
{
  "cluster": {
    "id": 426230,
    "title": "...",
    "language": "en"
  },
  "lang": "en",
  "style_mode": "author",
  "author_id": "...",
  "author_name": "...",
  "publisher_id": null,
  "rag_articles": [],
  "style_articles": [],
  "style_retrieval": "semantic",
  "selection_method": "mmr_rank_then_similarity_then_content_length",
  "factual_draft": "...",
  "generated_content": "...",
  "generation_error": null,
  "input_tokens": 1234,
  "output_tokens": 700,
  "generation_history_id": 2,
  "created_at": "2026-07-14",
  "prompt_version": "cluster_generate_v1"
}
```

Frontend should use:

- `generated_content` for the draft editor.
- `rag_articles` for the RAG/source preview panel.
- `style_articles` for style-reference preview.
- `generation_history_id` for feedback/history linking.

## Existing Auth

### `POST /api/auth/login`

Returns token, username, and role.

### `GET /api/auth/my-assignments`

Returns assigned authors for the logged-in editor.

## Existing Evaluation

### `POST /api/evaluation/submit`

Current author-generation evaluation endpoint is still available for the original author workflow.

## Generation History

### `GET /api/generation/history`

Returns generated drafts.

Admin users see all generated drafts. Non-admin users see drafts linked to their user id.

Query params:

```text
limit=50
offset=0
```

Response:

```json
{
  "items": [
    {
      "id": 2,
      "user_id": 1,
      "username": "admin",
      "cluster_id": 426230,
      "cluster_title": "...",
      "author_id": "...",
      "author_name": "Giles Richards",
      "publisher_id": null,
      "target_language": "en",
      "model": "Qwen/Qwen2.5-7B-Instruct",
      "generated_title": "...",
      "generated_summary": "...",
      "prompt_version": "cluster_generate_v1",
      "created_at": "2026-07-14",
      "feedback_count": 1
    }
  ],
  "limit": 50,
  "offset": 0
}
```

### `GET /api/generation/history/{generation_id}`

Returns full generated draft details, source/style JSON, and feedback rows.

Use this for:

- draft review screen
- history detail screen
- feedback state display

## Cluster Feedback

### `POST /api/evaluation/cluster-submit`

Saves editorial feedback for a cluster-generated draft.

Request:

```json
{
  "generation_history_id": 2,
  "user_content": "Edited/corrected article text...",
  "rating": 4,
  "notes": "Good draft, improved lead."
}
```

Response:

```json
{
  "ok": true,
  "generation_history_id": 2,
  "evaluation_id": 3,
  "editor_correction_id": 1,
  "cluster_feedback_id": 1,
  "created_at": "2026-07-14",
  "evaluated_at": "2026-07-14",
  "hter_score": 0.0207,
  "chrf_score": 97.93,
  "comet_score": null
}
```

This endpoint writes to:

- `evaluations`
- `editor_corrections`
- `cluster_feedback`

Frontend should call this after the editor reviews or edits `generated_content`.
