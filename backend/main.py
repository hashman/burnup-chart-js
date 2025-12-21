import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db import get_connection, init_db


app = FastAPI(title="Burnup Chart API")


def parse_cors_origins() -> List[str]:
    """Parse allowed CORS origins from the environment.

    Args:
        None.

    Returns:
        List[str]: Allowed origins for CORS.
    """
    raw = os.environ.get("BURNUP_CORS_ORIGINS", "")
    if raw.strip():
        return [item.strip() for item in raw.split(",") if item.strip()]
    return ["http://localhost:5173", "http://127.0.0.1:5173"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

LogPayload = Dict[str, str]
TaskPayload = Dict[str, Any]
ProjectPayload = Dict[str, Any]


class LogCreate(BaseModel):
    """Payload for creating a log entry.

    Args:
        id (Optional[str]): Optional log id override.
        date (str): Log date in YYYY-MM-DD format.
        content (str): Log content.

    Returns:
        None.
    """

    id: Optional[str] = None
    date: str
    content: str


class LogOut(BaseModel):
    """Output model for a log entry.

    Args:
        id (str): Log id.
        date (str): Log date.
        content (str): Log content.

    Returns:
        None.
    """

    id: str
    date: str
    content: str


class TaskCreate(BaseModel):
    """Payload for creating a task.

    Args:
        id (Optional[str]): Optional task id override.
        name (str): Task name.
        points (int): Story points for the task.
        people (str): Assigned people label.
        addedDate (str): Date the task was added.
        expectedStart (str): Expected start date.
        expectedEnd (str): Expected end date.
        actualStart (str): Actual start date.
        actualEnd (str): Actual end date.
        showLabel (bool): Whether to show label on the chart.

    Returns:
        None.
    """

    id: Optional[str] = None
    name: str
    points: int = Field(ge=0)
    people: str = ""
    addedDate: str = ""
    expectedStart: str = ""
    expectedEnd: str = ""
    actualStart: str = ""
    actualEnd: str = ""
    showLabel: bool = False


class TaskUpdate(BaseModel):
    """Payload for updating a task.

    Args:
        name (Optional[str]): Updated task name.
        points (Optional[int]): Updated story points.
        people (Optional[str]): Updated assigned people label.
        addedDate (Optional[str]): Updated added date.
        expectedStart (Optional[str]): Updated expected start date.
        expectedEnd (Optional[str]): Updated expected end date.
        actualStart (Optional[str]): Updated actual start date.
        actualEnd (Optional[str]): Updated actual end date.
        showLabel (Optional[bool]): Updated label display flag.

    Returns:
        None.
    """

    name: Optional[str] = None
    points: Optional[int] = Field(default=None, ge=0)
    people: Optional[str] = None
    addedDate: Optional[str] = None
    expectedStart: Optional[str] = None
    expectedEnd: Optional[str] = None
    actualStart: Optional[str] = None
    actualEnd: Optional[str] = None
    showLabel: Optional[bool] = None


class TaskOut(BaseModel):
    """Output model for a task.

    Args:
        id (str): Task id.
        name (str): Task name.
        points (int): Story points for the task.
        people (str): Assigned people label.
        addedDate (str): Date the task was added.
        expectedStart (str): Expected start date.
        expectedEnd (str): Expected end date.
        actualStart (str): Actual start date.
        actualEnd (str): Actual end date.
        showLabel (bool): Whether to show label on the chart.
        logs (List[LogOut]): Task log entries.

    Returns:
        None.
    """

    id: str
    name: str
    points: int
    people: str = ""
    addedDate: str = ""
    expectedStart: str = ""
    expectedEnd: str = ""
    actualStart: str = ""
    actualEnd: str = ""
    showLabel: bool = False
    logs: List[LogOut] = Field(default_factory=list)


class ProjectCreate(BaseModel):
    """Payload for creating a project.

    Args:
        id (Optional[str]): Optional project id override.
        name (str): Project name.

    Returns:
        None.
    """

    id: Optional[str] = None
    name: str


class ProjectUpdate(BaseModel):
    """Payload for updating a project.

    Args:
        name (Optional[str]): Updated project name.

    Returns:
        None.
    """

    name: Optional[str] = None


class ProjectOut(BaseModel):
    """Output model for a project.

    Args:
        id (str): Project id.
        name (str): Project name.
        tasks (List[TaskOut]): Tasks belonging to the project.

    Returns:
        None.
    """

    id: str
    name: str
    tasks: List[TaskOut] = Field(default_factory=list)


@app.on_event("startup")
def startup() -> None:
    """Initialize the application on startup.

    Args:
        None.

    Returns:
        None.

    Raises:
        sqlite3.Error: If database initialization fails.
    """
    init_db()


def utc_now() -> str:
    """Generate a UTC timestamp string.

    Args:
        None.

    Returns:
        str: ISO-8601 formatted UTC timestamp.
    """
    return datetime.utcnow().isoformat()


def normalize_text(value: Optional[str]) -> str:
    """Normalize optional text values into a string.

    Args:
        value (Optional[str]): Input text value.

    Returns:
        str: Normalized string, empty if input is falsy.
    """
    return value or ""


def row_to_log(row: sqlite3.Row) -> LogPayload:
    """Convert a log row to a serializable payload.

    Args:
        row (sqlite3.Row): SQLite row containing log data.

    Returns:
        Dict[str, str]: Log payload dictionary.
    """
    return {
        "id": row["id"],
        "date": row["date"],
        "content": row["content"]
    }


def row_to_task(row: sqlite3.Row, logs: List[LogPayload]) -> TaskPayload:
    """Convert a task row to a serializable payload.

    Args:
        row (sqlite3.Row): SQLite row containing task data.
        logs (List[Dict[str, str]]): Logs associated with the task.

    Returns:
        Dict[str, Any]: Task payload dictionary.
    """
    return {
        "id": row["id"],
        "name": row["name"],
        "points": row["points"],
        "people": normalize_text(row["people"]),
        "addedDate": normalize_text(row["added_date"]),
        "expectedStart": normalize_text(row["expected_start"]),
        "expectedEnd": normalize_text(row["expected_end"]),
        "actualStart": normalize_text(row["actual_start"]),
        "actualEnd": normalize_text(row["actual_end"]),
        "showLabel": bool(row["show_label"]),
        "logs": logs
    }


def fetch_project(
    conn: sqlite3.Connection,
    project_id: str
) -> Optional[ProjectPayload]:
    """Fetch a project along with tasks and logs.

    Args:
        conn (sqlite3.Connection): SQLite connection.
        project_id (str): Project identifier.

    Returns:
        Optional[Dict[str, Any]]: Project payload or None if not found.
    """
    project_row = conn.execute(
        "SELECT id, name FROM projects WHERE id = ?",
        (project_id,)
    ).fetchone()
    if not project_row:
        return None

    task_rows = conn.execute(
        "SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at",
        (project_id,)
    ).fetchall()

    task_ids = [row["id"] for row in task_rows]
    logs_by_task: Dict[str, List[LogPayload]] = {task_id: [] for task_id in task_ids}
    if task_ids:
        placeholders = ",".join("?" for _ in task_ids)
        log_rows = conn.execute(
            f"SELECT * FROM logs WHERE task_id IN ({placeholders}) ORDER BY created_at",
            task_ids
        ).fetchall()
        for row in log_rows:
            logs_by_task.setdefault(row["task_id"], []).append(row_to_log(row))

    tasks = [
        row_to_task(row, logs_by_task.get(row["id"], []))
        for row in task_rows
    ]

    return {
        "id": project_row["id"],
        "name": project_row["name"],
        "tasks": tasks
    }


def fetch_task(conn: sqlite3.Connection, task_id: str) -> Optional[TaskPayload]:
    """Fetch a task along with logs.

    Args:
        conn (sqlite3.Connection): SQLite connection.
        task_id (str): Task identifier.

    Returns:
        Optional[Dict[str, Any]]: Task payload or None if not found.
    """
    task_row = conn.execute(
        "SELECT * FROM tasks WHERE id = ?",
        (task_id,)
    ).fetchone()
    if not task_row:
        return None
    log_rows = conn.execute(
        "SELECT * FROM logs WHERE task_id = ? ORDER BY created_at",
        (task_id,)
    ).fetchall()
    logs = [row_to_log(row) for row in log_rows]
    return row_to_task(task_row, logs)


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    """Return basic health information.

    Args:
        None.

    Returns:
        Dict[str, str]: Health status payload.
    """
    return {"status": "ok"}


@app.get("/api/projects", response_model=List[ProjectOut])
def list_projects() -> List[ProjectPayload]:
    """List all projects with nested tasks and logs.

    Args:
        None.

    Returns:
        List[Dict[str, Any]]: List of project payloads.
    """
    with get_connection() as conn:
        project_rows = conn.execute(
            "SELECT id, name FROM projects ORDER BY created_at"
        ).fetchall()
        task_rows = conn.execute(
            "SELECT * FROM tasks ORDER BY created_at"
        ).fetchall()
        log_rows = conn.execute(
            "SELECT * FROM logs ORDER BY created_at"
        ).fetchall()

    logs_by_task: Dict[str, List[LogPayload]] = {}
    for row in log_rows:
        logs_by_task.setdefault(row["task_id"], []).append(row_to_log(row))

    tasks_by_project: Dict[str, List[TaskPayload]] = {}
    for row in task_rows:
        task = row_to_task(row, logs_by_task.get(row["id"], []))
        tasks_by_project.setdefault(row["project_id"], []).append(task)

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "tasks": tasks_by_project.get(row["id"], [])
        }
        for row in project_rows
    ]


@app.get("/api/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: str) -> ProjectPayload:
    """Fetch a single project by id.

    Args:
        project_id (str): Project identifier.

    Returns:
        Dict[str, Any]: Project payload.

    Raises:
        HTTPException: If the project does not exist.
    """
    with get_connection() as conn:
        project = fetch_project(conn, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.post(
    "/api/projects",
    response_model=ProjectOut,
    status_code=status.HTTP_201_CREATED
)
def create_project(payload: ProjectCreate) -> ProjectPayload:
    """Create a new project.

    Args:
        payload (ProjectCreate): Project creation payload.

    Returns:
        Dict[str, Any]: Newly created project payload.

    Raises:
        HTTPException: If the project id already exists.
    """
    project_id = payload.id or f"proj_{uuid4().hex}"
    now = utc_now()

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM projects WHERE id = ?",
            (project_id,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Project id already exists")

        conn.execute(
            "INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)",
            (project_id, payload.name, now)
        )
        conn.commit()
        project = fetch_project(conn, project_id)

    return project


@app.patch("/api/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectUpdate) -> ProjectPayload:
    """Update a project by id.

    Args:
        project_id (str): Project identifier.
        payload (ProjectUpdate): Project update payload.

    Returns:
        Dict[str, Any]: Updated project payload.

    Raises:
        HTTPException: If the project does not exist.
    """
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM projects WHERE id = ?",
            (project_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Project not found")

        if payload.name is not None:
            conn.execute(
                "UPDATE projects SET name = ? WHERE id = ?",
                (payload.name, project_id)
            )
            conn.commit()

        project = fetch_project(conn, project_id)

    return project


@app.delete("/api/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str) -> None:
    """Delete a project by id.

    Args:
        project_id (str): Project identifier.

    Returns:
        None.

    Raises:
        HTTPException: If the project does not exist.
    """
    with get_connection() as conn:
        result = conn.execute(
            "DELETE FROM projects WHERE id = ?",
            (project_id,)
        )
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return None


@app.post(
    "/api/projects/{project_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED
)
def create_task(project_id: str, payload: TaskCreate) -> TaskPayload:
    """Create a task under a project.

    Args:
        project_id (str): Project identifier.
        payload (TaskCreate): Task creation payload.

    Returns:
        Dict[str, Any]: Newly created task payload.

    Raises:
        HTTPException: If the project does not exist or task id is taken.
    """
    task_id = payload.id or f"task_{uuid4().hex}"
    now = utc_now()

    with get_connection() as conn:
        project_row = conn.execute(
            "SELECT 1 FROM projects WHERE id = ?",
            (project_id,)
        ).fetchone()
        if not project_row:
            raise HTTPException(status_code=404, detail="Project not found")

        existing = conn.execute(
            "SELECT 1 FROM tasks WHERE id = ?",
            (task_id,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Task id already exists")

        conn.execute(
            """
            INSERT INTO tasks (
                id, project_id, name, points, people, added_date, expected_start,
                expected_end, actual_start, actual_end, show_label, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                task_id,
                project_id,
                payload.name,
                payload.points,
                payload.people,
                payload.addedDate,
                payload.expectedStart,
                payload.expectedEnd,
                payload.actualStart,
                payload.actualEnd,
                1 if payload.showLabel else 0,
                now
            )
        )
        conn.commit()
        task = fetch_task(conn, task_id)

    return task


@app.patch("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate) -> TaskPayload:
    """Update a task by id.

    Args:
        task_id (str): Task identifier.
        payload (TaskUpdate): Task update payload.

    Returns:
        Dict[str, Any]: Updated task payload.

    Raises:
        HTTPException: If the task does not exist.
    """
    fields: List[str] = []
    values: List[Any] = []

    if payload.name is not None:
        fields.append("name = ?")
        values.append(payload.name)
    if payload.points is not None:
        fields.append("points = ?")
        values.append(payload.points)
    if payload.people is not None:
        fields.append("people = ?")
        values.append(payload.people)
    if payload.addedDate is not None:
        fields.append("added_date = ?")
        values.append(payload.addedDate)
    if payload.expectedStart is not None:
        fields.append("expected_start = ?")
        values.append(payload.expectedStart)
    if payload.expectedEnd is not None:
        fields.append("expected_end = ?")
        values.append(payload.expectedEnd)
    if payload.actualStart is not None:
        fields.append("actual_start = ?")
        values.append(payload.actualStart)
    if payload.actualEnd is not None:
        fields.append("actual_end = ?")
        values.append(payload.actualEnd)
    if payload.showLabel is not None:
        fields.append("show_label = ?")
        values.append(1 if payload.showLabel else 0)

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM tasks WHERE id = ?",
            (task_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Task not found")

        if fields:
            values.append(task_id)
            conn.execute(
                f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?",
                values
            )
            conn.commit()

        task = fetch_task(conn, task_id)

    return task


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: str) -> None:
    """Delete a task by id.

    Args:
        task_id (str): Task identifier.

    Returns:
        None.

    Raises:
        HTTPException: If the task does not exist.
    """
    with get_connection() as conn:
        result = conn.execute(
            "DELETE FROM tasks WHERE id = ?",
            (task_id,)
        )
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return None


@app.post(
    "/api/tasks/{task_id}/logs",
    response_model=LogOut,
    status_code=status.HTTP_201_CREATED
)
def create_log(task_id: str, payload: LogCreate) -> LogPayload:
    """Create a log entry for a task.

    Args:
        task_id (str): Task identifier.
        payload (LogCreate): Log creation payload.

    Returns:
        Dict[str, str]: Newly created log payload.

    Raises:
        HTTPException: If the task does not exist or log id is taken.
    """
    log_id = payload.id or f"log_{uuid4().hex}"
    now = utc_now()

    with get_connection() as conn:
        task_row = conn.execute(
            "SELECT 1 FROM tasks WHERE id = ?",
            (task_id,)
        ).fetchone()
        if not task_row:
            raise HTTPException(status_code=404, detail="Task not found")

        existing = conn.execute(
            "SELECT 1 FROM logs WHERE id = ?",
            (log_id,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Log id already exists")

        conn.execute(
            "INSERT INTO logs (id, task_id, date, content, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (log_id, task_id, payload.date, payload.content, now)
        )
        conn.commit()

        log_row = conn.execute(
            "SELECT * FROM logs WHERE id = ?",
            (log_id,)
        ).fetchone()

    return row_to_log(log_row)


@app.delete("/api/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log(log_id: str) -> None:
    """Delete a log entry by id.

    Args:
        log_id (str): Log identifier.

    Returns:
        None.

    Raises:
        HTTPException: If the log entry does not exist.
    """
    with get_connection() as conn:
        result = conn.execute(
            "DELETE FROM logs WHERE id = ?",
            (log_id,)
        )
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    return None


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
