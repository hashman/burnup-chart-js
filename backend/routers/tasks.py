"""Task endpoints."""

import sqlite3
from typing import Any, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from db import get_connection
from models import LogPayload, TaskCreate, TaskOut, TaskPayload, TaskUpdate
from permissions import require_member_or_admin

router = APIRouter(prefix="/api", tags=["tasks"])


def normalize_text(value: Optional[str]) -> str:
    return value or ""


def row_to_log(row: sqlite3.Row) -> LogPayload:
    author = None
    try:
        author = row["author_name"]
    except (IndexError, KeyError):
        author = None
    return {
        "id": row["id"],
        "date": row["date"],
        "content": row["content"],
        "author": author,
    }


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


def fetch_task(conn: sqlite3.Connection, task_id: str) -> Optional[TaskPayload]:
    task_row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task_row:
        return None
    log_rows = conn.execute(
        """SELECT l.*, COALESCE(u.display_name, u.username) AS author_name
           FROM logs l
           LEFT JOIN users u ON u.id = l.author_id
           WHERE l.task_id = ?
           ORDER BY l.created_at""",
        (task_id,),
    ).fetchall()
    logs = [row_to_log(row) for row in log_rows]
    return row_to_task(task_row, logs)


def utc_now() -> str:
    from datetime import datetime

    return datetime.utcnow().isoformat()


@router.post(
    "/projects/{project_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    project_id: str,
    payload: TaskCreate,
    _current_user: dict = Depends(require_member_or_admin),
) -> TaskPayload:
    task_id = payload.id or f"task_{uuid4().hex}"
    now = utc_now()

    with get_connection() as conn:
        project_row = conn.execute(
            "SELECT 1 FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        if not project_row:
            raise HTTPException(status_code=404, detail="Project not found")

        existing = conn.execute(
            "SELECT 1 FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Task id already exists")

        conn.execute(
            """
            INSERT INTO tasks (
                id, project_id, name, points, people, added_date, expected_start,
                expected_end, actual_start, actual_end, show_label, progress, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                task_id,
                project_id,
                payload.name,
                payload.points,
                payload.people,
                payload.addedDate,
                payload.expectedStart,
                payload.expectedEnd,
                payload.actualStart,
                payload.actualEnd,
                1 if payload.showLabel else 0,
                payload.progress,
                now,
            ),
        )
        conn.commit()
        task = fetch_task(conn, task_id)

    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    _current_user: dict = Depends(require_member_or_admin),
) -> TaskPayload:
    fields: List[str] = []
    values: List[Any] = []

    if payload.name is not None:
        fields.append("name = ?")
        values.append(payload.name)
    if payload.points is not None:
        fields.append("points = ?")
        values.append(payload.points)
    if payload.people is not None:
        fields.append("people = ?")
        values.append(payload.people)
    if payload.addedDate is not None:
        fields.append("added_date = ?")
        values.append(payload.addedDate)
    if payload.expectedStart is not None:
        fields.append("expected_start = ?")
        values.append(payload.expectedStart)
    if payload.expectedEnd is not None:
        fields.append("expected_end = ?")
        values.append(payload.expectedEnd)
    if payload.actualStart is not None:
        fields.append("actual_start = ?")
        values.append(payload.actualStart)
    if payload.actualEnd is not None:
        fields.append("actual_end = ?")
        values.append(payload.actualEnd)
    if payload.showLabel is not None:
        fields.append("show_label = ?")
        values.append(1 if payload.showLabel else 0)
    if payload.progress is not None:
        fields.append("progress = ?")
        values.append(payload.progress)

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Task not found")

        if fields:
            values.append(task_id)
            conn.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", values)
            conn.commit()

        task = fetch_task(conn, task_id)

    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    _current_user: dict = Depends(require_member_or_admin),
) -> None:
    with get_connection() as conn:
        result = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return None
