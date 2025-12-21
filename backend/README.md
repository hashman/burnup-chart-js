# Backend (FastAPI + SQLite)

This backend stores burnup projects, tasks, and logs in SQLite.

## Requirements
- Python 3.12

## Setup
```bash
poetry env use 3.12
poetry install
```

## Run
```bash
poetry run uvicorn main:app --reload --port 8000
```

## Tests
```bash
poetry run pytest
```

## Environment
- `BURNUP_DB_PATH` (optional): path to the SQLite file.
- `BURNUP_CORS_ORIGINS` (optional): comma-separated list of allowed origins.

## Endpoints
- `GET /api/health`
- `GET /api/projects`
- `GET /api/projects/{project_id}`
- `POST /api/projects`
- `PATCH /api/projects/{project_id}`
- `DELETE /api/projects/{project_id}`
- `POST /api/projects/{project_id}/tasks`
- `PATCH /api/tasks/{task_id}`
- `DELETE /api/tasks/{task_id}`
- `POST /api/tasks/{task_id}/logs`
- `DELETE /api/logs/{log_id}`
