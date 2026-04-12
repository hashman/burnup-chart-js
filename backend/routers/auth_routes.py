"""Authentication endpoints."""

from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    revoke_refresh_token,
    verify_password,
    verify_refresh_token,
)
from audit import record_audit
from db import get_connection
from models import (
    RefreshRequest,
    TokenResponse,
    UserAdminUpdate,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
)
from permissions import require_admin

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _row_to_user_out(row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "username": row["username"],
        "displayName": row["display_name"],
        "email": row["email"],
        "role": row["role"],
        "isActive": bool(row["is_active"]),
    }


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin) -> Dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (payload.username,)
        ).fetchone()

    if not row or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="帳號或密碼錯誤",
        )

    if not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="帳號已停用",
        )

    access_token = create_access_token(row["id"], row["role"])
    raw_refresh, _ = create_refresh_token(row["id"])

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "user": _row_to_user_out(row),
    }


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest) -> Dict[str, Any]:
    token_info = verify_refresh_token(payload.refresh_token)
    if not token_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效或已過期的 refresh token",
        )

    # Revoke old token and issue new ones (rotation)
    revoke_refresh_token(token_info["token_id"])

    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (token_info["user_id"],)
        ).fetchone()

    if not row or not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="帳號不存在或已停用",
        )

    access_token = create_access_token(row["id"], row["role"])
    raw_refresh, _ = create_refresh_token(row["id"])

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "user": _row_to_user_out(row),
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: RefreshRequest,
    _current_user: dict = Depends(get_current_user),
) -> None:
    token_info = verify_refresh_token(payload.refresh_token)
    if token_info:
        revoke_refresh_token(token_info["token_id"])
    return None


@router.get("/me", response_model=UserOut)
def get_me(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "displayName": current_user["display_name"],
        "email": current_user["email"],
        "role": current_user["role"],
        "isActive": True,
    }


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    fields: List[str] = []
    values: List[Any] = []
    now = datetime.now(timezone.utc).isoformat()

    if payload.display_name is not None:
        fields.append("display_name = ?")
        values.append(payload.display_name)
    if payload.email is not None:
        fields.append("email = ?")
        values.append(payload.email)
    if payload.password is not None:
        fields.append("password_hash = ?")
        values.append(hash_password(payload.password))

    if fields:
        fields.append("updated_at = ?")
        values.append(now)
        values.append(current_user["id"])
        with get_connection() as conn:
            conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
            changes = {}
            if (
                payload.display_name is not None
                and payload.display_name != current_user["display_name"]
            ):
                changes["displayName"] = {
                    "old": current_user["display_name"],
                    "new": payload.display_name,
                }
            if payload.email is not None and payload.email != current_user["email"]:
                changes["email"] = {"old": current_user["email"], "new": payload.email}
            if payload.password is not None:
                changes["password"] = {"old": "[redacted]", "new": "[redacted]"}
            if changes:
                record_audit(
                    conn,
                    user=current_user,
                    action="update",
                    entity_type="user",
                    entity_id=current_user["id"],
                    entity_label=current_user["username"],
                    changes=changes,
                )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (current_user["id"],)
            ).fetchone()
        return _row_to_user_out(row)

    # No changes
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "displayName": current_user["display_name"],
        "email": current_user["email"],
        "role": current_user["role"],
        "isActive": True,
    }


# ---------------------------------------------------------------------------
# Admin: User management
# ---------------------------------------------------------------------------


@router.get("/users", response_model=List[UserOut])
def list_users(
    _current_user: dict = Depends(require_admin),
) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY created_at").fetchall()
    return [_row_to_user_out(row) for row in rows]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: dict = Depends(require_admin),
) -> Dict[str, Any]:
    user_id = f"user_{uuid4().hex}"
    now = datetime.now(timezone.utc).isoformat()

    if payload.role not in ("admin", "member", "viewer"):
        raise HTTPException(status_code=400, detail="無效的角色")

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM users WHERE username = ?", (payload.username,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="帳號已存在")

        conn.execute(
            "INSERT INTO users (id, username, display_name, email, password_hash, role, is_active, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
            (
                user_id,
                payload.username,
                payload.display_name,
                payload.email,
                hash_password(payload.password),
                payload.role,
                now,
                now,
            ),
        )
        record_audit(
            conn,
            user=current_user,
            action="create",
            entity_type="user",
            entity_id=user_id,
            entity_label=payload.username,
            changes={
                "username": {"new": payload.username},
                "displayName": {"new": payload.display_name},
                "role": {"new": payload.role},
            },
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    return _row_to_user_out(row)


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UserAdminUpdate,
    current_user: dict = Depends(require_admin),
) -> Dict[str, Any]:
    fields: List[str] = []
    values: List[Any] = []
    now = datetime.now(timezone.utc).isoformat()

    if payload.role is not None:
        if payload.role not in ("admin", "member", "viewer"):
            raise HTTPException(status_code=400, detail="無效的角色")
        fields.append("role = ?")
        values.append(payload.role)
    if payload.is_active is not None:
        fields.append("is_active = ?")
        values.append(1 if payload.is_active else 0)

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="使用者不存在")

        if fields:
            fields.append("updated_at = ?")
            values.append(now)
            values.append(user_id)
            conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
            changes = {}
            if payload.role is not None and payload.role != existing["role"]:
                changes["role"] = {"old": existing["role"], "new": payload.role}
            if payload.is_active is not None and payload.is_active != bool(
                existing["is_active"]
            ):
                changes["isActive"] = {
                    "old": bool(existing["is_active"]),
                    "new": payload.is_active,
                }
            if changes:
                record_audit(
                    conn,
                    user=current_user,
                    action="update",
                    entity_type="user",
                    entity_id=user_id,
                    entity_label=existing["username"],
                    changes=changes,
                )
            conn.commit()

        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    return _row_to_user_out(row)


# ---------------------------------------------------------------------------
# Bootstrap: first user registration (no auth required)
# ---------------------------------------------------------------------------


@router.post("/bootstrap", response_model=TokenResponse)
def bootstrap(payload: UserLogin) -> Dict[str, Any]:
    """Register the first admin user. Only works when no users exist."""
    with get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if count > 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="系統已初始化，請聯繫管理員建立帳號",
            )

        user_id = f"user_{uuid4().hex}"
        now = datetime.now(timezone.utc).isoformat()

        if len(payload.username) < 3:
            raise HTTPException(status_code=400, detail="帳號至少需要 3 個字元")
        if len(payload.password) < 8:
            raise HTTPException(status_code=400, detail="密碼至少需要 8 個字元")

        conn.execute(
            "INSERT INTO users (id, username, display_name, email, password_hash, role, is_active, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, 'admin', 1, ?, ?)",
            (
                user_id,
                payload.username,
                payload.username,  # display_name defaults to username
                None,
                hash_password(payload.password),
                now,
                now,
            ),
        )

        # Assign this admin as created_by for all existing projects
        project_ids = [
            r["id"] for r in conn.execute("SELECT id FROM projects").fetchall()
        ]
        for pid in project_ids:
            conn.execute(
                "UPDATE projects SET created_by = ? WHERE id = ?", (user_id, pid)
            )

        conn.commit()

        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    access_token = create_access_token(user_id, "admin")
    raw_refresh, _ = create_refresh_token(user_id)

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "user": _row_to_user_out(row),
    }


@router.get("/status")
def auth_status() -> Dict[str, Any]:
    """Check if the system has been initialized (has users)."""
    with get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    return {"initialized": count > 0}
