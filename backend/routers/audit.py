"""Audit log query endpoints."""

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from auth import get_current_user
from db import get_connection
from models import AuditLogOut, AuditLogPage
from permissions import require_admin

router = APIRouter(prefix="/api", tags=["audit"])


def _row_to_audit(row) -> Dict[str, Any]:
    changes_raw = row["changes"]
    changes = json.loads(changes_raw) if changes_raw else None
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "userDisplay": row["user_display"],
        "action": row["action"],
        "entityType": row["entity_type"],
        "entityId": row["entity_id"],
        "entityLabel": row["entity_label"],
        "changes": changes,
        "createdAt": row["created_at"],
    }


@router.get("/audit-logs", response_model=AuditLogPage)
def list_audit_logs(
    _current_user: dict = Depends(require_admin),
    userId: Optional[str] = Query(default=None),
    entityType: Optional[str] = Query(default=None),
    entityId: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    startDate: Optional[str] = Query(default=None),
    endDate: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=50, ge=1, le=200),
) -> Dict[str, Any]:
    conditions: List[str] = []
    params: List[Any] = []

    if userId:
        conditions.append("user_id = ?")
        params.append(userId)
    if entityType:
        conditions.append("entity_type = ?")
        params.append(entityType)
    if entityId:
        conditions.append("entity_id = ?")
        params.append(entityId)
    if action:
        conditions.append("action = ?")
        params.append(action)
    if startDate:
        conditions.append("created_at >= ?")
        params.append(startDate)
    if endDate:
        conditions.append("created_at <= ?")
        params.append(endDate)

    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""

    with get_connection() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM audit_logs{where}", params
        ).fetchone()[0]

        offset = (page - 1) * pageSize
        rows = conn.execute(
            f"SELECT * FROM audit_logs{where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [pageSize, offset],
        ).fetchall()

    return {
        "items": [_row_to_audit(row) for row in rows],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }
