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
