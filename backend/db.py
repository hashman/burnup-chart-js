import os
import sqlite3
from pathlib import Path
from uuid import uuid4

BASE_DIR: Path = Path(__file__).resolve().parent
DEFAULT_DB_PATH: Path = BASE_DIR / "data" / "burnup.sqlite3"
DB_PATH: Path = Path(
    os.environ.get("BURNUP_DB_PATH", str(DEFAULT_DB_PATH))
).expanduser()


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
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
            );
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                created_by TEXT,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                points INTEGER NOT NULL,
                people TEXT,
                added_date TEXT,
                expected_start TEXT,
                expected_end TEXT,
                actual_start TEXT,
                actual_end TEXT,
                show_label INTEGER NOT NULL DEFAULT 0,
                progress INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS logs (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                date TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                author_id TEXT,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS statuses (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sort_order REAL NOT NULL DEFAULT 0,
                is_default_start INTEGER NOT NULL DEFAULT 0,
                is_default_end INTEGER NOT NULL DEFAULT 0
            );
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
                created_by TEXT,
                FOREIGN KEY (linked_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
                FOREIGN KEY (status) REFERENCES statuses(id),
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS todo_comments (
                id TEXT PRIMARY KEY,
                todo_id TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                author_id TEXT,
                FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS sub_projects (
                id TEXT PRIMARY KEY,
                burnup_project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                owner TEXT,
                due_date TEXT,
                priority TEXT NOT NULL DEFAULT 'medium',
                tags TEXT NOT NULL DEFAULT '[]',
                sort_order REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                created_by TEXT,
                FOREIGN KEY (burnup_project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sub_projects_burnup ON sub_projects(burnup_project_id);
            CREATE TABLE IF NOT EXISTS sub_project_tasks (
                sub_project_id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                PRIMARY KEY (sub_project_id, task_id),
                FOREIGN KEY (sub_project_id) REFERENCES sub_projects(id) ON DELETE CASCADE,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS sub_project_events (
                id TEXT PRIMARY KEY,
                parent_type TEXT NOT NULL CHECK (parent_type IN ('sub_project', 'todo')),
                parent_id TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('waiting', 'note', 'decision')),
                title TEXT NOT NULL,
                body TEXT,
                waiting_on TEXT,
                started_at TEXT NOT NULL,
                resolved_at TEXT,
                created_at TEXT NOT NULL,
                created_by TEXT,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sub_project_events_parent ON sub_project_events(parent_type, parent_id);
            CREATE INDEX IF NOT EXISTS idx_sub_project_events_active ON sub_project_events(type, resolved_at);
            """
        )
        # Seed default statuses if table is empty
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

        # Migrations for existing databases
        task_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "progress" not in task_columns:
            conn.execute(
                "ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0"
            )

        # Add created_by to projects if missing
        project_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()
        }
        if "created_by" not in project_columns:
            conn.execute("ALTER TABLE projects ADD COLUMN created_by TEXT")

        # Add created_by to todos if missing
        todo_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(todos)").fetchall()
        }
        if "created_by" not in todo_columns:
            conn.execute("ALTER TABLE todos ADD COLUMN created_by TEXT")

        # Add author_id to todo_comments if missing
        comment_columns = {
            row[1]
            for row in conn.execute("PRAGMA table_info(todo_comments)").fetchall()
        }
        if "author_id" not in comment_columns:
            conn.execute("ALTER TABLE todo_comments ADD COLUMN author_id TEXT")

        # Add author_id to logs if missing
        log_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(logs)").fetchall()
        }
        if "author_id" not in log_columns:
            conn.execute("ALTER TABLE logs ADD COLUMN author_id TEXT")

        # Add sub_project_id to todos if missing
        if "sub_project_id" not in todo_columns:
            conn.execute("ALTER TABLE todos ADD COLUMN sub_project_id TEXT")
