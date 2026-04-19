"""Tests for the unified /api/activity endpoint."""

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
        json={"username": "testadmin", "password": "testpass123"},
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


def _mk_project(client: TestClient, auth: Dict[str, str], name: str) -> Dict[str, Any]:
    r = client.post("/api/projects", json={"name": name}, headers=auth)
    assert r.status_code == 201
    return r.json()


def _mk_task(
    client: TestClient, auth: Dict[str, str], project_id: str, name: str
) -> Dict[str, Any]:
    r = client.post(
        f"/api/projects/{project_id}/tasks",
        json={
            "name": name,
            "points": 3,
            "people": "Alice",
            "addedDate": "2026-04-01",
            "expectedStart": "2026-04-01",
            "expectedEnd": "2026-04-05",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _mk_log(
    client: TestClient, auth: Dict[str, str], task_id: str, content: str
) -> Dict[str, Any]:
    r = client.post(
        f"/api/tasks/{task_id}/logs",
        json={"date": "2026-04-10", "content": content},
        headers=auth,
    )
    assert r.status_code == 201
    return r.json()


def _mk_todo(
    client: TestClient, auth: Dict[str, str], title: str, **kw: Any
) -> Dict[str, Any]:
    payload = {"title": title, **kw}
    r = client.post("/api/todos", json=payload, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def _mk_comment(
    client: TestClient, auth: Dict[str, str], todo_id: str, content: str
) -> Dict[str, Any]:
    r = client.post(
        f"/api/todos/{todo_id}/comments",
        json={"content": content},
        headers=auth,
    )
    assert r.status_code == 201
    return r.json()


def _mk_sub_project(
    client: TestClient, auth: Dict[str, str], project_id: str, name: str
) -> Dict[str, Any]:
    r = client.post(
        f"/api/projects/{project_id}/sub-projects",
        json={"name": name, "priority": "medium"},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _mk_event(
    client: TestClient,
    auth: Dict[str, str],
    sp_id: str,
    event_type: str,
    title: str,
    **kw: Any,
) -> Dict[str, Any]:
    payload = {"type": event_type, "title": title, **kw}
    r = client.post(
        f"/api/sub-projects/{sp_id}/events",
        json=payload,
        headers=auth,
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_activity_unauthenticated_returns_401(client: TestClient) -> None:
    r = client.get("/api/activity?project_id=anything")
    assert r.status_code == 401


def test_activity_requires_project_id(client: TestClient, auth: Dict[str, str]) -> None:
    r = client.get("/api/activity", headers=auth)
    assert r.status_code == 422


def test_activity_empty_project_returns_empty(
    client: TestClient, auth: Dict[str, str]
) -> None:
    project = _mk_project(client, auth, "Empty proj")
    r = client.get(f"/api/activity?project_id={project['id']}", headers=auth)
    assert r.status_code == 200
    assert r.json() == []


def test_activity_returns_task_logs(client: TestClient, auth: Dict[str, str]) -> None:
    project = _mk_project(client, auth, "Alpha")
    task = _mk_task(client, auth, project["id"], "Design schema")
    _mk_log(client, auth, task["id"], "Drafted v1")
    _mk_log(client, auth, task["id"], "Review done")

    r = client.get(f"/api/activity?project_id={project['id']}", headers=auth)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 2
    assert {it["kind"] for it in items} == {"log"}
    assert {it["context"] for it in items} == {"Design schema"}
    # logs don't currently record author_id — `who` may be None; just
    # assert the field is present.
    for it in items:
        assert "who" in it
    # newest first
    assert items[0]["when"] >= items[1]["when"]


def test_activity_returns_todo_comments_linked_to_task(
    client: TestClient, auth: Dict[str, str]
) -> None:
    project = _mk_project(client, auth, "WithTodos")
    task = _mk_task(client, auth, project["id"], "Impl foo")
    todo = _mk_todo(client, auth, "Implement foo", linkedTaskId=task["id"])
    _mk_comment(client, auth, todo["id"], "Note on foo")

    r = client.get(f"/api/activity?project_id={project['id']}", headers=auth)
    assert r.status_code == 200
    items = r.json()
    kinds = [it["kind"] for it in items]
    assert "comment" in kinds
    comment = next(it for it in items if it["kind"] == "comment")
    assert comment["text"] == "Note on foo"
    assert comment["context"] == "Implement foo"


def test_activity_returns_sub_project_events(
    client: TestClient, auth: Dict[str, str]
) -> None:
    project = _mk_project(client, auth, "Proj")
    sp = _mk_sub_project(client, auth, project["id"], "SP")
    _mk_event(client, auth, sp["id"], "waiting", "block on PM", waitingOn="PM")
    _mk_event(client, auth, sp["id"], "decision", "use JWT")
    _mk_event(client, auth, sp["id"], "note", "kickoff done")

    r = client.get(f"/api/activity?project_id={project['id']}", headers=auth)
    assert r.status_code == 200
    items = r.json()
    kinds = {it["kind"] for it in items}
    assert kinds == {"waiting", "decision", "note"}
    waiting = next(it for it in items if it["kind"] == "waiting")
    assert waiting["waitingOn"] == "PM"
    assert waiting["context"] == "SP"


def test_activity_merges_all_sources_sorted_desc(
    client: TestClient, auth: Dict[str, str]
) -> None:
    project = _mk_project(client, auth, "Merged")
    task = _mk_task(client, auth, project["id"], "T1")
    todo = _mk_todo(client, auth, "TD1", linkedTaskId=task["id"])
    sp = _mk_sub_project(client, auth, project["id"], "SP")

    _mk_log(client, auth, task["id"], "log entry")
    _mk_comment(client, auth, todo["id"], "comment entry")
    _mk_event(client, auth, sp["id"], "note", "event entry")

    r = client.get(f"/api/activity?project_id={project['id']}", headers=auth)
    items = r.json()
    assert len(items) == 3
    assert {it["kind"] for it in items} == {"log", "comment", "note"}
    # sorted desc by when
    whens = [it["when"] for it in items]
    assert whens == sorted(whens, reverse=True)


def test_activity_isolates_other_projects(
    client: TestClient, auth: Dict[str, str]
) -> None:
    p1 = _mk_project(client, auth, "P1")
    p2 = _mk_project(client, auth, "P2")
    t1 = _mk_task(client, auth, p1["id"], "T1")
    t2 = _mk_task(client, auth, p2["id"], "T2")
    _mk_log(client, auth, t1["id"], "p1 log")
    _mk_log(client, auth, t2["id"], "p2 log")

    r = client.get(f"/api/activity?project_id={p1['id']}", headers=auth)
    items = r.json()
    assert len(items) == 1
    assert items[0]["text"] == "p1 log"


def test_activity_respects_limit(client: TestClient, auth: Dict[str, str]) -> None:
    project = _mk_project(client, auth, "Many")
    task = _mk_task(client, auth, project["id"], "T")
    for i in range(6):
        _mk_log(client, auth, task["id"], f"log #{i}")

    r = client.get(f"/api/activity?project_id={project['id']}&limit=3", headers=auth)
    items = r.json()
    assert len(items) == 3
