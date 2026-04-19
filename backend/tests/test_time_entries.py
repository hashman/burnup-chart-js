"""Tests for the per-user time-log endpoints."""

import sys
from pathlib import Path
from typing import Any, Dict, Generator

import pytest
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import db
import main


def _auth_headers(client: TestClient) -> Dict[str, str]:
    resp = client.post(
        "/api/auth/bootstrap",
        json={"username": "timeadmin", "password": "testpass123"},
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture()
def client(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Generator[TestClient, None, None]:
    db_path = tmp_path / "test.sqlite3"
    monkeypatch.setattr(db, "DB_PATH", db_path)
    with TestClient(main.app) as c:
        yield c


@pytest.fixture()
def auth(client: TestClient) -> Dict[str, str]:
    return _auth_headers(client)


def _create(client: TestClient, auth: Dict[str, str], **kw: Any) -> Dict[str, Any]:
    payload = {"item": "Coding", "hours": 2, "date": "2026-04-19", **kw}
    r = client.post("/api/time-entries", json=payload, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def test_unauthenticated_returns_401(client: TestClient) -> None:
    r = client.get("/api/time-entries")
    assert r.status_code == 401


def test_create_and_list(client: TestClient, auth: Dict[str, str]) -> None:
    _create(client, auth, item="Coding", hours=3.25)
    _create(client, auth, item="Meeting", hours=1, date="2026-04-18")

    r = client.get("/api/time-entries", headers=auth)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    # ordered date desc
    assert data[0]["date"] >= data[1]["date"]


def test_hours_snap_to_quarter(client: TestClient, auth: Dict[str, str]) -> None:
    e = _create(client, auth, hours=1.13)
    assert e["hours"] == 1.25  # 1.13 rounds up to 1.25
    e2 = _create(client, auth, hours=2.7)
    assert e2["hours"] == 2.75


def test_zero_or_negative_hours_rejected(client: TestClient, auth: Dict[str, str]) -> None:
    r = client.post(
        "/api/time-entries",
        json={"item": "x", "hours": 0, "date": "2026-04-19"},
        headers=auth,
    )
    assert r.status_code == 422

    r = client.post(
        "/api/time-entries",
        json={"item": "x", "hours": -1, "date": "2026-04-19"},
        headers=auth,
    )
    assert r.status_code == 422


def test_bad_date_format_rejected(client: TestClient, auth: Dict[str, str]) -> None:
    r = client.post(
        "/api/time-entries",
        json={"item": "x", "hours": 1, "date": "04/19/2026"},
        headers=auth,
    )
    assert r.status_code == 400


def test_empty_item_rejected(client: TestClient, auth: Dict[str, str]) -> None:
    r = client.post(
        "/api/time-entries",
        json={"item": "   ", "hours": 1, "date": "2026-04-19"},
        headers=auth,
    )
    assert r.status_code == 400


def test_update_and_delete(client: TestClient, auth: Dict[str, str]) -> None:
    e = _create(client, auth)
    r = client.patch(
        f"/api/time-entries/{e['id']}",
        json={"hours": 4.5, "item": "Refactor"},
        headers=auth,
    )
    assert r.status_code == 200
    assert r.json()["hours"] == 4.5
    assert r.json()["item"] == "Refactor"

    r = client.delete(f"/api/time-entries/{e['id']}", headers=auth)
    assert r.status_code == 204

    r = client.get("/api/time-entries", headers=auth)
    assert r.json() == []


def test_entries_are_per_user(client: TestClient, auth: Dict[str, str]) -> None:
    _create(client, auth, item="mine")

    # Create a second user via admin
    r = client.post(
        "/api/auth/users",
        json={"username": "other", "password": "pass12345", "display_name": "Other"},
        headers=auth,
    )
    assert r.status_code == 201, r.text

    r = client.post(
        "/api/auth/login",
        json={"username": "other", "password": "pass12345"},
    )
    assert r.status_code == 200
    other_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

    r = client.get("/api/time-entries", headers=other_headers)
    assert r.json() == []  # the other user sees none of the admin's entries

    # Other user can't delete admin's entry
    admin_entries = client.get("/api/time-entries", headers=auth).json()
    admin_id = admin_entries[0]["id"]
    r = client.delete(f"/api/time-entries/{admin_id}", headers=other_headers)
    assert r.status_code == 404


def test_date_range_filter(client: TestClient, auth: Dict[str, str]) -> None:
    _create(client, auth, item="a", date="2026-04-10")
    _create(client, auth, item="b", date="2026-04-15")
    _create(client, auth, item="c", date="2026-04-20")

    r = client.get(
        "/api/time-entries?from=2026-04-12&to=2026-04-18",
        headers=auth,
    )
    assert r.status_code == 200
    items = [e["item"] for e in r.json()]
    assert items == ["b"]


def test_summary_day(client: TestClient, auth: Dict[str, str]) -> None:
    _create(client, auth, item="A", hours=2, date="2026-04-19")
    _create(client, auth, item="A", hours=1, date="2026-04-19")  # same day + item
    _create(client, auth, item="B", hours=1, date="2026-04-19")
    _create(client, auth, item="A", hours=4, date="2026-04-18")

    r = client.get("/api/time-entries/summary?period=day", headers=auth)
    assert r.status_code == 200
    data = r.json()
    assert data["period"] == "day"
    # 2 day buckets, newest first
    assert [b["key"] for b in data["buckets"]] == ["2026-04-19", "2026-04-18"]
    today_bucket = data["buckets"][0]
    assert today_bucket["total"] == 4.0
    # A should come first (higher hours), percent sums to 100
    assert today_bucket["items"][0]["item"] == "A"
    assert today_bucket["items"][0]["hours"] == 3.0
    assert today_bucket["items"][0]["percent"] == 75.0
    assert today_bucket["items"][1]["item"] == "B"
    assert today_bucket["items"][1]["percent"] == 25.0
    # Overall
    assert data["overall"]["total"] == 8.0


def test_summary_week_buckets_monday(client: TestClient, auth: Dict[str, str]) -> None:
    # Apr 13 2026 is a Monday. Entries within the same ISO week should bucket.
    _create(client, auth, item="X", hours=1, date="2026-04-13")  # Mon
    _create(client, auth, item="X", hours=2, date="2026-04-16")  # Thu
    _create(client, auth, item="Y", hours=1, date="2026-04-20")  # next Mon

    r = client.get("/api/time-entries/summary?period=week", headers=auth)
    data = r.json()
    keys = [b["key"] for b in data["buckets"]]
    # Newest-first order
    assert keys == ["2026-04-20", "2026-04-13"]
    # First week total = 3 (X twice)
    week1 = [b for b in data["buckets"] if b["key"] == "2026-04-13"][0]
    assert week1["total"] == 3.0


def test_summary_month(client: TestClient, auth: Dict[str, str]) -> None:
    _create(client, auth, item="A", hours=3, date="2026-04-05")
    _create(client, auth, item="A", hours=2, date="2026-04-25")
    _create(client, auth, item="A", hours=1, date="2026-05-02")

    r = client.get("/api/time-entries/summary?period=month", headers=auth)
    data = r.json()
    keys = [b["key"] for b in data["buckets"]]
    assert keys == ["2026-05-01", "2026-04-01"]
    apr = [b for b in data["buckets"] if b["key"] == "2026-04-01"][0]
    assert apr["total"] == 5.0


def test_summary_period_validation(client: TestClient, auth: Dict[str, str]) -> None:
    r = client.get("/api/time-entries/summary?period=year", headers=auth)
    assert r.status_code == 400
