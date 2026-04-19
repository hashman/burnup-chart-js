"""Personal time-log endpoints.

Lets authenticated users record how many hours they spent on a
free-text "item" on a given day, and query aggregated summaries
grouped by day / week / month.
"""

import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import get_current_user
from db import get_connection
from models import TimeEntryCreate, TimeEntryOut, TimeEntryUpdate

router = APIRouter(prefix="/api", tags=["time-entries"])


def utc_now() -> str:
    return datetime.utcnow().isoformat()


DATE_RE = r"^\d{4}-\d{2}-\d{2}$"


def _validate_date(value: str, label: str = "date") -> None:
    import re

    if not re.match(DATE_RE, value):
        raise HTTPException(status_code=400, detail=f"{label} must be YYYY-MM-DD")


def _round_quarter(hours: float) -> float:
    """Snap hours to 0.25-hour precision."""
    return round(hours * 4) / 4


def row_to_entry(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "item": row["item"],
        "hours": row["hours"],
        "date": row["date"],
        "note": row["note"],
        "createdAt": row["created_at"],
    }


@router.get("/time-entries", response_model=List[TimeEntryOut])
def list_time_entries(
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    if from_:
        _validate_date(from_, "from")
    if to:
        _validate_date(to, "to")

    clauses = ["user_id = ?"]
    params: List[Any] = [current_user["id"]]
    if from_:
        clauses.append("date >= ?")
        params.append(from_)
    if to:
        clauses.append("date <= ?")
        params.append(to)

    where = " AND ".join(clauses)
    with get_connection() as conn:
        rows = conn.execute(
            f"SELECT * FROM time_entries WHERE {where} ORDER BY date DESC, created_at DESC",
            params,
        ).fetchall()
    return [row_to_entry(r) for r in rows]


@router.post(
    "/time-entries",
    response_model=TimeEntryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_time_entry(
    payload: TimeEntryCreate,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    _validate_date(payload.date)
    item = payload.item.strip()
    if not item:
        raise HTTPException(status_code=400, detail="item must not be empty")
    hours = _round_quarter(payload.hours)
    if hours <= 0:
        raise HTTPException(status_code=400, detail="hours must be > 0")

    entry_id = f"te_{uuid4().hex}"
    now = utc_now()
    with get_connection() as conn:
        conn.execute(
            """INSERT INTO time_entries (id, user_id, item, hours, date, note, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                entry_id,
                current_user["id"],
                item,
                hours,
                payload.date,
                payload.note,
                now,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM time_entries WHERE id = ?", (entry_id,)
        ).fetchone()
    return row_to_entry(row)


@router.patch("/time-entries/{entry_id}", response_model=TimeEntryOut)
def update_time_entry(
    entry_id: str,
    payload: TimeEntryUpdate,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    fields: List[str] = []
    values: List[Any] = []
    if payload.item is not None:
        item = payload.item.strip()
        if not item:
            raise HTTPException(status_code=400, detail="item must not be empty")
        fields.append("item = ?")
        values.append(item)
    if payload.hours is not None:
        hours = _round_quarter(payload.hours)
        if hours <= 0:
            raise HTTPException(status_code=400, detail="hours must be > 0")
        fields.append("hours = ?")
        values.append(hours)
    if payload.date is not None:
        _validate_date(payload.date)
        fields.append("date = ?")
        values.append(payload.date)
    if payload.note is not None:
        fields.append("note = ?")
        values.append(payload.note)

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT * FROM time_entries WHERE id = ? AND user_id = ?",
            (entry_id, current_user["id"]),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Time entry not found")
        if fields:
            values.append(entry_id)
            values.append(current_user["id"])
            conn.execute(
                f"UPDATE time_entries SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
                values,
            )
            conn.commit()
        row = conn.execute(
            "SELECT * FROM time_entries WHERE id = ?", (entry_id,)
        ).fetchone()
    return row_to_entry(row)


@router.delete("/time-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
) -> None:
    with get_connection() as conn:
        result = conn.execute(
            "DELETE FROM time_entries WHERE id = ? AND user_id = ?",
            (entry_id, current_user["id"]),
        )
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Time entry not found")
    return None


# ---------------------------------------------------------------------------
# Summary aggregation: hours per item, grouped by day / week / month.
# ---------------------------------------------------------------------------


def _iso_week_start(date_str: str) -> str:
    """Return the Monday of the ISO week containing date_str, as YYYY-MM-DD."""
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()


def _month_start(date_str: str) -> str:
    """Return the first day of the month containing date_str."""
    return date_str[:7] + "-01"


def _bucket(date_str: str, period: str) -> str:
    if period == "day":
        return date_str
    if period == "week":
        return _iso_week_start(date_str)
    if period == "month":
        return _month_start(date_str)
    raise HTTPException(
        status_code=400, detail="period must be one of: day, week, month"
    )


@router.get("/time-entries/summary")
def time_entry_summary(
    period: str = Query("day"),
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return aggregated hours grouped by {period, item}.

    Response shape:
      {
        "period": "day",
        "buckets": [
          {
            "key": "2026-04-19",
            "total": 7.5,
            "items": [
              {"item": "API refactor", "hours": 4.0, "percent": 53.3},
              {"item": "Meeting",       "hours": 3.5, "percent": 46.7}
            ]
          },
          ...
        ],
        "overall": {
          "total": 37.5,
          "items": [
            {"item": "API refactor", "hours": 18.0, "percent": 48.0},
            ...
          ]
        }
      }
    """
    if period not in ("day", "week", "month"):
        raise HTTPException(
            status_code=400, detail="period must be one of: day, week, month"
        )
    if from_:
        _validate_date(from_, "from")
    if to:
        _validate_date(to, "to")

    clauses = ["user_id = ?"]
    params: List[Any] = [current_user["id"]]
    if from_:
        clauses.append("date >= ?")
        params.append(from_)
    if to:
        clauses.append("date <= ?")
        params.append(to)
    where = " AND ".join(clauses)

    with get_connection() as conn:
        rows = conn.execute(
            f"SELECT date, item, hours FROM time_entries WHERE {where}",
            params,
        ).fetchall()

    bucket_map: Dict[str, Dict[str, float]] = {}
    overall_items: Dict[str, float] = {}

    for r in rows:
        key = _bucket(r["date"], period)
        items = bucket_map.setdefault(key, {})
        items[r["item"]] = items.get(r["item"], 0.0) + r["hours"]
        overall_items[r["item"]] = overall_items.get(r["item"], 0.0) + r["hours"]

    def items_with_percent(items: Dict[str, float]) -> List[Dict[str, Any]]:
        total = sum(items.values()) or 1.0
        out = [
            {
                "item": name,
                "hours": round(hours, 2),
                "percent": round((hours / total) * 100, 1),
            }
            for name, hours in items.items()
        ]
        out.sort(key=lambda x: (-x["hours"], x["item"]))
        return out

    buckets = []
    for key in sorted(bucket_map.keys(), reverse=True):
        items = bucket_map[key]
        buckets.append(
            {
                "key": key,
                "total": round(sum(items.values()), 2),
                "items": items_with_percent(items),
            }
        )

    return {
        "period": period,
        "buckets": buckets,
        "overall": {
            "total": round(sum(overall_items.values()), 2),
            "items": items_with_percent(overall_items),
        },
    }
