import os
from typing import Dict, List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import cleanup_expired_tokens
from db import init_db
from routers import auth_routes, logs, projects, statuses, tasks, todos

app = FastAPI(title="Burnup Chart API")


def parse_cors_origins() -> List[str]:
    raw = os.environ.get("BURNUP_CORS_ORIGINS", "")
    if raw.strip():
        return [item.strip() for item in raw.split(",") if item.strip()]
    return ["http://localhost:5173", "http://127.0.0.1:5173"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(logs.router)
app.include_router(statuses.router)
app.include_router(todos.router)


@app.on_event("startup")
def startup() -> None:
    init_db()
    cleanup_expired_tokens()


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
