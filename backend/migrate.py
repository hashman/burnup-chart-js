#!/usr/bin/env python3
"""Database migration script for burnup-chart.

Brings an existing database up to date with the current schema.
Safe to run multiple times — each migration is idempotent.

Usage:
    python migrate.py              # migrate default DB
    BURNUP_DB_PATH=/path/to.db python migrate.py  # migrate specific DB
"""

import sqlite3
from uuid import uuid4

from db import DB_PATH, get_connection

MIGRATIONS: list[tuple[str, callable]] = []


def migration(name: str):
    """Decorator to register a migration function."""

    def decorator(fn):
        MIGRATIONS.append((name, fn))
        return fn

    return decorator


# ── Migrations (in order) ─────────────────────────────────────────────


@migration("add tasks.progress column")
def add_progress_column(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(tasks)").fetchall()}
    if "progress" not in columns:
        conn.execute("ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0")


@migration("create statuses table")
def create_statuses_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS statuses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order REAL NOT NULL DEFAULT 0,
            is_default_start INTEGER NOT NULL DEFAULT 0,
            is_default_end INTEGER NOT NULL DEFAULT 0
        )
        """
    )


@migration("seed default statuses")
def seed_default_statuses(conn: sqlite3.Connection) -> None:
    count = conn.execute("SELECT COUNT(*) FROM statuses").fetchone()[0]
    if count == 0:
        default_statuses = [
            (f"status_{uuid4().hex}", "待辦", 0, 1, 0),
            (f"status_{uuid4().hex}", "進行中", 1, 0, 0),
            (f"status_{uuid4().hex}", "已完成", 2, 0, 1),
        ]
        conn.executemany(
            "INSERT INTO statuses (id, name, sort_order, is_default_start, is_default_end) VALUES (?, ?, ?, ?, ?)",
            default_statuses,
        )


@migration("create todos table")
def create_todos_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            status TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'medium',
            due_date TEXT,
            assignee TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            note TEXT,
            linked_task_id TEXT,
            created_at TEXT NOT NULL,
            sort_order REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (linked_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
            FOREIGN KEY (status) REFERENCES statuses(id)
        )
        """
    )


@migration("create todo_comments table")
def create_todo_comments_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS todo_comments (
            id TEXT PRIMARY KEY,
            todo_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
        )
        """
    )


# ── Auth migrations ───────────────────────────────────────────────────


@migration("create users table")
def create_users_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            email TEXT,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )


@migration("create refresh_tokens table")
def create_refresh_tokens_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            revoked INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )


@migration("add projects.created_by column")
def add_projects_created_by(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
    if "created_by" not in columns:
        conn.execute("ALTER TABLE projects ADD COLUMN created_by TEXT")


@migration("add todos.created_by column")
def add_todos_created_by(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(todos)").fetchall()}
    if "created_by" not in columns:
        conn.execute("ALTER TABLE todos ADD COLUMN created_by TEXT")


@migration("add todo_comments.author_id column")
def add_todo_comments_author_id(conn: sqlite3.Connection) -> None:
    columns = {
        row[1] for row in conn.execute("PRAGMA table_info(todo_comments)").fetchall()
    }
    if "author_id" not in columns:
        conn.execute("ALTER TABLE todo_comments ADD COLUMN author_id TEXT")


@migration("add logs.author_id column")
def add_logs_author_id(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(logs)").fetchall()}
    if "author_id" not in columns:
        conn.execute("ALTER TABLE logs ADD COLUMN author_id TEXT")


# ── Audit log migration ──────────────────────────────────────────────


@migration("create audit_logs table")
def create_audit_logs_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            user_display TEXT NOT NULL,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            entity_label TEXT,
            changes TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)"
    )


# ── Runner ────────────────────────────────────────────────────────────


def run_migrations() -> None:
    print(f"Database: {DB_PATH}")
    with get_connection() as conn:
        for name, fn in MIGRATIONS:
            try:
                fn(conn)
                print(f"  ✓ {name}")
            except Exception as e:
                print(f"  ✗ {name}: {e}")
                raise
        conn.commit()
    print("Done.")


if __name__ == "__main__":
    run_migrations()
