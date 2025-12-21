import os
import sqlite3
from pathlib import Path

BASE_DIR: Path = Path(__file__).resolve().parent
DEFAULT_DB_PATH: Path = BASE_DIR / "data" / "burnup.sqlite3"
DB_PATH: Path = Path(
    os.environ.get("BURNUP_DB_PATH", str(DEFAULT_DB_PATH))
).expanduser()


def get_connection() -> sqlite3.Connection:
    """Create and configure a SQLite connection.

    Args:
        None.

    Returns:
        sqlite3.Connection: Configured SQLite connection.

    Raises:
        sqlite3.Error: If the connection cannot be established.
    """
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Initialize the database schema if it does not exist.

    Args:
        None.

    Returns:
        None.

    Raises:
        sqlite3.Error: If schema initialization fails.
    """
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
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
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS logs (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                date TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );
            """
        )
