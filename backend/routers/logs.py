"""Log endpoints."""

import sqlite3
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from db import get_connection
from models import LogCreate, LogOut, LogPayload
from permissions import require_member_or_admin

router = APIRouter(prefix="/api", tags=["logs"])


def row_to_log(row: sqlite3.Row) -> LogPayload:
    return {"id": row["id"], "date": row["date"], "content": row["content"]}


def utc_now() -> str:
    return datetime.utcnow().isoformat()


@router.post(
    "/tasks/{task_id}/logs",
    response_model=LogOut,
    status_code=status.HTTP_201_CREATED,
)
def create_log(
    task_id: str,
    payload: LogCreate,
    _current_user: dict = Depends(require_member_or_admin),
) -> LogPayload:
    log_id = payload.id or f"log_{uuid4().hex}"
    now = utc_now()

    with get_connection() as conn:
        task_row = conn.execute(
            "SELECT 1 FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        if not task_row:
            raise HTTPException(status_code=404, detail="Task not found")

        existing = conn.execute("SELECT 1 FROM logs WHERE id = ?", (log_id,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Log id already exists")

        conn.execute(
            "INSERT INTO logs (id, task_id, date, content, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (log_id, task_id, payload.date, payload.content, now),
        )
        conn.commit()

        log_row = conn.execute("SELECT * FROM logs WHERE id = ?", (log_id,)).fetchone()

    return row_to_log(log_row)


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log(
    log_id: str,
    _current_user: dict = Depends(require_member_or_admin),
) -> None:
    with get_connection() as conn:
        result = conn.execute("DELETE FROM logs WHERE id = ?", (log_id,))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    return None
