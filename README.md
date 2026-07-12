# Editorial Intelligence System Project

Unified MediaSync 2.1 MVP workspace.

## Purpose

This repository is for unifying the existing Author/Profile Feedback app and the Cluster Intelligence app into one MediaSync 2.1 MVP workflow.

Target MVP flow:

```text
Login
-> Cluster Dashboard
-> Cluster Detail
-> Best Sources / RAG Context
-> Author or Publisher Style Selection
-> Draft Generation
-> Editorial Review
-> Feedback
-> History
```

## Important Rule

Do not edit the existing deployed apps directly while building the unified MVP.

Existing deployed apps remain as fallback/reference:

- App 1: `/data/app`
- App 2: `/data/scripts/app_editorial.py`

Unified work should happen in the new AWS folder:

```text
/data/mediasync21
```

## Repository Structure

```text
backend/                         Active unified FastAPI backend, based on App 1
frontend/                        Active unified React frontend, based on App 1
scripts/                         Utility/deployment/migration scripts for unified app
docs/                            Project notes and execution plan
reference/app1_author_feedback/  Sanitized reference copy of existing App 1
reference/app2_cluster_intelligence/ Sanitized reference copy of existing App 2
```

## Scope For 1 to 1.5 Week MVP

Included:

- Reuse existing authentication.
- Reuse existing cluster database.
- Move cluster feed/detail into React.
- Add FastAPI cluster endpoints.
- Reuse existing RAG/generation behavior.
- Refactor RAG source selection to use existing `mmr_rank`.
- Connect generated drafts to review, feedback, evaluation, and history.

Excluded from this MVP:

- New ingestion pipelines.
- New model deployment.
- Full recommendation engine.
- Full publisher intelligence.
- Automated learning/fine-tuning loop.
- Production hardening beyond exposing the unified demo.

## Security

This is a public repository. Never commit:

- `.env` files
- database passwords
- OpenRouter/API keys
- AWS keys or `.pem` files
- JWT secrets
- local auth databases
- `node_modules`, virtualenvs, or build output

Use `.env.example` as the template.

## Local Development

Backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn main:app --reload --port 5035
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Branching

Recommended workflow:

```text
main        stable baseline
develop     integration branch
feature/*   individual work branches
```

Suggested junior developer tasks:

- `feature/cluster-dashboard-ui`
- `feature/cluster-detail-ui`
- `feature/rag-preview-ui`

Suggested senior/backend tasks:

- `feature/cluster-apis`
- `feature/mmr-rag-context`
- `feature/cluster-generation`
- `feature/history-feedback-integration`

