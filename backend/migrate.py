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
        conn.execute(
            "ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0"
        )


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
