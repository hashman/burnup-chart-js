"""Sub-project and sub-project event endpoints."""

import json as _json
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from db import get_connection
from models import (
    SubProjectCreate,
    SubProjectEventCreate,
    SubProjectEventOut,
    SubProjectEventUpdate,
    SubProjectOut,
    SubProjectUpdate,
)
from permissions import require_member_or_admin

router = APIRouter(prefix="/api", tags=["sub_projects"])


def utc_now() -> str:
    return datetime.utcnow().isoformat()


def _active_waiting_counts(
    conn: sqlite3.Connection, sub_project_ids: List[str]
) -> Dict[str, int]:
    if not sub_project_ids:
        return {}
    placeholders = ",".join("?" * len(sub_project_ids))
    rows = conn.execute(
        f"""SELECT parent_id, COUNT(*) AS n FROM sub_project_events
            WHERE parent_type = 'sub_project'
              AND type = 'waiting'
              AND resolved_at IS NULL
              AND parent_id IN ({placeholders})
            GROUP BY parent_id""",
        sub_project_ids,
    ).fetchall()
    return {row["parent_id"]: row["n"] for row in rows}


def _linked_task_ids(
    conn: sqlite3.Connection, sub_project_ids: List[str]
) -> Dict[str, List[str]]:
    if not sub_project_ids:
        return {}
    placeholders = ",".join("?" * len(sub_project_ids))
    rows = conn.execute(
        f"SELECT sub_project_id, task_id FROM sub_project_tasks "
        f"WHERE sub_project_id IN ({placeholders})",
        sub_project_ids,
    ).fetchall()
    result: Dict[str, List[str]] = {sid: [] for sid in sub_project_ids}
    for row in rows:
        result.setdefault(row["sub_project_id"], []).append(row["task_id"])
    return result


def row_to_sub_project(
    row: sqlite3.Row,
    linked_task_ids: Optional[List[str]] = None,
    active_waiting_count: int = 0,
) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "burnupProjectId": row["burnup_project_id"],
        "name": row["name"],
        "description": row["description"] or None,
        "status": row["status"],
        "owner": row["owner"] or None,
        "dueDate": row["due_date"] or None,
        "priority": row["priority"],
        "tags": _json.loads(row["tags"]) if row["tags"] else [],
        "sortOrder": row["sort_order"],
        "linkedTaskIds": linked_task_ids or [],
        "activeWaitingCount": active_waiting_count,
        "createdAt": row["created_at"],
    }


def row_to_event(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "parentType": row["parent_type"],
        "parentId": row["parent_id"],
        "type": row["type"],
        "title": row["title"],
        "body": row["body"] or None,
        "waitingOn": row["waiting_on"] or None,
        "startedAt": row["started_at"],
        "resolvedAt": row["resolved_at"],
        "createdAt": row["created_at"],
    }


def _validate_task_ids(conn: sqlite3.Connection, task_ids: List[str]) -> None:
    if not task_ids:
        return
    placeholders = ",".join("?" * len(task_ids))
    rows = conn.execute(
        f"SELECT id FROM tasks WHERE id IN ({placeholders})", task_ids
    ).fetchall()
    found = {row["id"] for row in rows}
    missing = [tid for tid in task_ids if tid not in found]
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Unknown task ids: {', '.join(missing)}"
        )


def _replace_sub_project_tasks(
    conn: sqlite3.Connection, sub_project_id: str, task_ids: List[str]
) -> None:
    conn.execute(
        "DELETE FROM sub_project_tasks WHERE sub_project_id = ?", (sub_project_id,)
    )
    for tid in task_ids:
        conn.execute(
            "INSERT INTO sub_project_tasks (sub_project_id, task_id) VALUES (?, ?)",
            (sub_project_id, tid),
        )


# ---------------------------------------------------------------------------
# Sub-project CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/projects/{burnup_project_id}/sub-projects",
    response_model=List[SubProjectOut],
)
def list_sub_projects(
    burnup_project_id: str,
    _current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        project = conn.execute(
            "SELECT 1 FROM projects WHERE id = ?", (burnup_project_id,)
        ).fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        rows = conn.execute(
            "SELECT * FROM sub_projects WHERE burnup_project_id = ? "
            "ORDER BY sort_order, created_at",
            (burnup_project_id,),
        ).fetchall()
        ids = [row["id"] for row in rows]
        links = _linked_task_ids(conn, ids)
        waiting_counts = _active_waiting_counts(conn, ids)
    return [
        row_to_sub_project(
            row,
            links.get(row["id"], []),
            waiting_counts.get(row["id"], 0),
        )
        for row in rows
    ]


@router.get("/sub-projects", response_model=List[SubProjectOut])
def list_all_sub_projects(
    _current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM sub_projects ORDER BY sort_order, created_at"
        ).fetchall()
        ids = [row["id"] for row in rows]
        links = _linked_task_ids(conn, ids)
        waiting_counts = _active_waiting_counts(conn, ids)
    return [
        row_to_sub_project(
            row,
            links.get(row["id"], []),
            waiting_counts.get(row["id"], 0),
        )
        for row in rows
    ]


@router.post(
    "/projects/{burnup_project_id}/sub-projects",
    response_model=SubProjectOut,
    status_code=status.HTTP_201_CREATED,
)
def create_sub_project(
    burnup_project_id: str,
    payload: SubProjectCreate,
    current_user: dict = Depends(require_member_or_admin),
) -> Dict[str, Any]:
    sub_id = payload.id or f"sp_{uuid4().hex}"
    now = utc_now()
    with get_connection() as conn:
        project = conn.execute(
            "SELECT 1 FROM projects WHERE id = ?", (burnup_project_id,)
        ).fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        existing = conn.execute(
            "SELECT 1 FROM sub_projects WHERE id = ?", (sub_id,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Sub-project id already exists")
        _validate_task_ids(conn, payload.linkedTaskIds)

        conn.execute(
            """INSERT INTO sub_projects (
                id, burnup_project_id, name, description, status, owner,
                due_date, priority, tags, sort_order, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                sub_id,
                burnup_project_id,
                payload.name,
                payload.description,
                payload.status,
                payload.owner,
                payload.dueDate,
                payload.priority,
                _json.dumps(payload.tags),
                0,
                now,
                current_user["id"],
            ),
        )
        _replace_sub_project_tasks(conn, sub_id, payload.linkedTaskIds)
        conn.commit()

        row = conn.execute(
            "SELECT * FROM sub_projects WHERE id = ?", (sub_id,)
        ).fetchone()
    return row_to_sub_project(row, payload.linkedTaskIds, 0)


@router.patch("/sub-projects/{sub_project_id}", response_model=SubProjectOut)
def update_sub_project(
    sub_project_id: str,
    payload: SubProjectUpdate,
    _current_user: dict = Depends(require_member_or_admin),
) -> Dict[str, Any]:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM sub_projects WHERE id = ?", (sub_project_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Sub-project not found")

        fields: List[str] = []
        values: List[Any] = []

        if payload.name is not None:
            fields.append("name = ?")
            values.append(payload.name)
        if payload.description is not None:
            fields.append("description = ?")
            values.append(payload.description)
        if payload.status is not None:
            fields.append("status = ?")
            values.append(payload.status)
        if payload.owner is not None:
            fields.append("owner = ?")
            values.append(payload.owner)
        if payload.dueDate is not None:
            fields.append("due_date = ?")
            values.append(payload.dueDate)
        if payload.priority is not None:
            fields.append("priority = ?")
            values.append(payload.priority)
        if payload.tags is not None:
            fields.append("tags = ?")
            values.append(_json.dumps(payload.tags))
        if payload.sortOrder is not None:
            fields.append("sort_order = ?")
            values.append(payload.sortOrder)

        if fields:
            values.append(sub_project_id)
            conn.execute(
                f"UPDATE sub_projects SET {', '.join(fields)} WHERE id = ?", values
            )

        if payload.linkedTaskIds is not None:
            _validate_task_ids(conn, payload.linkedTaskIds)
            _replace_sub_project_tasks(conn, sub_project_id, payload.linkedTaskIds)

        conn.commit()

        row = conn.execute(
            "SELECT * FROM sub_projects WHERE id = ?", (sub_project_id,)
        ).fetchone()
        task_ids = [
            r["task_id"]
            for r in conn.execute(
                "SELECT task_id FROM sub_project_tasks WHERE sub_project_id = ?",
                (sub_project_id,),
            ).fetchall()
        ]
        waiting = _active_waiting_counts(conn, [sub_project_id]).get(sub_project_id, 0)
    return row_to_sub_project(row, task_ids, waiting)


@router.delete("/sub-projects/{sub_project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sub_project(
    sub_project_id: str,
    _current_user: dict = Depends(require_member_or_admin),
) -> None:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM sub_projects WHERE id = ?", (sub_project_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Sub-project not found")
        # Manually cascade: events (polymorphic, no FK), and clear todo.sub_project_id
        conn.execute(
            "DELETE FROM sub_project_events "
            "WHERE parent_type = 'sub_project' AND parent_id = ?",
            (sub_project_id,),
        )
        conn.execute(
            "UPDATE todos SET sub_project_id = NULL WHERE sub_project_id = ?",
            (sub_project_id,),
        )
        # sub_project_tasks rows are cleared via ON DELETE CASCADE
        conn.execute("DELETE FROM sub_projects WHERE id = ?", (sub_project_id,))
        conn.commit()
    return None


# ---------------------------------------------------------------------------
# Event CRUD (sub-project and todo parents)
# ---------------------------------------------------------------------------


def _validate_parent(
    conn: sqlite3.Connection, parent_type: str, parent_id: str
) -> None:
    if parent_type == "sub_project":
        row = conn.execute(
            "SELECT 1 FROM sub_projects WHERE id = ?", (parent_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Sub-project not found")
    elif parent_type == "todo":
        row = conn.execute("SELECT 1 FROM todos WHERE id = ?", (parent_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Todo not found")
    else:
        raise HTTPException(status_code=400, detail="Invalid parent_type")


def _create_event(
    conn: sqlite3.Connection,
    parent_type: str,
    parent_id: str,
    payload: SubProjectEventCreate,
    user_id: str,
) -> Dict[str, Any]:
    event_id = f"spe_{uuid4().hex}"
    now = utc_now()
    started = payload.startedAt or now
    conn.execute(
        """INSERT INTO sub_project_events (
            id, parent_type, parent_id, type, title, body, waiting_on,
            started_at, resolved_at, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)""",
        (
            event_id,
            parent_type,
            parent_id,
            payload.type,
            payload.title,
            payload.body,
            payload.waitingOn if payload.type == "waiting" else None,
            started,
            now,
            user_id,
        ),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM sub_project_events WHERE id = ?", (event_id,)
    ).fetchone()
    return row_to_event(row)


@router.get(
    "/sub-projects/{sub_project_id}/events",
    response_model=List[SubProjectEventOut],
)
def list_sub_project_events(
    sub_project_id: str,
    _current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        _validate_parent(conn, "sub_project", sub_project_id)
        rows = conn.execute(
            "SELECT * FROM sub_project_events "
            "WHERE parent_type = 'sub_project' AND parent_id = ? "
            "ORDER BY created_at DESC",
            (sub_project_id,),
        ).fetchall()
    return [row_to_event(row) for row in rows]


@router.post(
    "/sub-projects/{sub_project_id}/events",
    response_model=SubProjectEventOut,
    status_code=status.HTTP_201_CREATED,
)
def create_sub_project_event(
    sub_project_id: str,
    payload: SubProjectEventCreate,
    current_user: dict = Depends(require_member_or_admin),
) -> Dict[str, Any]:
    with get_connection() as conn:
        _validate_parent(conn, "sub_project", sub_project_id)
        return _create_event(
            conn, "sub_project", sub_project_id, payload, current_user["id"]
        )


@router.get("/todos/{todo_id}/events", response_model=List[SubProjectEventOut])
def list_todo_events(
    todo_id: str,
    _current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        _validate_parent(conn, "todo", todo_id)
        rows = conn.execute(
            "SELECT * FROM sub_project_events "
            "WHERE parent_type = 'todo' AND parent_id = ? "
            "ORDER BY created_at DESC",
            (todo_id,),
        ).fetchall()
    return [row_to_event(row) for row in rows]


@router.post(
    "/todos/{todo_id}/events",
    response_model=SubProjectEventOut,
    status_code=status.HTTP_201_CREATED,
)
def create_todo_event(
    todo_id: str,
    payload: SubProjectEventCreate,
    current_user: dict = Depends(require_member_or_admin),
) -> Dict[str, Any]:
    with get_connection() as conn:
        _validate_parent(conn, "todo", todo_id)
        return _create_event(conn, "todo", todo_id, payload, current_user["id"])


@router.patch("/events/{event_id}", response_model=SubProjectEventOut)
def update_event(
    event_id: str,
    payload: SubProjectEventUpdate,
    _current_user: dict = Depends(require_member_or_admin),
) -> Dict[str, Any]:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM sub_project_events WHERE id = ?", (event_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Event not found")

        fields: List[str] = []
        values: List[Any] = []
        if payload.title is not None:
            fields.append("title = ?")
            values.append(payload.title)
        if payload.body is not None:
            fields.append("body = ?")
            values.append(payload.body)
        if payload.waitingOn is not None:
            fields.append("waiting_on = ?")
            values.append(payload.waitingOn)
        if payload.resolvedAt is not None:
            fields.append("resolved_at = ?")
            values.append(payload.resolvedAt or None)

        if fields:
            values.append(event_id)
            conn.execute(
                f"UPDATE sub_project_events SET {', '.join(fields)} WHERE id = ?",
                values,
            )
            conn.commit()

        row = conn.execute(
            "SELECT * FROM sub_project_events WHERE id = ?", (event_id,)
        ).fetchone()
    return row_to_event(row)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    _current_user: dict = Depends(require_member_or_admin),
) -> None:
    with get_connection() as conn:
        result = conn.execute(
            "DELETE FROM sub_project_events WHERE id = ?", (event_id,)
        )
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return None
