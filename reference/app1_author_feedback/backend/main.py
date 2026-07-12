from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from database import init_all_tables
from services.auth_service import seed_users
from routers import exploration, auth, generation, evaluation

# ── Startup: initialise DB tables and seed credentials ───────────────────────
init_all_tables()
seed_users()

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Editorial Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(exploration.router, prefix="/api")
app.include_router(auth.router,        prefix="/api")
app.include_router(generation.router,  prefix="/api")
app.include_router(evaluation.router,  prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Serve built React frontend ────────────────────────────────────────────────
DIST = Path(__file__).parent.parent / "frontend" / "dist"

if DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        return FileResponse(str(DIST / "index.html"))
