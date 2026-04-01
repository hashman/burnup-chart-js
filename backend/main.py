import json as _json
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
    allow_headers=["*"],
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
    progress: int = Field(default=0, ge=0, le=100)


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
    progress: Optional[int] = Field(default=None, ge=0, le=100)


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
    progress: int = 0
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


class StatusCreate(BaseModel):
    id: Optional[str] = None
    name: str
    sort_order: Optional[float] = None


class StatusUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[float] = None
    is_default_start: Optional[bool] = None
    is_default_end: Optional[bool] = None


class StatusOut(BaseModel):
    id: str
    name: str
    sortOrder: float
    isDefaultStart: bool
    isDefaultEnd: bool


class StatusReorderItem(BaseModel):
    id: str
    sortOrder: float


class StatusDelete(BaseModel):
    migrate_to: Optional[str] = None


class TodoCreate(BaseModel):
    id: Optional[str] = None
    title: str
    status: Optional[str] = None  # status id, defaults to start status at API level
    priority: str = "medium"
    dueDate: Optional[str] = None
    assignee: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    note: Optional[str] = None
    linkedTaskId: Optional[str] = None


class TodoUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    dueDate: Optional[str] = None
    assignee: Optional[str] = None
    tags: Optional[List[str]] = None
    note: Optional[str] = None
    linkedTaskId: Optional[str] = None
    sortOrder: Optional[float] = None


class TodoCommentCreate(BaseModel):
    content: str


class TodoCommentUpdate(BaseModel):
    content: str


class TodoCommentOut(BaseModel):
    id: str
    todoId: str
    content: str
    createdAt: str
    updatedAt: str


class TodoOut(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    dueDate: Optional[str] = None
    assignee: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    note: Optional[str] = None
    linkedTaskId: Optional[str] = None
    createdAt: str
    sortOrder: float
    comments: List[TodoCommentOut] = Field(default_factory=list)


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
    if os.environ.get("BURNUP_BACKUP_ENABLED", "").lower() in ("1", "true", "yes"):
        from backup import run_backup, start_backup_scheduler

        run_backup()
        start_backup_scheduler()


@app.on_event("shutdown")
def shutdown() -> None:
    """Shut down background services."""
    if os.environ.get("BURNUP_BACKUP_ENABLED", "").lower() in ("1", "true", "yes"):
        from backup import shutdown_backup_scheduler

        shutdown_backup_scheduler()


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
    return {"id": row["id"], "date": row["date"], "content": row["content"]}


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
        "progress": row["progress"],
        "logs": logs,
    }


def fetch_project(
    conn: sqlite3.Connection, project_id: str
) -> Optional[ProjectPayload]:
    """Fetch a project along with tasks and logs.

    Args:
        conn (sqlite3.Connection): SQLite connection.
        project_id (str): Project identifier.

    Returns:
        Optional[Dict[str, Any]]: Project payload or None if not found.
    """
    project_row = conn.execute(
        "SELECT id, name FROM projects WHERE id = ?", (project_id,)
    ).fetchone()
    if not project_row:
        return None

    task_rows = conn.execute(
        "SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at", (project_id,)
    ).fetchall()

    task_ids = [row["id"] for row in task_rows]
    logs_by_task: Dict[str, List[LogPayload]] = {task_id: [] for task_id in task_ids}
    if task_ids:
        placeholders = ",".join("?" for _ in task_ids)
        log_rows = conn.execute(
            f"SELECT * FROM logs WHERE task_id IN ({placeholders}) ORDER BY created_at",
            task_ids,
        ).fetchall()
        for row in log_rows:
            logs_by_task.setdefault(row["task_id"], []).append(row_to_log(row))

    tasks = [row_to_task(row, logs_by_task.get(row["id"], [])) for row in task_rows]

    return {"id": project_row["id"], "name": project_row["name"], "tasks": tasks}


def fetch_task(conn: sqlite3.Connection, task_id: str) -> Optional[TaskPayload]:
    """Fetch a task along with logs.

    Args:
        conn (sqlite3.Connection): SQLite connection.
        task_id (str): Task identifier.

    Returns:
        Optional[Dict[str, Any]]: Task payload or None if not found.
    """
    task_row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task_row:
        return None
    log_rows = conn.execute(
        "SELECT * FROM logs WHERE task_id = ? ORDER BY created_at", (task_id,)
    ).fetchall()
    logs = [row_to_log(row) for row in log_rows]
    return row_to_task(task_row, logs)


def row_to_status(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "sortOrder": row["sort_order"],
        "isDefaultStart": bool(row["is_default_start"]),
        "isDefaultEnd": bool(row["is_default_end"]),
    }


def row_to_todo_comment(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "todoId": row["todo_id"],
        "content": row["content"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def row_to_todo(
    row: sqlite3.Row, comments: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "status": row["status"],
        "priority": row["priority"],
        "dueDate": normalize_text(row["due_date"]) or None,
        "assignee": normalize_text(row["assignee"]) or None,
        "tags": _json.loads(row["tags"]) if row["tags"] else [],
        "note": normalize_text(row["note"]) or None,
        "linkedTaskId": normalize_text(row["linked_task_id"]) or None,
        "createdAt": row["created_at"],
        "sortOrder": row["sort_order"],
        "comments": comments or [],
    }


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
        task_rows = conn.execute("SELECT * FROM tasks ORDER BY created_at").fetchall()
        log_rows = conn.execute("SELECT * FROM logs ORDER BY created_at").fetchall()

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
            "tasks": tasks_by_project.get(row["id"], []),
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
    "/api/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED
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
            "SELECT 1 FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Project id already exists")

        conn.execute(
            "INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)",
            (project_id, payload.name, now),
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
            "SELECT 1 FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Project not found")

        if payload.name is not None:
            conn.execute(
                "UPDATE projects SET name = ? WHERE id = ?", (payload.name, project_id)
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
        result = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return None


@app.post(
    "/api/projects/{project_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
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
            "SELECT 1 FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        if not project_row:
            raise HTTPException(status_code=404, detail="Project not found")

        existing = conn.execute(
            "SELECT 1 FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Task id already exists")

        conn.execute(
            """
            INSERT INTO tasks (
                id, project_id, name, points, people, added_date, expected_start,
                expected_end, actual_start, actual_end, show_label, progress, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                payload.progress,
                now,
            ),
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
    if payload.progress is not None:
        fields.append("progress = ?")
        values.append(payload.progress)

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Task not found")

        if fields:
            values.append(task_id)
            conn.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", values)
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
        result = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return None


@app.post(
    "/api/tasks/{task_id}/logs",
    response_model=LogOut,
    status_code=status.HTTP_201_CREATED,
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
            "SELECT 1 FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        if not task_row:
            raise HTTPException(status_code=404, detail="Task not found")

        existing = conn.execute("SELECT 1 FROM logs WHERE id = ?", (log_id,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Log id already exists")

        conn.execute(
            "INSERT INTO logs (id, task_id, date, content, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (log_id, task_id, payload.date, payload.content, now),
        )
        conn.commit()

        log_row = conn.execute("SELECT * FROM logs WHERE id = ?", (log_id,)).fetchone()

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
        result = conn.execute("DELETE FROM logs WHERE id = ?", (log_id,))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    return None


# ---------------------------------------------------------------------------
# Status CRUD endpoints
# ---------------------------------------------------------------------------


@app.get("/api/statuses", response_model=List[StatusOut])
def list_statuses() -> List[Dict[str, Any]]:
    """Return all statuses ordered by sort_order."""
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM statuses ORDER BY sort_order").fetchall()
    return [row_to_status(row) for row in rows]


@app.post(
    "/api/statuses",
    response_model=StatusOut,
    status_code=status.HTTP_201_CREATED,
)
def create_status(payload: StatusCreate) -> Dict[str, Any]:
    """Create a new status."""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Status name must not be empty")

    status_id = payload.id or f"status_{uuid4().hex}"

    with get_connection() as conn:
        if payload.sort_order is not None:
            sort_order = payload.sort_order
        else:
            row = conn.execute(
                "SELECT MAX(sort_order) AS max_so FROM statuses"
            ).fetchone()
            max_so = row["max_so"] if row["max_so"] is not None else -1
            sort_order = max_so + 1

        conn.execute(
            "INSERT INTO statuses (id, name, sort_order, is_default_start, is_default_end) "
            "VALUES (?, ?, ?, 0, 0)",
            (status_id, name, sort_order),
        )
        conn.commit()

        new_row = conn.execute(
            "SELECT * FROM statuses WHERE id = ?", (status_id,)
        ).fetchone()

    return row_to_status(new_row)


@app.patch("/api/statuses/{status_id}", response_model=StatusOut)
def update_status(status_id: str, payload: StatusUpdate) -> Dict[str, Any]:
    """Update a status by id."""
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT * FROM statuses WHERE id = ?", (status_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Status not found")

        if payload.name is not None:
            stripped = payload.name.strip()
            if not stripped:
                raise HTTPException(
                    status_code=400, detail="Status name must not be empty"
                )

        fields: List[str] = []
        values: List[Any] = []

        if payload.name is not None:
            fields.append("name = ?")
            values.append(payload.name.strip())
        if payload.sort_order is not None:
            fields.append("sort_order = ?")
            values.append(payload.sort_order)

        # Handle is_default_start: clear old one first
        if payload.is_default_start is True:
            conn.execute("UPDATE statuses SET is_default_start = 0")
            fields.append("is_default_start = ?")
            values.append(1)
        elif payload.is_default_start is False:
            fields.append("is_default_start = ?")
            values.append(0)

        # Handle is_default_end: clear old one first
        if payload.is_default_end is True:
            conn.execute("UPDATE statuses SET is_default_end = 0")
            fields.append("is_default_end = ?")
            values.append(1)
        elif payload.is_default_end is False:
            fields.append("is_default_end = ?")
            values.append(0)

        if fields:
            values.append(status_id)
            conn.execute(
                f"UPDATE statuses SET {', '.join(fields)} WHERE id = ?", values
            )
            conn.commit()

        row = conn.execute(
            "SELECT * FROM statuses WHERE id = ?", (status_id,)
        ).fetchone()

    return row_to_status(row)


@app.delete("/api/statuses/{status_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_status(status_id: str, migrate_to: Optional[str] = None) -> None:
    """Delete a status by id."""
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT * FROM statuses WHERE id = ?", (status_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Status not found")

        # Reject if it's a default start or end status
        if existing["is_default_start"]:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the default start status",
            )
        if existing["is_default_end"]:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the default end status",
            )

        # Check if any todos use this status
        todo_count = conn.execute(
            "SELECT COUNT(*) FROM todos WHERE status = ?", (status_id,)
        ).fetchone()[0]

        if todo_count > 0:
            if not migrate_to:
                raise HTTPException(
                    status_code=400,
                    detail="Status has todos; provide migrate_to query param",
                )
            # Verify migrate_to status exists
            target = conn.execute(
                "SELECT 1 FROM statuses WHERE id = ?", (migrate_to,)
            ).fetchone()
            if not target:
                raise HTTPException(
                    status_code=400, detail="migrate_to status not found"
                )
            conn.execute(
                "UPDATE todos SET status = ? WHERE status = ?",
                (migrate_to, status_id),
            )

        conn.execute("DELETE FROM statuses WHERE id = ?", (status_id,))
        conn.commit()

    return None


@app.post("/api/statuses/reorder", response_model=List[StatusOut])
def reorder_statuses(items: List[StatusReorderItem]) -> List[Dict[str, Any]]:
    """Batch update sort_order for statuses."""
    with get_connection() as conn:
        for item in items:
            conn.execute(
                "UPDATE statuses SET sort_order = ? WHERE id = ?",
                (item.sortOrder, item.id),
            )
        conn.commit()
        rows = conn.execute("SELECT * FROM statuses ORDER BY sort_order").fetchall()
    return [row_to_status(row) for row in rows]


# ---------------------------------------------------------------------------
# Todo CRUD endpoints
# ---------------------------------------------------------------------------


def _fetch_todo_comments(
    conn: sqlite3.Connection, todo_ids: List[str]
) -> Dict[str, List[Dict[str, Any]]]:
    """Fetch comments for a list of todo IDs, grouped by todo_id."""
    if not todo_ids:
        return {}
    placeholders = ",".join("?" * len(todo_ids))
    rows = conn.execute(
        f"SELECT * FROM todo_comments WHERE todo_id IN ({placeholders}) ORDER BY created_at",
        todo_ids,
    ).fetchall()
    result: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        result.setdefault(row["todo_id"], []).append(row_to_todo_comment(row))
    return result


@app.get("/api/todos", response_model=List[TodoOut])
def list_todos() -> List[Dict[str, Any]]:
    """Return all todos ordered by sort_order, created_at."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM todos ORDER BY sort_order, created_at"
        ).fetchall()
        todo_ids = [r["id"] for r in rows]
        comments_map = _fetch_todo_comments(conn, todo_ids)
    return [row_to_todo(row, comments_map.get(row["id"], [])) for row in rows]


@app.post("/api/todos", response_model=TodoOut, status_code=status.HTTP_201_CREATED)
def create_todo(payload: TodoCreate) -> Dict[str, Any]:
    """Create a new todo with status validation."""
    todo_id = payload.id or f"todo_{uuid4().hex}"
    now = utc_now()

    with get_connection() as conn:
        # Resolve status
        if payload.status:
            valid = conn.execute(
                "SELECT 1 FROM statuses WHERE id = ?", (payload.status,)
            ).fetchone()
            if not valid:
                raise HTTPException(status_code=400, detail="Invalid status id")
            resolved_status = payload.status
        else:
            start_row = conn.execute(
                "SELECT id FROM statuses WHERE is_default_start = 1"
            ).fetchone()
            resolved_status = start_row["id"]

        # Validate linked task
        if payload.linkedTaskId:
            task_row = conn.execute(
                "SELECT 1 FROM tasks WHERE id = ?", (payload.linkedTaskId,)
            ).fetchone()
            if not task_row:
                raise HTTPException(status_code=404, detail="Linked task not found")

        conn.execute(
            """INSERT INTO todos (id, title, status, priority, due_date, assignee,
               tags, note, linked_task_id, created_at, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                todo_id,
                payload.title,
                resolved_status,
                payload.priority,
                payload.dueDate or "",
                payload.assignee or "",
                _json.dumps(payload.tags),
                payload.note or "",
                payload.linkedTaskId or None,
                now,
                0,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    return row_to_todo(row, [])


@app.patch("/api/todos/{todo_id}", response_model=TodoOut)
def update_todo(todo_id: str, payload: TodoUpdate) -> Dict[str, Any]:
    """Update a todo by id with status validation."""
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM todos WHERE id = ?", (todo_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Todo not found")

        fields: List[str] = []
        values: List[Any] = []

        if payload.title is not None:
            fields.append("title = ?")
            values.append(payload.title)
        if payload.status is not None:
            valid = conn.execute(
                "SELECT 1 FROM statuses WHERE id = ?", (payload.status,)
            ).fetchone()
            if not valid:
                raise HTTPException(status_code=400, detail="Invalid status id")
            fields.append("status = ?")
            values.append(payload.status)
        if payload.priority is not None:
            fields.append("priority = ?")
            values.append(payload.priority)
        if payload.dueDate is not None:
            fields.append("due_date = ?")
            values.append(payload.dueDate)
        if payload.assignee is not None:
            fields.append("assignee = ?")
            values.append(payload.assignee)
        if payload.tags is not None:
            fields.append("tags = ?")
            values.append(_json.dumps(payload.tags))
        if payload.note is not None:
            fields.append("note = ?")
            values.append(payload.note)
        if payload.linkedTaskId is not None:
            fields.append("linked_task_id = ?")
            values.append(payload.linkedTaskId)
        if payload.sortOrder is not None:
            fields.append("sort_order = ?")
            values.append(payload.sortOrder)

        if fields:
            values.append(todo_id)
            conn.execute(f"UPDATE todos SET {', '.join(fields)} WHERE id = ?", values)
            conn.commit()

        row = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
        comments = conn.execute(
            "SELECT * FROM todo_comments WHERE todo_id = ? ORDER BY created_at",
            (todo_id,),
        ).fetchall()
    return row_to_todo(row, [row_to_todo_comment(c) for c in comments])


@app.delete("/api/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(todo_id: str) -> None:
    """Delete a todo by id."""
    with get_connection() as conn:
        result = conn.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Todo not found")
    return None


@app.get("/api/tasks/{task_id}/todos", response_model=List[TodoOut])
def list_task_todos(task_id: str) -> List[Dict[str, Any]]:
    """Return all todos linked to a specific task."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM todos WHERE linked_task_id = ? ORDER BY sort_order, created_at",
            (task_id,),
        ).fetchall()
        todo_ids = [r["id"] for r in rows]
        comments_map = _fetch_todo_comments(conn, todo_ids)
    return [row_to_todo(row, comments_map.get(row["id"], [])) for row in rows]


# ---------------------------------------------------------------------------
# Todo Comment CRUD endpoints
# ---------------------------------------------------------------------------


@app.post(
    "/api/todos/{todo_id}/comments",
    response_model=TodoCommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_todo_comment(todo_id: str, payload: TodoCommentCreate) -> Dict[str, Any]:
    """Create a comment on a todo."""
    comment_id = f"tc_{uuid4().hex}"
    now = utc_now()
    with get_connection() as conn:
        todo_row = conn.execute(
            "SELECT 1 FROM todos WHERE id = ?", (todo_id,)
        ).fetchone()
        if not todo_row:
            raise HTTPException(status_code=404, detail="Todo not found")
        conn.execute(
            "INSERT INTO todo_comments (id, todo_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (comment_id, todo_id, payload.content, now, now),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM todo_comments WHERE id = ?", (comment_id,)
        ).fetchone()
    return row_to_todo_comment(row)


@app.patch("/api/todo-comments/{comment_id}", response_model=TodoCommentOut)
def update_todo_comment(comment_id: str, payload: TodoCommentUpdate) -> Dict[str, Any]:
    """Update a todo comment."""
    now = utc_now()
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM todo_comments WHERE id = ?", (comment_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Comment not found")
        conn.execute(
            "UPDATE todo_comments SET content = ?, updated_at = ? WHERE id = ?",
            (payload.content, now, comment_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM todo_comments WHERE id = ?", (comment_id,)
        ).fetchone()
    return row_to_todo_comment(row)


@app.delete("/api/todo-comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo_comment(comment_id: str) -> None:
    """Delete a todo comment."""
    with get_connection() as conn:
        result = conn.execute("DELETE FROM todo_comments WHERE id = ?", (comment_id,))
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Comment not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
