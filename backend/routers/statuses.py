"""Status endpoints."""

import sqlite3
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from db import get_connection
from models import StatusCreate, StatusOut, StatusReorderItem, StatusUpdate
from permissions import require_admin

router = APIRouter(prefix="/api", tags=["statuses"])


def row_to_status(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "sortOrder": row["sort_order"],
        "isDefaultStart": bool(row["is_default_start"]),
        "isDefaultEnd": bool(row["is_default_end"]),
    }


@router.get("/statuses", response_model=List[StatusOut])
def list_statuses(
    _current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM statuses ORDER BY sort_order").fetchall()
    return [row_to_status(row) for row in rows]


@router.post(
    "/statuses",
    response_model=StatusOut,
    status_code=status.HTTP_201_CREATED,
)
def create_status(
    payload: StatusCreate,
    _current_user: dict = Depends(require_admin),
) -> Dict[str, Any]:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Status name must not be empty")

    status_id = payload.id or f"status_{uuid4().hex}"

    with get_connection() as conn:
        if payload.sort_order is not None:
            sort_order = payload.sort_order
        else:
            row = conn.execute(
                "SELECT MAX(sort_order) AS max_so FROM statuses"
            ).fetchone()
            max_so = row["max_so"] if row["max_so"] is not None else -1
            sort_order = max_so + 1

        conn.execute(
            "INSERT INTO statuses (id, name, sort_order, is_default_start, is_default_end) "
            "VALUES (?, ?, ?, 0, 0)",
            (status_id, name, sort_order),
        )
        conn.commit()

        new_row = conn.execute(
            "SELECT * FROM statuses WHERE id = ?", (status_id,)
        ).fetchone()

    return row_to_status(new_row)


@router.patch("/statuses/{status_id}", response_model=StatusOut)
def update_status(
    status_id: str,
    payload: StatusUpdate,
    _current_user: dict = Depends(require_admin),
) -> Dict[str, Any]:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT * FROM statuses WHERE id = ?", (status_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Status not found")

        if payload.name is not None:
            stripped = payload.name.strip()
            if not stripped:
                raise HTTPException(
                    status_code=400, detail="Status name must not be empty"
                )

        fields: List[str] = []
        values: List[Any] = []

        if payload.name is not None:
            fields.append("name = ?")
            values.append(payload.name.strip())
        if payload.sort_order is not None:
            fields.append("sort_order = ?")
            values.append(payload.sort_order)

        if payload.is_default_start is True:
            conn.execute("UPDATE statuses SET is_default_start = 0")
            fields.append("is_default_start = ?")
            values.append(1)
        elif payload.is_default_start is False:
            fields.append("is_default_start = ?")
            values.append(0)

        if payload.is_default_end is True:
            conn.execute("UPDATE statuses SET is_default_end = 0")
            fields.append("is_default_end = ?")
            values.append(1)
        elif payload.is_default_end is False:
            fields.append("is_default_end = ?")
            values.append(0)

        if fields:
            values.append(status_id)
            conn.execute(
                f"UPDATE statuses SET {', '.join(fields)} WHERE id = ?", values
            )
            conn.commit()

        row = conn.execute(
            "SELECT * FROM statuses WHERE id = ?", (status_id,)
        ).fetchone()

    return row_to_status(row)


@router.delete("/statuses/{status_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_status(
    status_id: str,
    migrate_to: Optional[str] = None,
    _current_user: dict = Depends(require_admin),
) -> None:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT * FROM statuses WHERE id = ?", (status_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Status not found")

        if existing["is_default_start"]:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the default start status",
            )
        if existing["is_default_end"]:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the default end status",
            )

        todo_count = conn.execute(
            "SELECT COUNT(*) FROM todos WHERE status = ?", (status_id,)
        ).fetchone()[0]

        if todo_count > 0:
            if not migrate_to:
                raise HTTPException(
                    status_code=400,
                    detail="Status has todos; provide migrate_to query param",
                )
            target = conn.execute(
                "SELECT 1 FROM statuses WHERE id = ?", (migrate_to,)
            ).fetchone()
            if not target:
                raise HTTPException(
                    status_code=400, detail="migrate_to status not found"
                )
            conn.execute(
                "UPDATE todos SET status = ? WHERE status = ?",
                (migrate_to, status_id),
            )

        conn.execute("DELETE FROM statuses WHERE id = ?", (status_id,))
        conn.commit()

    return None


@router.post("/statuses/reorder", response_model=List[StatusOut])
def reorder_statuses(
    items: List[StatusReorderItem],
    _current_user: dict = Depends(require_admin),
) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        for item in items:
            conn.execute(
                "UPDATE statuses SET sort_order = ? WHERE id = ?",
                (item.sortOrder, item.id),
            )
        conn.commit()
        rows = conn.execute("SELECT * FROM statuses ORDER BY sort_order").fetchall()
    return [row_to_status(row) for row in rows]
