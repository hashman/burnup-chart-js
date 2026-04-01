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
    """Bootstrap an admin user and return auth headers."""
    resp = client.post(
        "/api/auth/bootstrap",
        json={"username": "testadmin", "password": "testpass123"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_project(
    client: TestClient, name: str, project_id: str = "", headers: Dict[str, str] = None
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"name": name}
    if project_id:
        payload["id"] = project_id
    response = client.post("/api/projects", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_task(
    client: TestClient,
    project_id: str,
    name: str,
    task_id: str = "",
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
    if task_id:
        payload["id"] = task_id
    response = client.post(
        f"/api/projects/{project_id}/tasks", json=payload, headers=headers
    )
    assert response.status_code == 201
    return response.json()


def create_log(
    client: TestClient, task_id: str, content: str, headers: Dict[str, str] = None
) -> Dict[str, Any]:
    payload = {"date": "2024-01-10", "content": content}
    response = client.post(f"/api/tasks/{task_id}/logs", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


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


def test_health_check_returns_ok(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unauthenticated_access_returns_401(client: TestClient) -> None:
    response = client.get("/api/projects")
    assert response.status_code == 401


def test_project_crud_flow(client: TestClient, auth: Dict[str, str]) -> None:
    project = create_project(client, name="Alpha", headers=auth)
    project_id = project["id"]

    list_response = client.get("/api/projects", headers=auth)
    assert list_response.status_code == 200
    ids = [item["id"] for item in list_response.json()]
    assert project_id in ids

    get_response = client.get(f"/api/projects/{project_id}", headers=auth)
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "Alpha"

    update_response = client.patch(
        f"/api/projects/{project_id}", json={"name": "Alpha Updated"}, headers=auth
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Alpha Updated"

    delete_response = client.delete(f"/api/projects/{project_id}", headers=auth)
    assert delete_response.status_code == 204

    missing_response = client.get(f"/api/projects/{project_id}", headers=auth)
    assert missing_response.status_code == 404


def test_task_crud_flow(client: TestClient, auth: Dict[str, str]) -> None:
    project = create_project(client, name="Task Project", headers=auth)
    project_id = project["id"]

    task = create_task(client, project_id=project_id, name="Design API", headers=auth)
    task_id = task["id"]
    assert task["showLabel"] is True

    update_response = client.patch(
        f"/api/tasks/{task_id}", json={"points": 8, "showLabel": False}, headers=auth
    )
    assert update_response.status_code == 200
    assert update_response.json()["points"] == 8
    assert update_response.json()["showLabel"] is False

    project_response = client.get(f"/api/projects/{project_id}", headers=auth)
    assert project_response.status_code == 200
    tasks = project_response.json()["tasks"]
    assert len(tasks) == 1
    assert tasks[0]["id"] == task_id

    delete_response = client.delete(f"/api/tasks/{task_id}", headers=auth)
    assert delete_response.status_code == 204

    project_response = client.get(f"/api/projects/{project_id}", headers=auth)
    assert project_response.status_code == 200
    assert project_response.json()["tasks"] == []


def test_task_progress_field(client: TestClient, auth: Dict[str, str]) -> None:
    project = create_project(client, name="Progress Project", headers=auth)
    task = create_task(client, project["id"], "Progress Task", headers=auth)

    assert task["progress"] == 0

    resp = client.patch(f"/api/tasks/{task['id']}", json={"progress": 75}, headers=auth)
    assert resp.status_code == 200
    assert resp.json()["progress"] == 75

    proj = client.get(f"/api/projects/{project['id']}", headers=auth).json()
    assert proj["tasks"][0]["progress"] == 75

    resp = client.patch(
        f"/api/tasks/{task['id']}", json={"progress": 100}, headers=auth
    )
    assert resp.status_code == 200
    assert resp.json()["progress"] == 100


def test_log_crud_flow(client: TestClient, auth: Dict[str, str]) -> None:
    project = create_project(client, name="Log Project", headers=auth)
    task = create_task(
        client, project_id=project["id"], name="Write Docs", headers=auth
    )

    log = create_log(client, task_id=task["id"], content="First note", headers=auth)
    assert log["content"] == "First note"

    project_response = client.get(f"/api/projects/{project['id']}", headers=auth)
    assert project_response.status_code == 200
    tasks = project_response.json()["tasks"]
    assert len(tasks) == 1
    assert tasks[0]["logs"][0]["id"] == log["id"]

    delete_response = client.delete(f"/api/logs/{log['id']}", headers=auth)
    assert delete_response.status_code == 204

    project_response = client.get(f"/api/projects/{project['id']}", headers=auth)
    assert project_response.status_code == 200
    assert project_response.json()["tasks"][0]["logs"] == []


def test_duplicate_ids_return_conflict(
    client: TestClient, auth: Dict[str, str]
) -> None:
    project_id = "proj_fixed"
    create_project(client, name="Primary", project_id=project_id, headers=auth)

    duplicate_project = client.post(
        "/api/projects", json={"id": project_id, "name": "Duplicate"}, headers=auth
    )
    assert duplicate_project.status_code == 409

    task_id = "task_fixed"
    create_task(
        client,
        project_id=project_id,
        name="Initial Task",
        task_id=task_id,
        headers=auth,
    )
    duplicate_task = client.post(
        f"/api/projects/{project_id}/tasks",
        json={"id": task_id, "name": "Duplicate Task", "points": 1},
        headers=auth,
    )
    assert duplicate_task.status_code == 409


def test_missing_project_returns_404(client: TestClient, auth: Dict[str, str]) -> None:
    response = client.get("/api/projects/does-not-exist", headers=auth)
    assert response.status_code == 404

    response = client.post(
        "/api/projects/does-not-exist/tasks",
        json={"name": "Ghost Task", "points": 1},
        headers=auth,
    )
    assert response.status_code == 404


def test_statuses_table_exists(client: TestClient) -> None:
    with db.get_connection() as conn:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='statuses'"
        ).fetchone()
    assert row is not None
    assert row["name"] == "statuses"


def test_default_statuses_seeded(client: TestClient) -> None:
    with db.get_connection() as conn:
        rows = conn.execute("SELECT * FROM statuses ORDER BY sort_order").fetchall()
    assert len(rows) == 3
    assert rows[0]["name"] == "待辦"
    assert rows[0]["is_default_start"] == 1
    assert rows[0]["is_default_end"] == 0
    assert rows[1]["name"] == "進行中"
    assert rows[1]["is_default_start"] == 0
    assert rows[1]["is_default_end"] == 0
    assert rows[2]["name"] == "已完成"
    assert rows[2]["is_default_start"] == 0
    assert rows[2]["is_default_end"] == 1


def test_todos_table_exists(client: TestClient) -> None:
    with db.get_connection() as conn:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='todos'"
        ).fetchone()
    assert row is not None
    assert row["name"] == "todos"


# ---------------------------------------------------------------------------
# Status CRUD helpers & tests
# ---------------------------------------------------------------------------


def create_status(
    client: TestClient,
    name: str,
    sort_order: float = None,
    headers: Dict[str, str] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"name": name}
    if sort_order is not None:
        payload["sort_order"] = sort_order
    response = client.post("/api/statuses", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


def test_list_statuses(client: TestClient, auth: Dict[str, str]) -> None:
    response = client.get("/api/statuses", headers=auth)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert data[0]["name"] == "待辦"
    assert data[1]["name"] == "進行中"
    assert data[2]["name"] == "已完成"
    assert data[0]["sortOrder"] < data[1]["sortOrder"] < data[2]["sortOrder"]


def test_create_status(client: TestClient, auth: Dict[str, str]) -> None:
    s = create_status(client, "Review", headers=auth)
    assert s["name"] == "Review"
    assert s["id"].startswith("status_")
    assert s["isDefaultStart"] is False
    assert s["isDefaultEnd"] is False
    assert s["sortOrder"] > 2


def test_create_status_with_sort_order(
    client: TestClient, auth: Dict[str, str]
) -> None:
    s = create_status(client, "QA", sort_order=1.5, headers=auth)
    assert s["sortOrder"] == 1.5


def test_create_status_empty_name_rejected(
    client: TestClient, auth: Dict[str, str]
) -> None:
    response = client.post("/api/statuses", json={"name": ""}, headers=auth)
    assert response.status_code == 400

    response = client.post("/api/statuses", json={"name": "   "}, headers=auth)
    assert response.status_code == 400


def test_update_status_name(client: TestClient, auth: Dict[str, str]) -> None:
    s = create_status(client, "Draft", headers=auth)
    response = client.patch(
        f"/api/statuses/{s['id']}", json={"name": "Draft v2"}, headers=auth
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Draft v2"


def test_update_status_default_start(client: TestClient, auth: Dict[str, str]) -> None:
    statuses = client.get("/api/statuses", headers=auth).json()
    old_start = [s for s in statuses if s["isDefaultStart"]][0]

    new_s = create_status(client, "New Start", headers=auth)
    response = client.patch(
        f"/api/statuses/{new_s['id']}",
        json={"is_default_start": True},
        headers=auth,
    )
    assert response.status_code == 200
    assert response.json()["isDefaultStart"] is True

    old_response = client.get("/api/statuses", headers=auth)
    updated = {s["id"]: s for s in old_response.json()}
    assert updated[old_start["id"]]["isDefaultStart"] is False
    assert updated[new_s["id"]]["isDefaultStart"] is True


def test_update_status_default_end(client: TestClient, auth: Dict[str, str]) -> None:
    statuses = client.get("/api/statuses", headers=auth).json()
    old_end = [s for s in statuses if s["isDefaultEnd"]][0]

    new_s = create_status(client, "New End", headers=auth)
    response = client.patch(
        f"/api/statuses/{new_s['id']}",
        json={"is_default_end": True},
        headers=auth,
    )
    assert response.status_code == 200
    assert response.json()["isDefaultEnd"] is True

    updated = {s["id"]: s for s in client.get("/api/statuses", headers=auth).json()}
    assert updated[old_end["id"]]["isDefaultEnd"] is False
    assert updated[new_s["id"]]["isDefaultEnd"] is True


def test_update_status_not_found(client: TestClient, auth: Dict[str, str]) -> None:
    response = client.patch(
        "/api/statuses/nonexistent", json={"name": "X"}, headers=auth
    )
    assert response.status_code == 404


def test_update_status_empty_name_rejected(
    client: TestClient, auth: Dict[str, str]
) -> None:
    s = create_status(client, "Temp", headers=auth)
    response = client.patch(f"/api/statuses/{s['id']}", json={"name": ""}, headers=auth)
    assert response.status_code == 400

    response = client.patch(
        f"/api/statuses/{s['id']}", json={"name": "   "}, headers=auth
    )
    assert response.status_code == 400


def test_delete_status_no_todos(client: TestClient, auth: Dict[str, str]) -> None:
    s = create_status(client, "Disposable", headers=auth)
    response = client.delete(f"/api/statuses/{s['id']}", headers=auth)
    assert response.status_code == 204

    statuses = client.get("/api/statuses", headers=auth).json()
    ids = [st["id"] for st in statuses]
    assert s["id"] not in ids


def test_delete_default_start_rejected(
    client: TestClient, auth: Dict[str, str]
) -> None:
    statuses = client.get("/api/statuses", headers=auth).json()
    start_status = [s for s in statuses if s["isDefaultStart"]][0]
    response = client.delete(f"/api/statuses/{start_status['id']}", headers=auth)
    assert response.status_code == 400


def test_delete_default_end_rejected(client: TestClient, auth: Dict[str, str]) -> None:
    statuses = client.get("/api/statuses", headers=auth).json()
    end_status = [s for s in statuses if s["isDefaultEnd"]][0]
    response = client.delete(f"/api/statuses/{end_status['id']}", headers=auth)
    assert response.status_code == 400


def test_delete_status_not_found(client: TestClient, auth: Dict[str, str]) -> None:
    response = client.delete("/api/statuses/nonexistent", headers=auth)
    assert response.status_code == 404


def test_reorder_statuses(client: TestClient, auth: Dict[str, str]) -> None:
    statuses = client.get("/api/statuses", headers=auth).json()
    reorder_payload = [
        {"id": statuses[0]["id"], "sortOrder": 3.0},
        {"id": statuses[1]["id"], "sortOrder": 2.0},
        {"id": statuses[2]["id"], "sortOrder": 1.0},
    ]
    response = client.post("/api/statuses/reorder", json=reorder_payload, headers=auth)
    assert response.status_code == 200
    result = response.json()
    assert result[0]["name"] == "已完成"
    assert result[1]["name"] == "進行中"
    assert result[2]["name"] == "待辦"


# ---------------------------------------------------------------------------
# Todo CRUD helpers & tests
# ---------------------------------------------------------------------------


def create_todo(
    client: TestClient, title: str, headers: Dict[str, str] = None, **kwargs: Any
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"title": title}
    payload.update(kwargs)
    response = client.post("/api/todos", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


def test_todo_crud_flow(client: TestClient, auth: Dict[str, str]) -> None:
    todo = create_todo(
        client, "Buy milk", headers=auth, priority="high", tags=["groceries", "urgent"]
    )
    assert todo["title"] == "Buy milk"
    assert todo["priority"] == "high"
    assert todo["tags"] == ["groceries", "urgent"]
    assert todo["id"].startswith("todo_")
    statuses = client.get("/api/statuses", headers=auth).json()
    start_status = [s for s in statuses if s["isDefaultStart"]][0]
    assert todo["status"] == start_status["id"]

    response = client.get("/api/todos", headers=auth)
    assert response.status_code == 200
    assert len(response.json()) == 1

    other_status = [s for s in statuses if not s["isDefaultStart"]][0]
    response = client.patch(
        f"/api/todos/{todo['id']}",
        json={
            "title": "Buy oat milk",
            "status": other_status["id"],
        },
        headers=auth,
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "Buy oat milk"
    assert updated["status"] == other_status["id"]

    response = client.delete(f"/api/todos/{todo['id']}", headers=auth)
    assert response.status_code == 204

    response = client.get("/api/todos", headers=auth)
    assert response.status_code == 200
    assert len(response.json()) == 0


def test_todo_default_status_is_start(client: TestClient, auth: Dict[str, str]) -> None:
    statuses = client.get("/api/statuses", headers=auth).json()
    start_status = [s for s in statuses if s["isDefaultStart"]][0]

    todo = create_todo(client, "No status specified", headers=auth)
    assert todo["status"] == start_status["id"]


def test_todo_with_explicit_status(client: TestClient, auth: Dict[str, str]) -> None:
    statuses = client.get("/api/statuses", headers=auth).json()
    chosen = statuses[1]

    todo = create_todo(client, "Explicit status", headers=auth, status=chosen["id"])
    assert todo["status"] == chosen["id"]


def test_todo_invalid_status_rejected(client: TestClient, auth: Dict[str, str]) -> None:
    response = client.post(
        "/api/todos",
        json={
            "title": "Bad status",
            "status": "nonexistent",
        },
        headers=auth,
    )
    assert response.status_code == 400


def test_todo_update_invalid_status_rejected(
    client: TestClient, auth: Dict[str, str]
) -> None:
    todo = create_todo(client, "Will try bad update", headers=auth)
    response = client.patch(
        f"/api/todos/{todo['id']}",
        json={
            "status": "nonexistent",
        },
        headers=auth,
    )
    assert response.status_code == 400


def test_todo_linked_to_task(client: TestClient, auth: Dict[str, str]) -> None:
    project = create_project(client, "Link Project", headers=auth)
    task = create_task(client, project["id"], "Link Task", headers=auth)

    todo = create_todo(client, "Linked todo", headers=auth, linkedTaskId=task["id"])
    assert todo["linkedTaskId"] == task["id"]

    response = client.get(f"/api/tasks/{task['id']}/todos", headers=auth)
    assert response.status_code == 200
    todos = response.json()
    assert len(todos) == 1
    assert todos[0]["id"] == todo["id"]


def test_todo_unlinked_when_task_deleted(
    client: TestClient, auth: Dict[str, str]
) -> None:
    project = create_project(client, "Unlink Project", headers=auth)
    task = create_task(client, project["id"], "Unlink Task", headers=auth)

    todo = create_todo(
        client, "Will be unlinked", headers=auth, linkedTaskId=task["id"]
    )
    assert todo["linkedTaskId"] == task["id"]

    response = client.delete(f"/api/tasks/{task['id']}", headers=auth)
    assert response.status_code == 204

    response = client.get("/api/todos", headers=auth)
    assert response.status_code == 200
    todos = response.json()
    found = [t for t in todos if t["id"] == todo["id"]]
    assert len(found) == 1
    assert found[0]["linkedTaskId"] is None


def test_todo_not_found(client: TestClient, auth: Dict[str, str]) -> None:
    response = client.patch("/api/todos/nonexistent", json={"title": "X"}, headers=auth)
    assert response.status_code == 404

    response = client.delete("/api/todos/nonexistent", headers=auth)
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Todo Comment Tests
# ---------------------------------------------------------------------------


def test_todo_comments_included_in_todo(
    client: TestClient, auth: Dict[str, str]
) -> None:
    todo = create_todo(client, "Has comments field", headers=auth)
    assert "comments" in todo
    assert todo["comments"] == []


def test_todo_comment_crud(client: TestClient, auth: Dict[str, str]) -> None:
    todo = create_todo(client, "Commentable", headers=auth)

    resp = client.post(
        f"/api/todos/{todo['id']}/comments",
        json={"content": "First note"},
        headers=auth,
    )
    assert resp.status_code == 201
    comment = resp.json()
    assert comment["content"] == "First note"
    assert comment["todoId"] == todo["id"]
    assert comment["createdAt"] == comment["updatedAt"]

    todos = client.get("/api/todos", headers=auth).json()
    found = [t for t in todos if t["id"] == todo["id"]][0]
    assert len(found["comments"]) == 1
    assert found["comments"][0]["id"] == comment["id"]

    resp = client.patch(
        f"/api/todo-comments/{comment['id']}",
        json={"content": "Updated note"},
        headers=auth,
    )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["content"] == "Updated note"
    assert updated["updatedAt"] != updated["createdAt"]

    resp = client.delete(f"/api/todo-comments/{comment['id']}", headers=auth)
    assert resp.status_code == 204

    todos = client.get("/api/todos", headers=auth).json()
    found = [t for t in todos if t["id"] == todo["id"]][0]
    assert len(found["comments"]) == 0


def test_todo_comment_on_nonexistent_todo(
    client: TestClient, auth: Dict[str, str]
) -> None:
    resp = client.post(
        "/api/todos/nonexistent/comments", json={"content": "Nope"}, headers=auth
    )
    assert resp.status_code == 404


def test_todo_comment_not_found(client: TestClient, auth: Dict[str, str]) -> None:
    resp = client.patch(
        "/api/todo-comments/nonexistent", json={"content": "X"}, headers=auth
    )
    assert resp.status_code == 404

    resp = client.delete("/api/todo-comments/nonexistent", headers=auth)
    assert resp.status_code == 404


def test_todo_comments_cascade_on_delete(
    client: TestClient, auth: Dict[str, str]
) -> None:
    todo = create_todo(client, "Will be deleted", headers=auth)
    client.post(
        f"/api/todos/{todo['id']}/comments", json={"content": "Orphan?"}, headers=auth
    )

    resp = client.delete(f"/api/todos/{todo['id']}", headers=auth)
    assert resp.status_code == 204

    todos = client.get("/api/todos", headers=auth).json()
    for t in todos:
        for c in t.get("comments", []):
            assert c["todoId"] != todo["id"]


# ---------------------------------------------------------------------------
# Auth Tests
# ---------------------------------------------------------------------------


def test_bootstrap_creates_admin(client: TestClient) -> None:
    resp = client.get("/api/auth/status")
    assert resp.status_code == 200
    assert resp.json()["initialized"] is False

    resp = client.post(
        "/api/auth/bootstrap",
        json={"username": "admin1", "password": "password123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role"] == "admin"
    assert data["access_token"]
    assert data["refresh_token"]

    resp = client.get("/api/auth/status")
    assert resp.json()["initialized"] is True


def test_bootstrap_fails_when_users_exist(
    client: TestClient, auth: Dict[str, str]
) -> None:
    resp = client.post(
        "/api/auth/bootstrap",
        json={"username": "another", "password": "password123"},
    )
    assert resp.status_code == 403


def test_login_and_refresh(client: TestClient) -> None:
    # Bootstrap first
    client.post(
        "/api/auth/bootstrap",
        json={"username": "logintest", "password": "password123"},
    )

    # Login
    resp = client.post(
        "/api/auth/login",
        json={"username": "logintest", "password": "password123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"]
    refresh_token = data["refresh_token"]

    # Refresh
    resp = client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_login_wrong_password(client: TestClient) -> None:
    client.post(
        "/api/auth/bootstrap",
        json={"username": "wrongpw", "password": "password123"},
    )

    resp = client.post(
        "/api/auth/login",
        json={"username": "wrongpw", "password": "badpassword"},
    )
    assert resp.status_code == 401


def test_admin_can_create_users(client: TestClient, auth: Dict[str, str]) -> None:
    resp = client.post(
        "/api/auth/users",
        json={
            "username": "newmember",
            "display_name": "New Member",
            "password": "password123",
            "role": "member",
        },
        headers=auth,
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "member"

    users = client.get("/api/auth/users", headers=auth).json()
    assert len(users) == 2


def test_viewer_cannot_create_project(client: TestClient, auth: Dict[str, str]) -> None:
    # Create a viewer user
    client.post(
        "/api/auth/users",
        json={
            "username": "viewer1",
            "display_name": "Viewer",
            "password": "password123",
            "role": "viewer",
        },
        headers=auth,
    )
    # Login as viewer
    resp = client.post(
        "/api/auth/login",
        json={"username": "viewer1", "password": "password123"},
    )
    viewer_auth = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    # Viewer cannot create project
    resp = client.post("/api/projects", json={"name": "Forbidden"}, headers=viewer_auth)
    assert resp.status_code == 403

    # Viewer can list projects
    resp = client.get("/api/projects", headers=viewer_auth)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Auth: bootstrap validation
# ---------------------------------------------------------------------------


def test_bootstrap_short_username(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/bootstrap",
        json={"username": "ab", "password": "password123"},
    )
    assert resp.status_code == 400


def test_bootstrap_short_password(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/bootstrap",
        json={"username": "admin1", "password": "short"},
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Auth: login edge cases
# ---------------------------------------------------------------------------


def test_login_nonexistent_user(client: TestClient) -> None:
    client.post(
        "/api/auth/bootstrap",
        json={"username": "admin1", "password": "password123"},
    )
    resp = client.post(
        "/api/auth/login",
        json={"username": "ghost", "password": "password123"},
    )
    assert resp.status_code == 401


def test_login_inactive_user(client: TestClient, auth: Dict[str, str]) -> None:
    # Create a user, then deactivate them
    client.post(
        "/api/auth/users",
        json={
            "username": "inactive1",
            "display_name": "Inactive",
            "password": "password123",
            "role": "member",
        },
        headers=auth,
    )
    users = client.get("/api/auth/users", headers=auth).json()
    user_id = next(u["id"] for u in users if u["username"] == "inactive1")

    client.patch(
        f"/api/auth/users/{user_id}",
        json={"is_active": False},
        headers=auth,
    )

    resp = client.post(
        "/api/auth/login",
        json={"username": "inactive1", "password": "password123"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Auth: refresh token edge cases
# ---------------------------------------------------------------------------


def test_refresh_invalid_token(client: TestClient) -> None:
    client.post(
        "/api/auth/bootstrap",
        json={"username": "admin1", "password": "password123"},
    )
    resp = client.post(
        "/api/auth/refresh",
        json={"refresh_token": "totally-invalid-token"},
    )
    assert resp.status_code == 401


def test_refresh_revoked_token_revokes_all(client: TestClient) -> None:
    """Using a revoked refresh token triggers theft detection: all tokens revoked."""
    client.post(
        "/api/auth/bootstrap",
        json={"username": "admin1", "password": "password123"},
    )
    login_resp = client.post(
        "/api/auth/login",
        json={"username": "admin1", "password": "password123"},
    )
    token1 = login_resp.json()["refresh_token"]

    # Use token1 to refresh → token1 becomes revoked, get token2
    resp = client.post("/api/auth/refresh", json={"refresh_token": token1})
    assert resp.status_code == 200
    token2 = resp.json()["refresh_token"]

    # Re-use the revoked token1 → theft detection, all tokens revoked
    resp = client.post("/api/auth/refresh", json={"refresh_token": token1})
    assert resp.status_code == 401

    # Even token2 should now be revoked
    resp = client.post("/api/auth/refresh", json={"refresh_token": token2})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Auth: logout
# ---------------------------------------------------------------------------


def test_logout(client: TestClient) -> None:
    client.post(
        "/api/auth/bootstrap",
        json={"username": "admin1", "password": "password123"},
    )
    login_resp = client.post(
        "/api/auth/login",
        json={"username": "admin1", "password": "password123"},
    )
    data = login_resp.json()
    auth_header = {"Authorization": f"Bearer {data['access_token']}"}

    resp = client.post(
        "/api/auth/logout",
        json={"refresh_token": data["refresh_token"]},
        headers=auth_header,
    )
    assert resp.status_code == 204

    # Refresh token should be revoked after logout
    resp = client.post(
        "/api/auth/refresh",
        json={"refresh_token": data["refresh_token"]},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Auth: /me endpoints
# ---------------------------------------------------------------------------


def test_get_me(client: TestClient, auth: Dict[str, str]) -> None:
    resp = client.get("/api/auth/me", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "testadmin"
    assert data["role"] == "admin"


def test_update_me(client: TestClient) -> None:
    bootstrap_resp = client.post(
        "/api/auth/bootstrap",
        json={"username": "admin1", "password": "password123"},
    )
    auth_header = {"Authorization": f"Bearer {bootstrap_resp.json()['access_token']}"}

    resp = client.patch(
        "/api/auth/me",
        json={"display_name": "New Name", "email": "new@example.com"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    assert resp.json()["displayName"] == "New Name"
    assert resp.json()["email"] == "new@example.com"


def test_update_me_password(client: TestClient) -> None:
    bootstrap_resp = client.post(
        "/api/auth/bootstrap",
        json={"username": "admin1", "password": "password123"},
    )
    auth_header = {"Authorization": f"Bearer {bootstrap_resp.json()['access_token']}"}

    # Change password
    resp = client.patch(
        "/api/auth/me",
        json={"password": "newpassword456"},
        headers=auth_header,
    )
    assert resp.status_code == 200

    # Login with new password should work
    resp = client.post(
        "/api/auth/login",
        json={"username": "admin1", "password": "newpassword456"},
    )
    assert resp.status_code == 200


def test_update_me_no_changes(client: TestClient, auth: Dict[str, str]) -> None:
    resp = client.patch("/api/auth/me", json={}, headers=auth)
    assert resp.status_code == 200
    assert resp.json()["username"] == "testadmin"


# ---------------------------------------------------------------------------
# Auth: admin user management
# ---------------------------------------------------------------------------


def test_create_user_duplicate_username(
    client: TestClient, auth: Dict[str, str]
) -> None:
    client.post(
        "/api/auth/users",
        json={
            "username": "dupe",
            "display_name": "Dupe",
            "password": "password123",
            "role": "member",
        },
        headers=auth,
    )
    resp = client.post(
        "/api/auth/users",
        json={
            "username": "dupe",
            "display_name": "Dupe2",
            "password": "password456",
            "role": "member",
        },
        headers=auth,
    )
    assert resp.status_code == 409


def test_create_user_invalid_role(client: TestClient, auth: Dict[str, str]) -> None:
    resp = client.post(
        "/api/auth/users",
        json={
            "username": "badrole",
            "display_name": "Bad Role",
            "password": "password123",
            "role": "superadmin",
        },
        headers=auth,
    )
    assert resp.status_code == 400


def test_update_user_role(client: TestClient, auth: Dict[str, str]) -> None:
    resp = client.post(
        "/api/auth/users",
        json={
            "username": "roletest",
            "display_name": "Role Test",
            "password": "password123",
            "role": "member",
        },
        headers=auth,
    )
    user_id = resp.json()["id"]

    resp = client.patch(
        f"/api/auth/users/{user_id}",
        json={"role": "viewer"},
        headers=auth,
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "viewer"


def test_update_user_deactivate(client: TestClient, auth: Dict[str, str]) -> None:
    resp = client.post(
        "/api/auth/users",
        json={
            "username": "deact",
            "display_name": "Deactivate",
            "password": "password123",
            "role": "member",
        },
        headers=auth,
    )
    user_id = resp.json()["id"]

    resp = client.patch(
        f"/api/auth/users/{user_id}",
        json={"is_active": False},
        headers=auth,
    )
    assert resp.status_code == 200
    assert resp.json()["isActive"] is False


def test_update_user_invalid_role(client: TestClient, auth: Dict[str, str]) -> None:
    resp = client.post(
        "/api/auth/users",
        json={
            "username": "badrole2",
            "display_name": "Bad Role",
            "password": "password123",
            "role": "member",
        },
        headers=auth,
    )
    user_id = resp.json()["id"]

    resp = client.patch(
        f"/api/auth/users/{user_id}",
        json={"role": "superadmin"},
        headers=auth,
    )
    assert resp.status_code == 400


def test_update_user_not_found(client: TestClient, auth: Dict[str, str]) -> None:
    resp = client.patch(
        "/api/auth/users/nonexistent",
        json={"role": "viewer"},
        headers=auth,
    )
    assert resp.status_code == 404


def test_update_user_no_changes(client: TestClient, auth: Dict[str, str]) -> None:
    resp = client.post(
        "/api/auth/users",
        json={
            "username": "nochange",
            "display_name": "No Change",
            "password": "password123",
            "role": "member",
        },
        headers=auth,
    )
    user_id = resp.json()["id"]

    resp = client.patch(
        f"/api/auth/users/{user_id}",
        json={},
        headers=auth,
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "nochange"
