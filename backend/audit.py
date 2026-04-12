"""Audit log helper – records who did what and when."""

import json
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4


def record_audit(
    conn: sqlite3.Connection,
    *,
    user: dict,
    action: str,
    entity_type: str,
    entity_id: str,
    entity_label: str = "",
    changes: dict | None = None,
) -> None:
    """Insert an audit log entry within the caller's transaction.

    Must be called *before* ``conn.commit()`` so the audit row lives in
    the same transaction as the data change it describes.
    """
    audit_id = f"audit_{uuid4().hex}"
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO audit_logs "
        "(id, user_id, user_display, action, entity_type, entity_id, entity_label, changes, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            audit_id,
            user.get("id"),
            user.get("username", user.get("display_name", "")),
            action,
            entity_type,
            entity_id,
            entity_label,
            json.dumps(changes, ensure_ascii=False) if changes else None,
            now,
        ),
    )
