import re
import sqlite3
import sys
import time
from pathlib import Path

import pytest

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import backup
import db


@pytest.fixture()
def isolated_backup(tmp_path, monkeypatch):
    """Set up isolated source DB and backup directory."""
    source_db = tmp_path / "source.sqlite3"
    backup_dir = tmp_path / "backups"

    monkeypatch.setattr(db, "DB_PATH", source_db)
    monkeypatch.setattr(backup, "DB_PATH", source_db)
    monkeypatch.setattr(backup, "BACKUP_DIR", backup_dir)
    monkeypatch.setattr(backup, "BACKUP_RETENTION", 7)

    # Create a source DB with a table and some data
    conn = sqlite3.connect(source_db)
    conn.execute("CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT)")
    conn.execute("INSERT INTO projects VALUES ('p1', 'Test Project')")
    conn.commit()
    conn.close()

    return {"source_db": source_db, "backup_dir": backup_dir}


def test_backup_creates_file(isolated_backup):
    path = backup.run_backup()
    assert path.exists()
    assert path.stat().st_size > 0


def test_backup_filename_format(isolated_backup):
    path = backup.run_backup()
    pattern = r"^burnup_\d{4}-\d{2}-\d{2}_\d{6}\.sqlite3$"
    assert re.match(pattern, path.name)


def test_backup_is_valid_database(isolated_backup):
    path = backup.run_backup()
    conn = sqlite3.connect(path)
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    table_names = [t[0] for t in tables]
    assert "projects" in table_names

    row = conn.execute("SELECT name FROM projects WHERE id='p1'").fetchone()
    assert row[0] == "Test Project"
    conn.close()


def test_retention_cleanup(isolated_backup, monkeypatch):
    monkeypatch.setattr(backup, "BACKUP_RETENTION", 3)
    backup_dir = isolated_backup["backup_dir"]
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Create 5 backups with distinct timestamps
    for i in range(5):
        backup.create_backup()
        time.sleep(1.1)

    assert len(list(backup_dir.glob("burnup_*.sqlite3"))) == 5

    backup.cleanup_old_backups()
    remaining = sorted(backup_dir.glob("burnup_*.sqlite3"))
    assert len(remaining) == 3


def test_backup_dir_auto_created(isolated_backup):
    backup_dir = isolated_backup["backup_dir"]
    assert not backup_dir.exists()
    backup.run_backup()
    assert backup_dir.exists()
    assert len(list(backup_dir.glob("burnup_*.sqlite3"))) == 1


def test_scheduler_starts_and_stops(isolated_backup, monkeypatch):
    monkeypatch.setattr(backup, "BACKUP_INTERVAL_HOURS", 1.0)
    monkeypatch.setattr(backup, "_scheduler", None)

    backup.start_backup_scheduler()
    assert backup._scheduler is not None
    assert backup._scheduler.running

    backup.shutdown_backup_scheduler()
    assert backup._scheduler is None
