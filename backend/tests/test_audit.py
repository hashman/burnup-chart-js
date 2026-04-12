import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, Generator

import pytest
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import db
import main


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _auth_headers(client: TestClient) -> Dict[str, str]:
    """Bootstrap an admin user and return auth headers."""
    resp = client.post(
        "/api/auth/bootstrap",
        json={"username": "testadmin", "password": "testpass123"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_project(
    client: TestClient, name: str, headers: Dict[str, str] = None
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"name": name}
    response = client.post("/api/projects", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_task(
    client: TestClient,
    project_id: str,
    name: str,
    headers: Dict[str, str] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "name": name,
        "points": 5,
        "people": "Alice",
        "addedDate": "2024-01-01",
        "expectedStart": "2024-01-02",
        "expectedEnd": "2024-01-05",
        "actualStart": "",
        "actualEnd": "",
        "showLabel": True,
    }
    response = client.post(
        f"/api/projects/{project_id}/tasks", json=payload, headers=headers
    )
    assert response.status_code == 201
    return response.json()


def _member_headers(client: TestClient, auth: Dict[str, str]) -> Dict[str, str]:
    """Create a member user and return auth headers for that user."""
    client.post(
        "/api/auth/users",
        json={
            "username": "member1",
            "display_name": "Member",
            "password": "memberpass1",
            "role": "member",
        },
        headers=auth,
    )
    resp = client.post(
        "/api/auth/login",
        json={"username": "member1", "password": "memberpass1"},
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def client(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Generator[TestClient, None, None]:
    db_path = tmp_path / "test.sqlite3"
    monkeypatch.setattr(db, "DB_PATH", db_path)
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture()
def auth(client: TestClient) -> Dict[str, str]:
    """Return auth headers for an admin user."""
    return _auth_headers(client)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_audit_logs_require_admin(client: TestClient, auth: Dict[str, str]):
    """Non-admin (member) user gets 403 when accessing GET /api/audit-logs."""
    member_headers = _member_headers(client, auth)
    resp = client.get("/api/audit-logs", headers=member_headers)
    assert resp.status_code == 403


def test_audit_log_created_on_project_create(client: TestClient, auth: Dict[str, str]):
    """Creating a project produces an audit log entry."""
    project = create_project(client, "Audit Project", headers=auth)

    resp = client.get(
        "/api/audit-logs",
        params={"entityType": "project", "action": "create"},
        headers=auth,
    )
    assert resp.status_code == 200
    data = resp.json()
    items = data["items"]
    assert len(items) == 1

    entry = items[0]
    assert entry["entityType"] == "project"
    assert entry["action"] == "create"
    assert entry["entityId"] == project["id"]
    assert entry["userId"] is not None
    assert entry["createdAt"] is not None


def test_audit_log_created_on_project_update(client: TestClient, auth: Dict[str, str]):
    """Updating a project produces an audit log with old/new name in changes."""
    project = create_project(client, "Original Name", headers=auth)
    project_id = project["id"]

    # Update the project name
    resp = client.patch(
        f"/api/projects/{project_id}",
        json={"name": "Updated Name"},
        headers=auth,
    )
    assert resp.status_code == 200

    resp = client.get(
        "/api/audit-logs",
        params={"action": "update", "entityType": "project"},
        headers=auth,
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1

    entry = items[0]
    assert entry["entityId"] == project_id
    changes = entry["changes"]
    assert changes is not None
    assert changes["name"]["old"] == "Original Name"
    assert changes["name"]["new"] == "Updated Name"


def test_audit_log_created_on_project_delete(client: TestClient, auth: Dict[str, str]):
    """Deleting a project produces an audit log entry."""
    project = create_project(client, "Delete Me", headers=auth)
    project_id = project["id"]

    resp = client.delete(f"/api/projects/{project_id}", headers=auth)
    assert resp.status_code == 204

    resp = client.get(
        "/api/audit-logs",
        params={"action": "delete", "entityType": "project"},
        headers=auth,
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["entityId"] == project_id


def test_audit_log_created_on_task_crud(client: TestClient, auth: Dict[str, str]):
    """Create/update/delete a task produces 3 audit log entries."""
    project = create_project(client, "Task Project", headers=auth)
    project_id = project["id"]

    # Create task
    task = create_task(client, project_id, "My Task", headers=auth)
    task_id = task["id"]

    # Update task
    resp = client.patch(
        f"/api/tasks/{task_id}",
        json={"name": "Updated Task", "points": 8},
        headers=auth,
    )
    assert resp.status_code == 200

    # Delete task
    resp = client.delete(f"/api/tasks/{task_id}", headers=auth)
    assert resp.status_code == 204

    # Query audit logs for task entity type
    resp = client.get(
        "/api/audit-logs",
        params={"entityType": "task"},
        headers=auth,
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 3

    actions = {item["action"] for item in items}
    assert actions == {"create", "update", "delete"}


def test_audit_log_pagination(client: TestClient, auth: Dict[str, str]):
    """Audit logs support pagination with page, pageSize, total fields."""
    # Create multiple projects to generate multiple audit entries
    for i in range(5):
        create_project(client, f"Project {i}", headers=auth)

    resp = client.get(
        "/api/audit-logs",
        params={"pageSize": 2, "page": 1},
        headers=auth,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["page"] == 1
    assert data["pageSize"] == 2
    assert len(data["items"]) == 2
    assert data["total"] >= 5


def test_audit_log_filter_by_user(client: TestClient, auth: Dict[str, str]):
    """Filtering audit logs by userId returns correct results."""
    create_project(client, "User Filter Project", headers=auth)

    # Get the admin's userId from one of the audit entries
    resp = client.get(
        "/api/audit-logs",
        params={"entityType": "project", "action": "create"},
        headers=auth,
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) >= 1
    admin_user_id = items[0]["userId"]

    # Filter by admin userId – should return results
    resp = client.get(
        "/api/audit-logs",
        params={"userId": admin_user_id},
        headers=auth,
    )
    assert resp.status_code == 200
    assert len(resp.json()["items"]) >= 1

    # Filter by fake userId – should return 0 results
    resp = client.get(
        "/api/audit-logs",
        params={"userId": "nonexistent-user-id"},
        headers=auth,
    )
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 0


def test_audit_log_filter_by_date_range(client: TestClient, auth: Dict[str, str]):
    """Filtering audit logs by startDate/endDate returns results for today."""
    create_project(client, "Date Filter Project", headers=auth)

    today = date.today().isoformat()
    resp = client.get(
        "/api/audit-logs",
        params={"startDate": today, "endDate": today},
        headers=auth,
    )
    assert resp.status_code == 200
    assert len(resp.json()["items"]) >= 1


def test_audit_log_on_status_reorder(client: TestClient, auth: Dict[str, str]):
    """Reordering statuses produces one audit row per status whose sortOrder actually changed."""
    statuses = client.get("/api/statuses", headers=auth).json()
    assert len(statuses) >= 2

    # Swap the first two statuses' sort order; leave the rest untouched.
    s0, s1 = statuses[0], statuses[1]
    reordered = [
        {"id": s0["id"], "sortOrder": s1["sortOrder"]},
        {"id": s1["id"], "sortOrder": s0["sortOrder"]},
    ] + [{"id": s["id"], "sortOrder": s["sortOrder"]} for s in statuses[2:]]

    resp = client.post("/api/statuses/reorder", json=reordered, headers=auth)
    assert resp.status_code == 200

    resp = client.get(
        "/api/audit-logs",
        params={"entityType": "status", "action": "update"},
        headers=auth,
    )
    assert resp.status_code == 200
    items = resp.json()["items"]

    # Exactly two rows: one per swapped status, each with its own entity_id.
    reorder_rows = [i for i in items if i["entityId"] in {s0["id"], s1["id"]}]
    assert len(reorder_rows) == 2
    entity_ids = {row["entityId"] for row in reorder_rows}
    assert entity_ids == {s0["id"], s1["id"]}

    # Each row must record sortOrder old→new for its specific status.
    by_id = {row["entityId"]: row for row in reorder_rows}
    assert by_id[s0["id"]]["changes"]["sortOrder"] == {
        "old": s0["sortOrder"],
        "new": s1["sortOrder"],
    }
    assert by_id[s1["id"]]["changes"]["sortOrder"] == {
        "old": s1["sortOrder"],
        "new": s0["sortOrder"],
    }

    # Untouched statuses must not produce audit rows.
    for s in statuses[2:]:
        assert all(i["entityId"] != s["id"] for i in items)


def test_audit_log_on_user_create(client: TestClient, auth: Dict[str, str]):
    """Creating a user via POST /api/auth/users produces an audit log entry."""
    resp = client.post(
        "/api/auth/users",
        json={
            "username": "audituser",
            "display_name": "Audit User",
            "password": "auditpass1",
            "role": "member",
        },
        headers=auth,
    )
    assert resp.status_code == 201

    resp = client.get(
        "/api/audit-logs",
        params={"entityType": "user", "action": "create"},
        headers=auth,
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) >= 1

    # Find the entry for our specific user
    matching = [
        i
        for i in items
        if i["entityLabel"] == "audituser" or "audituser" in str(i.get("changes", ""))
    ]
    assert len(matching) >= 1
