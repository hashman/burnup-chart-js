"""Project endpoints."""

import sqlite3
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from db import get_connection
from models import (
    LogPayload,
    ProjectCreate,
    ProjectOut,
    ProjectPayload,
    ProjectUpdate,
    TaskPayload,
)
from permissions import require_member_or_admin

router = APIRouter(prefix="/api", tags=["projects"])


def normalize_text(value: Optional[str]) -> str:
    return value or ""


def row_to_log(row: sqlite3.Row) -> LogPayload:
    return {"id": row["id"], "date": row["date"], "content": row["content"]}


def row_to_task(row: sqlite3.Row, logs: List[LogPayload]) -> TaskPayload:
    return {
        "id": row["id"],
        "name": row["name"],
        "points": row["points"],
        "people": normalize_text(row["people"]),
        "addedDate": normalize_text(row["added_date"]),
        "expectedStart": normalize_text(row["expected_start"]),
        "expectedEnd": normalize_text(row["expected_end"]),
        "actualStart": normalize_text(row["actual_start"]),
        "actualEnd": normalize_text(row["actual_end"]),
        "showLabel": bool(row["show_label"]),
        "progress": row["progress"],
        "logs": logs,
    }


def fetch_project(
    conn: sqlite3.Connection, project_id: str
) -> Optional[ProjectPayload]:
    project_row = conn.execute(
        "SELECT id, name FROM projects WHERE id = ?", (project_id,)
    ).fetchone()
    if not project_row:
        return None

    task_rows = conn.execute(
        "SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at", (project_id,)
    ).fetchall()

    task_ids = [row["id"] for row in task_rows]
    logs_by_task: Dict[str, List[LogPayload]] = {task_id: [] for task_id in task_ids}
    if task_ids:
        placeholders = ",".join("?" for _ in task_ids)
        log_rows = conn.execute(
            f"SELECT * FROM logs WHERE task_id IN ({placeholders}) ORDER BY created_at",
            task_ids,
        ).fetchall()
        for row in log_rows:
            logs_by_task.setdefault(row["task_id"], []).append(row_to_log(row))

    tasks = [row_to_task(row, logs_by_task.get(row["id"], [])) for row in task_rows]

    return {"id": project_row["id"], "name": project_row["name"], "tasks": tasks}


def utc_now() -> str:
    from datetime import datetime

    return datetime.utcnow().isoformat()


@router.get("/projects", response_model=List[ProjectOut])
def list_projects(
    _current_user: dict = Depends(get_current_user),
) -> List[ProjectPayload]:
    with get_connection() as conn:
        project_rows = conn.execute(
            "SELECT id, name FROM projects ORDER BY created_at"
        ).fetchall()
        task_rows = conn.execute("SELECT * FROM tasks ORDER BY created_at").fetchall()
        log_rows = conn.execute("SELECT * FROM logs ORDER BY created_at").fetchall()

    logs_by_task: Dict[str, List[LogPayload]] = {}
    for row in log_rows:
        logs_by_task.setdefault(row["task_id"], []).append(row_to_log(row))

    tasks_by_project: Dict[str, List[TaskPayload]] = {}
    for row in task_rows:
        task = row_to_task(row, logs_by_task.get(row["id"], []))
        tasks_by_project.setdefault(row["project_id"], []).append(task)

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "tasks": tasks_by_project.get(row["id"], []),
        }
        for row in project_rows
    ]


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    _current_user: dict = Depends(get_current_user),
) -> ProjectPayload:
    with get_connection() as conn:
        project = fetch_project(conn, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post(
    "/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED
)
def create_project(
    payload: ProjectCreate,
    current_user: dict = Depends(require_member_or_admin),
) -> ProjectPayload:
    project_id = payload.id or f"proj_{uuid4().hex}"
    now = utc_now()

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Project id already exists")

        conn.execute(
            "INSERT INTO projects (id, name, created_at, created_by) VALUES (?, ?, ?, ?)",
            (project_id, payload.name, now, current_user["id"]),
        )
        conn.commit()
        project = fetch_project(conn, project_id)

    return project


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    _current_user: dict = Depends(require_member_or_admin),
) -> ProjectPayload:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Project not found")

        if payload.name is not None:
            conn.execute(
                "UPDATE projects SET name = ? WHERE id = ?", (payload.name, project_id)
            )
            conn.commit()

        project = fetch_project(conn, project_id)

    return project


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    _current_user: dict = Depends(require_member_or_admin),
) -> None:
    with get_connection() as conn:
        result = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return None
