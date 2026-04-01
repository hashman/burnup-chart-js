"""Authentication and JWT utilities."""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from db import get_connection

JWT_SECRET = os.environ.get("BURNUP_JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.environ.get("BURNUP_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)
REFRESH_TOKEN_EXPIRE_DAYS = int(
    os.environ.get("BURNUP_REFRESH_TOKEN_EXPIRE_DAYS", "7")
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> tuple[str, str]:
    """Create a refresh token. Returns (raw_token, token_id)."""
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    token_id = f"rt_{secrets.token_hex(16)}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as conn:
        conn.execute(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked) "
            "VALUES (?, ?, ?, ?, ?, 0)",
            (token_id, user_id, token_hash, expires_at.isoformat(), now),
        )
        conn.commit()

    return raw_token, token_id


def verify_refresh_token(raw_token: str) -> Optional[dict]:
    """Verify a refresh token. Returns user info or None."""
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as conn:
        row = conn.execute(
            "SELECT rt.id, rt.user_id, rt.revoked, rt.expires_at, u.role, u.is_active "
            "FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id "
            "WHERE rt.token_hash = ?",
            (token_hash,),
        ).fetchone()

    if not row:
        return None
    if row["revoked"]:
        # Potential token theft — revoke all tokens for this user
        with get_connection() as conn:
            conn.execute(
                "UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?",
                (row["user_id"],),
            )
            conn.commit()
        return None
    if row["expires_at"] < now:
        return None
    if not row["is_active"]:
        return None

    return {
        "token_id": row["id"],
        "user_id": row["user_id"],
        "role": row["role"],
    }


def revoke_refresh_token(token_id: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE refresh_tokens SET revoked = 1 WHERE id = ?", (token_id,)
        )
        conn.commit()


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """FastAPI dependency: decode JWT and return user info from DB."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="無效的認證憑證",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, display_name, email, role, is_active FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

    if not row:
        raise credentials_exception
    if not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="帳號已停用"
        )

    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "email": row["email"],
        "role": row["role"],
    }


def require_role(*roles: str):
    """Return a FastAPI dependency that checks if the user has one of the given roles."""

    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="權限不足"
            )
        return current_user

    return checker


def cleanup_expired_tokens() -> None:
    """Remove expired and revoked refresh tokens."""
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            "DELETE FROM refresh_tokens WHERE revoked = 1 OR expires_at < ?", (now,)
        )
        conn.commit()
