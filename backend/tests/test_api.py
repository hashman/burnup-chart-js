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


def create_project(
    client: TestClient, name: str, project_id: str = ""
) -> Dict[str, Any]:
    """Create a project using the API.

    Args:
        client (TestClient): FastAPI test client.
        name (str): Project name.
        project_id (str): Optional explicit project id.

    Returns:
        Dict[str, Any]: Created project payload.

    Raises:
        AssertionError: If the API response is not successful.
    """
    payload: Dict[str, Any] = {"name": name}
    if project_id:
        payload["id"] = project_id
    response = client.post("/api/projects", json=payload)
    assert response.status_code == 201
    return response.json()


def create_task(
    client: TestClient, project_id: str, name: str, task_id: str = ""
) -> Dict[str, Any]:
    """Create a task using the API.

    Args:
        client (TestClient): FastAPI test client.
        project_id (str): Parent project id.
        name (str): Task name.
        task_id (str): Optional explicit task id.

    Returns:
        Dict[str, Any]: Created task payload.

    Raises:
        AssertionError: If the API response is not successful.
    """
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
    response = client.post(f"/api/projects/{project_id}/tasks", json=payload)
    assert response.status_code == 201
    return response.json()


def create_log(client: TestClient, task_id: str, content: str) -> Dict[str, Any]:
    """Create a log entry using the API.

    Args:
        client (TestClient): FastAPI test client.
        task_id (str): Parent task id.
        content (str): Log content.

    Returns:
        Dict[str, Any]: Created log payload.

    Raises:
        AssertionError: If the API response is not successful.
    """
    payload = {"date": "2024-01-10", "content": content}
    response = client.post(f"/api/tasks/{task_id}/logs", json=payload)
    assert response.status_code == 201
    return response.json()


@pytest.fixture()
def client(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Generator[TestClient, None, None]:
    """Provide a test client backed by an isolated SQLite database.

    Args:
        tmp_path (Path): Pytest temporary directory.
        monkeypatch (pytest.MonkeyPatch): Pytest monkeypatch fixture.

    Returns:
        Generator[TestClient, None, None]: Test client generator.
    """
    db_path = tmp_path / "test.sqlite3"
    monkeypatch.setattr(db, "DB_PATH", db_path)
    with TestClient(main.app) as test_client:
        yield test_client


def test_health_check_returns_ok(client: TestClient) -> None:
    """Verify that the health endpoint returns ok.

    Args:
        client (TestClient): FastAPI test client.

    Returns:
        None.

    Raises:
        AssertionError: If the response is not ok.
    """
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_project_crud_flow(client: TestClient) -> None:
    """Verify create, read, update, delete flow for projects.

    Args:
        client (TestClient): FastAPI test client.

    Returns:
        None.

    Raises:
        AssertionError: If the API flow does not behave as expected.
    """
    project = create_project(client, name="Alpha")
    project_id = project["id"]

    list_response = client.get("/api/projects")
    assert list_response.status_code == 200
    ids = [item["id"] for item in list_response.json()]
    assert project_id in ids

    get_response = client.get(f"/api/projects/{project_id}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "Alpha"

    update_response = client.patch(
        f"/api/projects/{project_id}", json={"name": "Alpha Updated"}
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Alpha Updated"

    delete_response = client.delete(f"/api/projects/{project_id}")
    assert delete_response.status_code == 204

    missing_response = client.get(f"/api/projects/{project_id}")
    assert missing_response.status_code == 404


def test_task_crud_flow(client: TestClient) -> None:
    """Verify create, update, delete flow for tasks.

    Args:
        client (TestClient): FastAPI test client.

    Returns:
        None.

    Raises:
        AssertionError: If the API flow does not behave as expected.
    """
    project = create_project(client, name="Task Project")
    project_id = project["id"]

    task = create_task(client, project_id=project_id, name="Design API")
    task_id = task["id"]
    assert task["showLabel"] is True

    update_response = client.patch(
        f"/api/tasks/{task_id}", json={"points": 8, "showLabel": False}
    )
    assert update_response.status_code == 200
    assert update_response.json()["points"] == 8
    assert update_response.json()["showLabel"] is False

    project_response = client.get(f"/api/projects/{project_id}")
    assert project_response.status_code == 200
    tasks = project_response.json()["tasks"]
    assert len(tasks) == 1
    assert tasks[0]["id"] == task_id

    delete_response = client.delete(f"/api/tasks/{task_id}")
    assert delete_response.status_code == 204

    project_response = client.get(f"/api/projects/{project_id}")
    assert project_response.status_code == 200
    assert project_response.json()["tasks"] == []


def test_log_crud_flow(client: TestClient) -> None:
    """Verify create and delete flow for logs.

    Args:
        client (TestClient): FastAPI test client.

    Returns:
        None.

    Raises:
        AssertionError: If the API flow does not behave as expected.
    """
    project = create_project(client, name="Log Project")
    task = create_task(client, project_id=project["id"], name="Write Docs")

    log = create_log(client, task_id=task["id"], content="First note")
    assert log["content"] == "First note"

    project_response = client.get(f"/api/projects/{project['id']}")
    assert project_response.status_code == 200
    tasks = project_response.json()["tasks"]
    assert len(tasks) == 1
    assert tasks[0]["logs"][0]["id"] == log["id"]

    delete_response = client.delete(f"/api/logs/{log['id']}")
    assert delete_response.status_code == 204

    project_response = client.get(f"/api/projects/{project['id']}")
    assert project_response.status_code == 200
    assert project_response.json()["tasks"][0]["logs"] == []


def test_duplicate_ids_return_conflict(client: TestClient) -> None:
    """Verify duplicate identifiers return conflict responses.

    Args:
        client (TestClient): FastAPI test client.

    Returns:
        None.

    Raises:
        AssertionError: If the API does not return conflict responses.
    """
    project_id = "proj_fixed"
    create_project(client, name="Primary", project_id=project_id)

    duplicate_project = client.post(
        "/api/projects", json={"id": project_id, "name": "Duplicate"}
    )
    assert duplicate_project.status_code == 409

    task_id = "task_fixed"
    create_task(client, project_id=project_id, name="Initial Task", task_id=task_id)
    duplicate_task = client.post(
        f"/api/projects/{project_id}/tasks",
        json={"id": task_id, "name": "Duplicate Task", "points": 1},
    )
    assert duplicate_task.status_code == 409


def test_missing_project_returns_404(client: TestClient) -> None:
    """Verify missing resources return 404 responses.

    Args:
        client (TestClient): FastAPI test client.

    Returns:
        None.

    Raises:
        AssertionError: If the API does not return 404 responses.
    """
    response = client.get("/api/projects/does-not-exist")
    assert response.status_code == 404

    response = client.post(
        "/api/projects/does-not-exist/tasks", json={"name": "Ghost Task", "points": 1}
    )
    assert response.status_code == 404


def test_statuses_table_exists(client: TestClient) -> None:
    """Verify that the statuses table is created on startup."""
    with db.get_connection() as conn:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='statuses'"
        ).fetchone()
    assert row is not None
    assert row["name"] == "statuses"


def test_default_statuses_seeded(client: TestClient) -> None:
    """Verify that 3 default statuses are seeded on startup."""
    with db.get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM statuses ORDER BY sort_order"
        ).fetchall()
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
    """Verify that the todos table is created on startup."""
    with db.get_connection() as conn:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='todos'"
        ).fetchone()
    assert row is not None
    assert row["name"] == "todos"


# ---------------------------------------------------------------------------
# Status CRUD helpers & tests
# ---------------------------------------------------------------------------

def create_status(client: TestClient, name: str, sort_order: float = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"name": name}
    if sort_order is not None:
        payload["sort_order"] = sort_order
    response = client.post("/api/statuses", json=payload)
    assert response.status_code == 201
    return response.json()


def test_list_statuses(client: TestClient) -> None:
    """GET /api/statuses returns default 3 statuses in order."""
    response = client.get("/api/statuses")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert data[0]["name"] == "待辦"
    assert data[1]["name"] == "進行中"
    assert data[2]["name"] == "已完成"
    # verify ordering
    assert data[0]["sortOrder"] < data[1]["sortOrder"] < data[2]["sortOrder"]


def test_create_status(client: TestClient) -> None:
    """POST /api/statuses creates a new status with auto sort_order."""
    s = create_status(client, "Review")
    assert s["name"] == "Review"
    assert s["id"].startswith("status_")
    assert s["isDefaultStart"] is False
    assert s["isDefaultEnd"] is False
    # sort_order should be after the max existing (2)
    assert s["sortOrder"] > 2


def test_create_status_with_sort_order(client: TestClient) -> None:
    """POST /api/statuses respects explicit sort_order."""
    s = create_status(client, "QA", sort_order=1.5)
    assert s["sortOrder"] == 1.5


def test_create_status_empty_name_rejected(client: TestClient) -> None:
    """POST /api/statuses rejects empty name with 400."""
    response = client.post("/api/statuses", json={"name": ""})
    assert response.status_code == 400

    response = client.post("/api/statuses", json={"name": "   "})
    assert response.status_code == 400


def test_update_status_name(client: TestClient) -> None:
    """PATCH /api/statuses/:id updates name."""
    s = create_status(client, "Draft")
    response = client.patch(f"/api/statuses/{s['id']}", json={"name": "Draft v2"})
    assert response.status_code == 200
    assert response.json()["name"] == "Draft v2"


def test_update_status_default_start(client: TestClient) -> None:
    """Setting is_default_start=true clears old start."""
    # Get current statuses
    statuses = client.get("/api/statuses").json()
    old_start = [s for s in statuses if s["isDefaultStart"]][0]

    new_s = create_status(client, "New Start")
    response = client.patch(
        f"/api/statuses/{new_s['id']}",
        json={"is_default_start": True},
    )
    assert response.status_code == 200
    assert response.json()["isDefaultStart"] is True

    # Old start should be cleared
    old_response = client.get("/api/statuses")
    updated = {s["id"]: s for s in old_response.json()}
    assert updated[old_start["id"]]["isDefaultStart"] is False
    assert updated[new_s["id"]]["isDefaultStart"] is True


def test_update_status_default_end(client: TestClient) -> None:
    """Setting is_default_end=true clears old end."""
    statuses = client.get("/api/statuses").json()
    old_end = [s for s in statuses if s["isDefaultEnd"]][0]

    new_s = create_status(client, "New End")
    response = client.patch(
        f"/api/statuses/{new_s['id']}",
        json={"is_default_end": True},
    )
    assert response.status_code == 200
    assert response.json()["isDefaultEnd"] is True

    updated = {s["id"]: s for s in client.get("/api/statuses").json()}
    assert updated[old_end["id"]]["isDefaultEnd"] is False
    assert updated[new_s["id"]]["isDefaultEnd"] is True


def test_update_status_not_found(client: TestClient) -> None:
    """PATCH /api/statuses/:id returns 404 for missing status."""
    response = client.patch("/api/statuses/nonexistent", json={"name": "X"})
    assert response.status_code == 404


def test_update_status_empty_name_rejected(client: TestClient) -> None:
    """PATCH /api/statuses/:id rejects empty name with 400."""
    s = create_status(client, "Temp")
    response = client.patch(f"/api/statuses/{s['id']}", json={"name": ""})
    assert response.status_code == 400

    response = client.patch(f"/api/statuses/{s['id']}", json={"name": "   "})
    assert response.status_code == 400


def test_delete_status_no_todos(client: TestClient) -> None:
    """DELETE /api/statuses/:id removes status with no todos."""
    s = create_status(client, "Disposable")
    response = client.delete(f"/api/statuses/{s['id']}")
    assert response.status_code == 204

    # Verify it's gone
    statuses = client.get("/api/statuses").json()
    ids = [st["id"] for st in statuses]
    assert s["id"] not in ids


def test_delete_default_start_rejected(client: TestClient) -> None:
    """DELETE rejects deleting the default start status with 400."""
    statuses = client.get("/api/statuses").json()
    start_status = [s for s in statuses if s["isDefaultStart"]][0]
    response = client.delete(f"/api/statuses/{start_status['id']}")
    assert response.status_code == 400


def test_delete_default_end_rejected(client: TestClient) -> None:
    """DELETE rejects deleting the default end status with 400."""
    statuses = client.get("/api/statuses").json()
    end_status = [s for s in statuses if s["isDefaultEnd"]][0]
    response = client.delete(f"/api/statuses/{end_status['id']}")
    assert response.status_code == 400


def test_delete_status_not_found(client: TestClient) -> None:
    """DELETE /api/statuses/:id returns 404 for missing status."""
    response = client.delete("/api/statuses/nonexistent")
    assert response.status_code == 404


def test_reorder_statuses(client: TestClient) -> None:
    """POST /api/statuses/reorder batch-updates sort_order."""
    statuses = client.get("/api/statuses").json()
    # Reverse the order
    reorder_payload = [
        {"id": statuses[0]["id"], "sortOrder": 3.0},
        {"id": statuses[1]["id"], "sortOrder": 2.0},
        {"id": statuses[2]["id"], "sortOrder": 1.0},
    ]
    response = client.post("/api/statuses/reorder", json=reorder_payload)
    assert response.status_code == 200
    result = response.json()
    # Should be returned in new order
    assert result[0]["name"] == "已完成"
    assert result[1]["name"] == "進行中"
    assert result[2]["name"] == "待辦"
