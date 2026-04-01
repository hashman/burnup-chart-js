import os
import sqlite3
from datetime import datetime
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler

from db import BASE_DIR, DB_PATH

BACKUP_DIR: Path = Path(
    os.environ.get("BURNUP_BACKUP_DIR", str(BASE_DIR / "data" / "backups"))
).expanduser()

BACKUP_RETENTION: int = int(os.environ.get("BURNUP_BACKUP_RETENTION", "7"))

BACKUP_INTERVAL_HOURS: float = float(
    os.environ.get("BURNUP_BACKUP_INTERVAL_HOURS", "24")
)

_scheduler: BackgroundScheduler | None = None


def create_backup() -> Path:
    """Create a timestamped backup of the SQLite database using the safe
    online backup API (``sqlite3.Connection.backup``).

    Returns:
        Path to the newly created backup file.
    """
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    backup_path = BACKUP_DIR / f"burnup_{timestamp}.sqlite3"

    source = sqlite3.connect(DB_PATH)
    try:
        dest = sqlite3.connect(backup_path)
        try:
            source.backup(dest)
        finally:
            dest.close()
    finally:
        source.close()

    return backup_path


def cleanup_old_backups() -> list[Path]:
    """Remove the oldest backups that exceed the retention limit.

    Returns:
        List of deleted backup file paths.
    """
    backups = sorted(BACKUP_DIR.glob("burnup_*.sqlite3"))
    removed: list[Path] = []
    if len(backups) > BACKUP_RETENTION:
        for f in backups[: len(backups) - BACKUP_RETENTION]:
            f.unlink()
            removed.append(f)
    return removed


def run_backup() -> Path:
    """Create a backup and clean up old ones.

    Returns:
        Path to the newly created backup file.
    """
    path = create_backup()
    removed = cleanup_old_backups()
    print(f"[backup] created: {path}")
    if removed:
        print(f"[backup] removed {len(removed)} old backup(s)")
    return path


def start_backup_scheduler() -> None:
    """Start the APScheduler background scheduler for periodic backups."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(run_backup, "interval", hours=BACKUP_INTERVAL_HOURS)
    _scheduler.start()
    print(
        f"[backup] scheduler started (interval: {BACKUP_INTERVAL_HOURS}h, "
        f"retention: {BACKUP_RETENTION})"
    )


def shutdown_backup_scheduler() -> None:
    """Shut down the backup scheduler gracefully."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        print("[backup] scheduler stopped")


if __name__ == "__main__":
    path = run_backup()
