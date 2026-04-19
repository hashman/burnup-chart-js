"""Unified activity feed.

Merges task logs, todo comments, and sub-project events for a given
burnup project into a single time-ordered list. Powers the Activity
rail on the new Burnup dashboard.
"""

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from auth import get_current_user
from db import get_connection

router = APIRouter(prefix="/api", tags=["activity"])


ActivityKind = Literal["log", "comment", "waiting", "decision", "note"]


class ActivityItem(BaseModel):
    id: str
    kind: ActivityKind
    who: Optional[str] = None
    when: str
    text: str
    context: Optional[str] = None
    waitingOn: Optional[str] = None


@router.get("/activity", response_model=List[ActivityItem])
def list_activity(
    project_id: str = Query(..., alias="project_id"),
    limit: int = Query(50, ge=1, le=200),
    _current_user: dict = Depends(get_current_user),
) -> List[ActivityItem]:
    """Return merged activity for a burnup project, newest first."""
    items: List[ActivityItem] = []

    with get_connection() as conn:
        # Task logs
        log_rows = conn.execute(
            """
            SELECT
                l.id            AS id,
                l.content       AS text,
                l.created_at    AS when_ts,
                t.name          AS context,
                COALESCE(u.display_name, u.username) AS who
            FROM logs l
            JOIN tasks t ON t.id = l.task_id
            LEFT JOIN users u ON u.id = l.author_id
            WHERE t.project_id = ?
            ORDER BY l.created_at DESC
            LIMIT ?
            """,
            (project_id, limit),
        ).fetchall()
        for r in log_rows:
            items.append(
                ActivityItem(
                    id=f"log:{r['id']}",
                    kind="log",
                    who=r["who"],
                    when=r["when_ts"],
                    text=r["text"],
                    context=r["context"],
                )
            )

        # Todo comments: todo must be linked either to a task in this project
        # OR to a sub-project under this burnup project.
        comment_rows = conn.execute(
            """
            SELECT
                c.id            AS id,
                c.content       AS text,
                c.created_at    AS when_ts,
                td.title        AS context,
                COALESCE(u.display_name, u.username) AS who
            FROM todo_comments c
            JOIN todos td       ON td.id = c.todo_id
            LEFT JOIN tasks t   ON t.id = td.linked_task_id
            LEFT JOIN sub_projects sp ON sp.id = td.sub_project_id
            LEFT JOIN users u   ON u.id = c.author_id
            WHERE t.project_id = ? OR sp.burnup_project_id = ?
            ORDER BY c.created_at DESC
            LIMIT ?
            """,
            (project_id, project_id, limit),
        ).fetchall()
        for r in comment_rows:
            items.append(
                ActivityItem(
                    id=f"comment:{r['id']}",
                    kind="comment",
                    who=r["who"],
                    when=r["when_ts"],
                    text=r["text"],
                    context=r["context"],
                )
            )

        # Sub-project events (parent_type = 'sub_project') for sub-projects
        # belonging to this burnup project. Also surface events attached to
        # todos that belong to the project.
        event_rows = conn.execute(
            """
            SELECT
                e.id            AS id,
                e.type          AS kind,
                e.title         AS title,
                e.body          AS body,
                e.waiting_on    AS waiting_on,
                e.started_at    AS when_ts,
                CASE
                    WHEN e.parent_type = 'sub_project' THEN sp_direct.name
                    WHEN e.parent_type = 'todo'        THEN td.title
                END AS context,
                COALESCE(u.display_name, u.username) AS who
            FROM sub_project_events e
            LEFT JOIN sub_projects sp_direct
                ON e.parent_type = 'sub_project' AND sp_direct.id = e.parent_id
            LEFT JOIN todos td
                ON e.parent_type = 'todo' AND td.id = e.parent_id
            LEFT JOIN tasks t_via_todo
                ON td.linked_task_id = t_via_todo.id
            LEFT JOIN sub_projects sp_via_todo
                ON td.sub_project_id = sp_via_todo.id
            LEFT JOIN users u ON u.id = e.created_by
            WHERE (e.parent_type = 'sub_project' AND sp_direct.burnup_project_id = ?)
               OR (e.parent_type = 'todo' AND (t_via_todo.project_id = ? OR sp_via_todo.burnup_project_id = ?))
            ORDER BY e.started_at DESC
            LIMIT ?
            """,
            (project_id, project_id, project_id, limit),
        ).fetchall()
        for r in event_rows:
            kind = r["kind"]
            if kind not in ("waiting", "decision", "note"):
                continue
            text_parts = []
            if r["title"]:
                text_parts.append(r["title"])
            if r["body"]:
                text_parts.append(r["body"])
            text = " · ".join(text_parts) if text_parts else ""
            items.append(
                ActivityItem(
                    id=f"event:{r['id']}",
                    kind=kind,
                    who=r["who"],
                    when=r["when_ts"],
                    text=text,
                    context=r["context"],
                    waitingOn=r["waiting_on"] if kind == "waiting" else None,
                )
            )

    # Global sort across all sources, newest first, then apply limit.
    items.sort(key=lambda it: it.when or "", reverse=True)
    return items[:limit]
