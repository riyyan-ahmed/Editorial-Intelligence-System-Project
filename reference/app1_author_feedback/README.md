# Editorial Intelligence App

## Prerequisites

- Python 3.10+
- Node.js 18+
- SSH tunnel to EC2 (PostgreSQL is on EC2 localhost)

---

## Step 1 — Open SSH tunnel (keep this terminal open)

```bash
ssh -i "/path/to/editorial-engine-key.pem" \
    -L 5433:localhost:5432 -N ubuntu@98.84.126.189
```

This forwards EC2 port 5432 → your local port 5433.

---

## Step 2 — Start the backend

```bash
cd "App/backend"
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Verify: http://localhost:8000/api/health

---

## Step 3 — Start the frontend

```bash
cd "App/frontend"
npm install
npm run dev
```

Open: http://localhost:5173

---

## Architecture

```
frontend (Vite + React + MUI)  :5173
    │  /api/* proxy
    ▼
backend (FastAPI)               :8000
    │  localhost:5433
    ▼
SSH tunnel
    │  EC2 localhost:5432
    ▼
PostgreSQL (EC2 98.84.126.189)
  ├── greek_author_styles    (142,935 articles)
  └── english_author_styles  ( 89,723 articles)
```
