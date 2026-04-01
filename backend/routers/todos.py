"""Todo and Todo Comment endpoints."""

import json as _json
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from db import get_connection
from models import (
    TodoCommentCreate,
    TodoCommentOut,
    TodoCommentUpdate,
    TodoCreate,
    TodoOut,
    TodoUpdate,
)
from permissions import require_member_or_admin

router = APIRouter(prefix="/api", tags=["todos"])


def normalize_text(value: Optional[str]) -> str:
    return value or ""


def row_to_todo_comment(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "todoId": row["todo_id"],
        "content": row["content"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def row_to_todo(
    row: sqlite3.Row, comments: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "status": row["status"],
        "priority": row["priority"],
        "dueDate": normalize_text(row["due_date"]) or None,
        "assignee": normalize_text(row["assignee"]) or None,
        "tags": _json.loads(row["tags"]) if row["tags"] else [],
        "note": normalize_text(row["note"]) or None,
        "linkedTaskId": normalize_text(row["linked_task_id"]) or None,
        "createdAt": row["created_at"],
        "sortOrder": row["sort_order"],
        "comments": comments or [],
    }


def _fetch_todo_comments(
    conn: sqlite3.Connection, todo_ids: List[str]
) -> Dict[str, List[Dict[str, Any]]]:
    if not todo_ids:
        return {}
    placeholders = ",".join("?" * len(todo_ids))
    rows = conn.execute(
        f"SELECT * FROM todo_comments WHERE todo_id IN ({placeholders}) ORDER BY created_at",
        todo_ids,
    ).fetchall()
    result: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        result.setdefault(row["todo_id"], []).append(row_to_todo_comment(row))
    return result


def utc_now() -> str:
    return datetime.utcnow().isoformat()


@router.get("/todos", response_model=List[TodoOut])
def list_todos(
    _current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM todos ORDER BY sort_order, created_at"
        ).fetchall()
        todo_ids = [r["id"] for r in rows]
        comments_map = _fetch_todo_comments(conn, todo_ids)
    return [row_to_todo(row, comments_map.get(row["id"], [])) for row in rows]


@router.post("/todos", response_model=TodoOut, status_code=status.HTTP_201_CREATED)
def create_todo(
    payload: TodoCreate,
    _current_user: dict = Depends(require_member_or_admin),
) -> Dict[str, Any]:
    todo_id = payload.id or f"todo_{uuid4().hex}"
    now = utc_now()

    with get_connection() as conn:
        if payload.status:
            valid = conn.execute(
                "SELECT 1 FROM statuses WHERE id = ?", (payload.status,)
            ).fetchone()
            if not valid:
                raise HTTPException(status_code=400, detail="Invalid status id")
            resolved_status = payload.status
        else:
            start_row = conn.execute(
                "SELECT id FROM statuses WHERE is_default_start = 1"
            ).fetchone()
            resolved_status = start_row["id"]

        if payload.linkedTaskId:
            task_row = conn.execute(
                "SELECT 1 FROM tasks WHERE id = ?", (payload.linkedTaskId,)
            ).fetchone()
            if not task_row:
                raise HTTPException(status_code=404, detail="Linked task not found")

        conn.execute(
            """INSERT INTO todos (id, title, status, priority, due_date, assignee,
               tags, note, linked_task_id, created_at, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                todo_id,
                payload.title,
                resolved_status,
                payload.priority,
                payload.dueDate or "",
                payload.assignee or "",
                _json.dumps(payload.tags),
                payload.note or "",
                payload.linkedTaskId or None,
                now,
                0,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    return row_to_todo(row, [])


@router.patch("/todos/{todo_id}", response_model=TodoOut)
def update_todo(
    todo_id: str,
    payload: TodoUpdate,
    _current_user: dict = Depends(require_member_or_admin),
) -> Dict[str, Any]:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM todos WHERE id = ?", (todo_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Todo not found")

        fields: List[str] = []
        values: List[Any] = []

        if payload.title is not None:
            fields.append("title = ?")
            values.append(payload.title)
        if payload.status is not None:
            valid = conn.execute(
                "SELECT 1 FROM statuses WHERE id = ?", (payload.status,)
            ).fetchone()
            if not valid:
                raise HTTPException(status_code=400, detail="Invalid status id")
            fields.append("status = ?")
            values.append(payload.status)
        if payload.priority is not None:
            fields.append("priority = ?")
            values.append(payload.priority)
        if payload.dueDate is not None:
            fields.append("due_date = ?")
            values.append(payload.dueDate)
        if payload.assignee is not None:
            fields.append("assignee = ?")
            values.append(payload.assignee)
        if payload.tags is not None:
            fields.append("tags = ?")
            values.append(_json.dumps(payload.tags))
        if payload.note is not None:
            fields.append("note = ?")
            values.append(payload.note)
        if payload.linkedTaskId is not None:
            fields.append("linked_task_id = ?")
            values.append(payload.linkedTaskId)
        if payload.sortOrder is not None:
            fields.append("sort_order = ?")
            values.append(payload.sortOrder)

        if fields:
            values.append(todo_id)
            conn.execute(f"UPDATE todos SET {', '.join(fields)} WHERE id = ?", values)
            conn.commit()

        row = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
        comments = conn.execute(
            "SELECT * FROM todo_comments WHERE todo_id = ? ORDER BY created_at",
            (todo_id,),
        ).fetchall()
    return row_to_todo(row, [row_to_todo_comment(c) for c in comments])


@router.delete("/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: str,
    _current_user: dict = Depends(require_member_or_admin),
) -> None:
    with get_connection() as conn:
        result = conn.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Todo not found")
    return None


@router.get("/tasks/{task_id}/todos", response_model=List[TodoOut])
def list_task_todos(
    task_id: str,
    _current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM todos WHERE linked_task_id = ? ORDER BY sort_order, created_at",
            (task_id,),
        ).fetchall()
        todo_ids = [r["id"] for r in rows]
        comments_map = _fetch_todo_comments(conn, todo_ids)
    return [row_to_todo(row, comments_map.get(row["id"], [])) for row in rows]


# ---------------------------------------------------------------------------
# Todo Comment CRUD endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/todos/{todo_id}/comments",
    response_model=TodoCommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_todo_comment(
    todo_id: str,
    payload: TodoCommentCreate,
    _current_user: dict = Depends(require_member_or_admin),
) -> Dict[str, Any]:
    comment_id = f"tc_{uuid4().hex}"
    now = utc_now()
    with get_connection() as conn:
        todo_row = conn.execute(
            "SELECT 1 FROM todos WHERE id = ?", (todo_id,)
        ).fetchone()
        if not todo_row:
            raise HTTPException(status_code=404, detail="Todo not found")
        conn.execute(
            "INSERT INTO todo_comments (id, todo_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (comment_id, todo_id, payload.content, now, now),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM todo_comments WHERE id = ?", (comment_id,)
        ).fetchone()
    return row_to_todo_comment(row)


@router.patch("/todo-comments/{comment_id}", response_model=TodoCommentOut)
def update_todo_comment(
    comment_id: str,
    payload: TodoCommentUpdate,
    _current_user: dict = Depends(require_member_or_admin),
) -> Dict[str, Any]:
    now = utc_now()
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM todo_comments WHERE id = ?", (comment_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Comment not found")
        conn.execute(
            "UPDATE todo_comments SET content = ?, updated_at = ? WHERE id = ?",
            (payload.content, now, comment_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM todo_comments WHERE id = ?", (comment_id,)
        ).fetchone()
    return row_to_todo_comment(row)


@router.delete("/todo-comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo_comment(
    comment_id: str,
    _current_user: dict = Depends(require_member_or_admin),
) -> None:
    with get_connection() as conn:
        result = conn.execute("DELETE FROM todo_comments WHERE id = ?", (comment_id,))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
