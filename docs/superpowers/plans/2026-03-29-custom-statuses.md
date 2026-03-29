# Custom Statuses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to customize Kanban statuses (rename, add, delete, reorder) via inline editing on the board, backed by a `statuses` table in SQLite.

**Architecture:** New `statuses` table stores global status definitions. Todo's `status` field changes from a hardcoded string to a FK referencing `statuses.id`. Backend provides CRUD + reorder endpoints. Frontend `TodoBoard` renders columns dynamically from the statuses API and supports inline editing, adding, deleting, and drag-reorder of columns.

**Tech Stack:** FastAPI + SQLite (backend), React + Tailwind CSS + Lucide icons (frontend), Pytest (backend tests), Playwright (e2e)

**Dependency:** This plan builds on top of the completed Todo List feature (see `docs/superpowers/plans/2026-03-29-todo-list.md`). All Todo CRUD endpoints and frontend components must be working before starting this plan.

---

## File Structure

### Backend
| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `backend/db.py` | Add `statuses` table schema + seed default data + migrate todos |
| Modify | `backend/main.py` | Add Status Pydantic models, CRUD endpoints, reorder endpoint, update todo validation |
| Modify | `backend/tests/test_api.py` | Add status API tests |

### Frontend
| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/components/TodoBoard.jsx` | Dynamic columns from statuses, inline edit/add/delete/reorder columns |
| Modify | `src/App.jsx` | Load statuses state, pass to TodoBoard, update todo creation to use status id |

### E2E
| Action | File | Responsibility |
|--------|------|---------------|
| Create | `e2e/custom-statuses.spec.js` | Playwright tests for status CRUD, inline editing, drag-reorder |

---

### Task 1: Backend — `statuses` table schema + seed data

**Files:**
- Modify: `backend/db.py:31-75`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_api.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_api.py::test_statuses_table_exists tests/test_api.py::test_default_statuses_seeded -v`
Expected: FAIL — `statuses` table does not exist.

- [ ] **Step 3: Add statuses table and seed logic to db.py**

In `backend/db.py`, add `from uuid import uuid4` at the top. Then inside `init_db()`, after the existing `conn.executescript(...)` block (after line 74), add:

```python
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS statuses (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sort_order REAL NOT NULL DEFAULT 0,
                is_default_start INTEGER NOT NULL DEFAULT 0,
                is_default_end INTEGER NOT NULL DEFAULT 0
            );
            """
        )

        # Seed default statuses if table is empty
        count = conn.execute("SELECT COUNT(*) as c FROM statuses").fetchone()["c"]
        if count == 0:
            defaults = [
                (f"status_{uuid4().hex}", "待辦", 0, 1, 0),
                (f"status_{uuid4().hex}", "進行中", 1, 0, 0),
                (f"status_{uuid4().hex}", "已完成", 2, 0, 1),
            ]
            conn.executemany(
                "INSERT INTO statuses (id, name, sort_order, is_default_start, is_default_end) VALUES (?, ?, ?, ?, ?)",
                defaults,
            )
            conn.commit()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_api.py::test_statuses_table_exists tests/test_api.py::test_default_statuses_seeded -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/db.py backend/tests/test_api.py
git commit -m "feat(backend): add statuses table schema with default seed data"
```

---

### Task 2: Backend — Status Pydantic models + helper

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add Pydantic models to main.py**

Add after the `ProjectOut` model (after line 214 — or after `TodoOut` if todo plan is already implemented):

```python
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
```

- [ ] **Step 2: Add row_to_status helper**

Add after the existing `row_to_todo` helper (or after `row_to_task` if todo is not yet implemented):

```python
def row_to_status(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "sortOrder": row["sort_order"],
        "isDefaultStart": bool(row["is_default_start"]),
        "isDefaultEnd": bool(row["is_default_end"]),
    }
```

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add Status pydantic models and row_to_status helper"
```

---

### Task 3: Backend — GET /api/statuses endpoint

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Write the failing test**

Add a helper and test to `backend/tests/test_api.py`:

```python
def test_list_statuses(client: TestClient) -> None:
    """GET /api/statuses returns default statuses ordered by sort_order."""
    response = client.get("/api/statuses")
    assert response.status_code == 200
    statuses = response.json()
    assert len(statuses) == 3
    assert statuses[0]["name"] == "待辦"
    assert statuses[0]["isDefaultStart"] is True
    assert statuses[1]["name"] == "進行中"
    assert statuses[2]["name"] == "已完成"
    assert statuses[2]["isDefaultEnd"] is True
    # Verify ordering
    assert statuses[0]["sortOrder"] < statuses[1]["sortOrder"] < statuses[2]["sortOrder"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_api.py::test_list_statuses -v`
Expected: FAIL — 404, endpoint does not exist.

- [ ] **Step 3: Add GET /api/statuses endpoint**

Add to `backend/main.py`:

```python
@app.get("/api/statuses", response_model=List[StatusOut])
def list_statuses() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM statuses ORDER BY sort_order"
        ).fetchall()
    return [row_to_status(row) for row in rows]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_api.py::test_list_statuses -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat(backend): add GET /api/statuses endpoint"
```

---

### Task 4: Backend — POST /api/statuses endpoint

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_api.py`:

```python
def test_create_status(client: TestClient) -> None:
    """POST /api/statuses creates a new status."""
    response = client.post("/api/statuses", json={"name": "Review"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Review"
    assert data["isDefaultStart"] is False
    assert data["isDefaultEnd"] is False
    # Should appear in list
    all_statuses = client.get("/api/statuses").json()
    assert any(s["id"] == data["id"] for s in all_statuses)


def test_create_status_with_sort_order(client: TestClient) -> None:
    """POST /api/statuses respects explicit sort_order."""
    response = client.post("/api/statuses", json={"name": "QA", "sort_order": 1.5})
    assert response.status_code == 201
    data = response.json()
    assert data["sortOrder"] == 1.5


def test_create_status_empty_name_rejected(client: TestClient) -> None:
    """POST /api/statuses rejects empty name."""
    response = client.post("/api/statuses", json={"name": ""})
    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_api.py::test_create_status tests/test_api.py::test_create_status_with_sort_order tests/test_api.py::test_create_status_empty_name_rejected -v`
Expected: FAIL

- [ ] **Step 3: Add POST /api/statuses endpoint**

Add to `backend/main.py`:

```python
@app.post("/api/statuses", response_model=StatusOut, status_code=status.HTTP_201_CREATED)
def create_status(payload: StatusCreate) -> Dict[str, Any]:
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Status name cannot be empty")

    status_id = payload.id or f"status_{uuid4().hex}"

    with get_connection() as conn:
        if payload.sort_order is not None:
            sort_order = payload.sort_order
        else:
            row = conn.execute("SELECT MAX(sort_order) as max_order FROM statuses").fetchone()
            sort_order = (row["max_order"] or 0) + 1

        conn.execute(
            "INSERT INTO statuses (id, name, sort_order, is_default_start, is_default_end) VALUES (?, ?, ?, 0, 0)",
            (status_id, payload.name.strip(), sort_order),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM statuses WHERE id = ?", (status_id,)).fetchone()

    return row_to_status(row)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_api.py::test_create_status tests/test_api.py::test_create_status_with_sort_order tests/test_api.py::test_create_status_empty_name_rejected -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat(backend): add POST /api/statuses endpoint"
```

---

### Task 5: Backend — PATCH /api/statuses/:id endpoint

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_api.py`:

```python
def test_update_status_name(client: TestClient) -> None:
    """PATCH /api/statuses/:id updates the name."""
    statuses = client.get("/api/statuses").json()
    first = statuses[0]
    response = client.patch(f"/api/statuses/{first['id']}", json={"name": "Backlog"})
    assert response.status_code == 200
    assert response.json()["name"] == "Backlog"


def test_update_status_default_start(client: TestClient) -> None:
    """Setting is_default_start on one status clears the old one."""
    statuses = client.get("/api/statuses").json()
    old_start = next(s for s in statuses if s["isDefaultStart"])
    new_start = next(s for s in statuses if not s["isDefaultStart"] and not s["isDefaultEnd"])

    response = client.patch(f"/api/statuses/{new_start['id']}", json={"is_default_start": True})
    assert response.status_code == 200
    assert response.json()["isDefaultStart"] is True

    # Old start should be cleared
    old = client.get("/api/statuses").json()
    old_start_now = next(s for s in old if s["id"] == old_start["id"])
    assert old_start_now["isDefaultStart"] is False


def test_update_status_default_end(client: TestClient) -> None:
    """Setting is_default_end on one status clears the old one."""
    statuses = client.get("/api/statuses").json()
    old_end = next(s for s in statuses if s["isDefaultEnd"])
    new_end = next(s for s in statuses if not s["isDefaultEnd"] and not s["isDefaultStart"])

    response = client.patch(f"/api/statuses/{new_end['id']}", json={"is_default_end": True})
    assert response.status_code == 200
    assert response.json()["isDefaultEnd"] is True

    old = client.get("/api/statuses").json()
    old_end_now = next(s for s in old if s["id"] == old_end["id"])
    assert old_end_now["isDefaultEnd"] is False


def test_update_status_not_found(client: TestClient) -> None:
    """PATCH /api/statuses/:id returns 404 for unknown id."""
    response = client.patch("/api/statuses/nonexistent", json={"name": "X"})
    assert response.status_code == 404


def test_update_status_empty_name_rejected(client: TestClient) -> None:
    """PATCH /api/statuses/:id rejects empty name."""
    statuses = client.get("/api/statuses").json()
    response = client.patch(f"/api/statuses/{statuses[0]['id']}", json={"name": ""})
    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_api.py -k "test_update_status" -v`
Expected: FAIL

- [ ] **Step 3: Add PATCH /api/statuses/:id endpoint**

Add to `backend/main.py`:

```python
@app.patch("/api/statuses/{status_id}", response_model=StatusOut)
def update_status(status_id: str, payload: StatusUpdate) -> Dict[str, Any]:
    with get_connection() as conn:
        existing = conn.execute("SELECT * FROM statuses WHERE id = ?", (status_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Status not found")

        if payload.name is not None and not payload.name.strip():
            raise HTTPException(status_code=400, detail="Status name cannot be empty")

        fields: List[str] = []
        values: List[Any] = []

        if payload.name is not None:
            fields.append("name = ?")
            values.append(payload.name.strip())
        if payload.sort_order is not None:
            fields.append("sort_order = ?")
            values.append(payload.sort_order)

        if payload.is_default_start is True:
            conn.execute("UPDATE statuses SET is_default_start = 0 WHERE is_default_start = 1")
            fields.append("is_default_start = ?")
            values.append(1)
        elif payload.is_default_start is False:
            fields.append("is_default_start = ?")
            values.append(0)

        if payload.is_default_end is True:
            conn.execute("UPDATE statuses SET is_default_end = 0 WHERE is_default_end = 1")
            fields.append("is_default_end = ?")
            values.append(1)
        elif payload.is_default_end is False:
            fields.append("is_default_end = ?")
            values.append(0)

        if fields:
            values.append(status_id)
            conn.execute(f"UPDATE statuses SET {', '.join(fields)} WHERE id = ?", values)
            conn.commit()

        row = conn.execute("SELECT * FROM statuses WHERE id = ?", (status_id,)).fetchone()

    return row_to_status(row)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_api.py -k "test_update_status" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat(backend): add PATCH /api/statuses/:id endpoint"
```

---

### Task 6: Backend — DELETE /api/statuses/:id endpoint

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Write the failing tests**

Add a helper to create a status via API, then add tests:

```python
def create_status(client: TestClient, name: str, sort_order: float = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"name": name}
    if sort_order is not None:
        payload["sort_order"] = sort_order
    response = client.post("/api/statuses", json=payload)
    assert response.status_code == 201
    return response.json()


def test_delete_status_no_todos(client: TestClient) -> None:
    """DELETE /api/statuses/:id deletes a status with no todos."""
    new_status = create_status(client, "Review")
    response = client.request("DELETE", f"/api/statuses/{new_status['id']}")
    assert response.status_code == 204
    all_statuses = client.get("/api/statuses").json()
    assert not any(s["id"] == new_status["id"] for s in all_statuses)


def test_delete_default_start_rejected(client: TestClient) -> None:
    """Cannot delete the only default-start status."""
    statuses = client.get("/api/statuses").json()
    start = next(s for s in statuses if s["isDefaultStart"])
    response = client.request("DELETE", f"/api/statuses/{start['id']}")
    assert response.status_code == 400


def test_delete_default_end_rejected(client: TestClient) -> None:
    """Cannot delete the only default-end status."""
    statuses = client.get("/api/statuses").json()
    end = next(s for s in statuses if s["isDefaultEnd"])
    response = client.request("DELETE", f"/api/statuses/{end['id']}")
    assert response.status_code == 400


def test_delete_status_not_found(client: TestClient) -> None:
    """DELETE /api/statuses/:id returns 404 for unknown id."""
    response = client.request("DELETE", "/api/statuses/nonexistent")
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_api.py -k "test_delete_status" -v`
Expected: FAIL

- [ ] **Step 3: Add DELETE /api/statuses/:id endpoint**

Add to `backend/main.py`:

```python
@app.delete("/api/statuses/{status_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_status(status_id: str, migrate_to: Optional[str] = None) -> None:
    with get_connection() as conn:
        existing = conn.execute("SELECT * FROM statuses WHERE id = ?", (status_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Status not found")

        if existing["is_default_start"]:
            raise HTTPException(status_code=400, detail="Cannot delete the default start status. Assign another status as start first.")
        if existing["is_default_end"]:
            raise HTTPException(status_code=400, detail="Cannot delete the default end status. Assign another status as end first.")

        # Check if any todos use this status
        todo_count = conn.execute(
            "SELECT COUNT(*) as c FROM todos WHERE status = ?", (status_id,)
        ).fetchone()["c"]

        if todo_count > 0:
            if not migrate_to:
                raise HTTPException(status_code=400, detail="Status has todos. Provide migrate_to parameter.")
            target = conn.execute("SELECT 1 FROM statuses WHERE id = ?", (migrate_to,)).fetchone()
            if not target:
                raise HTTPException(status_code=400, detail="migrate_to status not found")
            if migrate_to == status_id:
                raise HTTPException(status_code=400, detail="Cannot migrate to the same status being deleted")
            conn.execute("UPDATE todos SET status = ? WHERE status = ?", (migrate_to, status_id))

        conn.execute("DELETE FROM statuses WHERE id = ?", (status_id,))
        conn.commit()

    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_api.py -k "test_delete_status" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat(backend): add DELETE /api/statuses/:id endpoint with migration"
```

---

### Task 7: Backend — DELETE with todo migration test

**Files:**
- Modify: `backend/tests/test_api.py`

This task adds tests that verify the migration logic when deleting a status that has todos.

- [ ] **Step 1: Write the migration tests**

Add to `backend/tests/test_api.py` (requires the todo API helpers from the todo plan — `create_todo` helper):

```python
def create_todo(client: TestClient, title: str, status_id: str = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"title": title}
    if status_id:
        payload["status"] = status_id
    response = client.post("/api/todos", json=payload)
    assert response.status_code == 201
    return response.json()


def test_delete_status_with_todos_requires_migrate_to(client: TestClient) -> None:
    """Deleting a status with todos without migrate_to returns 400."""
    custom = create_status(client, "Review")
    create_todo(client, "Test todo", status_id=custom["id"])
    response = client.request("DELETE", f"/api/statuses/{custom['id']}")
    assert response.status_code == 400
    assert "migrate_to" in response.json()["detail"].lower()


def test_delete_status_with_todos_migrates(client: TestClient) -> None:
    """Deleting a status with migrate_to moves todos to target status."""
    statuses = client.get("/api/statuses").json()
    start_status = next(s for s in statuses if s["isDefaultStart"])
    custom = create_status(client, "Review")
    todo = create_todo(client, "Migrating todo", status_id=custom["id"])

    response = client.request(
        "DELETE",
        f"/api/statuses/{custom['id']}",
        params={"migrate_to": start_status["id"]},
    )
    assert response.status_code == 204

    # Verify todo was migrated
    todos = client.get("/api/todos").json()
    migrated = next(t for t in todos if t["id"] == todo["id"])
    assert migrated["status"] == start_status["id"]
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_api.py::test_delete_status_with_todos_requires_migrate_to tests/test_api.py::test_delete_status_with_todos_migrates -v`
Expected: PASS (endpoints already implemented in Task 6)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_api.py
git commit -m "test(backend): add status deletion with todo migration tests"
```

---

### Task 8: Backend — POST /api/statuses/reorder endpoint

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_api.py`:

```python
def test_reorder_statuses(client: TestClient) -> None:
    """POST /api/statuses/reorder batch-updates sort_order."""
    statuses = client.get("/api/statuses").json()
    # Reverse the order
    reorder_payload = [
        {"id": statuses[2]["id"], "sortOrder": 0},
        {"id": statuses[1]["id"], "sortOrder": 1},
        {"id": statuses[0]["id"], "sortOrder": 2},
    ]
    response = client.post("/api/statuses/reorder", json=reorder_payload)
    assert response.status_code == 200
    updated = response.json()
    assert updated[0]["id"] == statuses[2]["id"]
    assert updated[1]["id"] == statuses[1]["id"]
    assert updated[2]["id"] == statuses[0]["id"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_api.py::test_reorder_statuses -v`
Expected: FAIL

- [ ] **Step 3: Add POST /api/statuses/reorder endpoint**

Add to `backend/main.py`:

```python
@app.post("/api/statuses/reorder", response_model=List[StatusOut])
def reorder_statuses(items: List[StatusReorderItem]) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        for item in items:
            conn.execute(
                "UPDATE statuses SET sort_order = ? WHERE id = ?",
                (item.sortOrder, item.id),
            )
        conn.commit()
        rows = conn.execute("SELECT * FROM statuses ORDER BY sort_order").fetchall()
    return [row_to_status(row) for row in rows]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_api.py::test_reorder_statuses -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat(backend): add POST /api/statuses/reorder endpoint"
```

---

### Task 9: Backend — Update todo status field to use status id

**Files:**
- Modify: `backend/db.py`
- Modify: `backend/main.py`
- Modify: `backend/tests/test_api.py`

This task changes the todo's `status` field from hardcoded strings to status IDs. The `todos` table's `status` column becomes a FK to `statuses.id`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_api.py`:

```python
def test_create_todo_with_status_id(client: TestClient) -> None:
    """Creating a todo with a valid status id succeeds."""
    statuses = client.get("/api/statuses").json()
    start_status = next(s for s in statuses if s["isDefaultStart"])
    todo = create_todo(client, "Status id todo", status_id=start_status["id"])
    assert todo["status"] == start_status["id"]


def test_create_todo_default_status_is_start(client: TestClient) -> None:
    """Creating a todo without explicit status uses the default-start status."""
    response = client.post("/api/todos", json={"title": "Auto status"})
    assert response.status_code == 201
    todo = response.json()
    statuses = client.get("/api/statuses").json()
    start_status = next(s for s in statuses if s["isDefaultStart"])
    assert todo["status"] == start_status["id"]


def test_create_todo_invalid_status_rejected(client: TestClient) -> None:
    """Creating a todo with invalid status id returns 400."""
    response = client.post("/api/todos", json={"title": "Bad status", "status": "nonexistent"})
    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_api.py::test_create_todo_with_status_id tests/test_api.py::test_create_todo_default_status_is_start tests/test_api.py::test_create_todo_invalid_status_rejected -v`
Expected: FAIL (todo creation currently accepts any string)

- [ ] **Step 3: Update todo creation to validate and default to start status**

In `backend/main.py`, modify the `create_todo` endpoint. Before the INSERT statement, add status validation:

```python
# In create_todo endpoint, before INSERT:
with get_connection() as conn:
    # Resolve default status if not provided or if provided as legacy string
    if not payload.status or payload.status in ("todo", "in_progress", "done"):
        # Look up the default start status
        start_row = conn.execute(
            "SELECT id FROM statuses WHERE is_default_start = 1"
        ).fetchone()
        if payload.status == "in_progress":
            mid_row = conn.execute(
                "SELECT id FROM statuses WHERE is_default_start = 0 AND is_default_end = 0 ORDER BY sort_order LIMIT 1"
            ).fetchone()
            resolved_status = mid_row["id"] if mid_row else start_row["id"]
        elif payload.status == "done":
            end_row = conn.execute(
                "SELECT id FROM statuses WHERE is_default_end = 1"
            ).fetchone()
            resolved_status = end_row["id"]
        else:
            resolved_status = start_row["id"]
    else:
        # Validate that status id exists
        valid = conn.execute("SELECT 1 FROM statuses WHERE id = ?", (payload.status,)).fetchone()
        if not valid:
            raise HTTPException(status_code=400, detail="Invalid status id")
        resolved_status = payload.status
```

Then use `resolved_status` instead of `payload.status` in the INSERT statement.

Also update the `update_todo` endpoint to validate the status field similarly — if `payload.status` is provided in PATCH, verify it exists in `statuses`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_api.py::test_create_todo_with_status_id tests/test_api.py::test_create_todo_default_status_is_start tests/test_api.py::test_create_todo_invalid_status_rejected -v`
Expected: PASS

- [ ] **Step 5: Run all backend tests to ensure nothing is broken**

Run: `cd backend && python -m pytest tests/test_api.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/db.py backend/main.py backend/tests/test_api.py
git commit -m "feat(backend): validate todo status against statuses table"
```

---

### Task 10: Frontend — Load statuses and pass to TodoBoard

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add statuses state and loading logic**

In `src/App.jsx`, add state for statuses near the other useState declarations:

```javascript
const [statuses, setStatuses] = useState([]);
```

In the `useEffect` that loads data on mount (where projects are loaded), add status loading:

```javascript
// Inside the data-loading useEffect, after loading projects:
try {
  const statusData = await requestJson('/statuses');
  setStatuses(statusData);
} catch (err) {
  console.warn('Failed to load statuses:', err);
}
```

- [ ] **Step 2: Add status CRUD functions**

Add these functions near the existing todo CRUD functions:

```javascript
const createStatus = async (data) => {
  const tempId = `status_${Date.now()}`;
  const newStatus = { id: tempId, sortOrder: statuses.length, isDefaultStart: false, isDefaultEnd: false, ...data };
  setStatuses(prev => [...prev, newStatus]);
  if (apiAvailable) {
    try {
      const result = await requestJson('/statuses', { method: 'POST', body: JSON.stringify({ name: data.name, sort_order: data.sortOrder }) });
      setStatuses(prev => prev.map(s => s.id === tempId ? result : s));
      return result;
    } catch { setApiAvailable(false); }
  }
  return newStatus;
};

const updateStatus = async (id, data) => {
  setStatuses(prev => prev.map(s => {
    if (s.id === id) return { ...s, ...data };
    // Clear old start/end flags when a new one is set
    if (data.isDefaultStart && s.isDefaultStart) return { ...s, isDefaultStart: false };
    if (data.isDefaultEnd && s.isDefaultEnd) return { ...s, isDefaultEnd: false };
    return s;
  }));
  if (apiAvailable) {
    try {
      const body = {};
      if (data.name !== undefined) body.name = data.name;
      if (data.sortOrder !== undefined) body.sort_order = data.sortOrder;
      if (data.isDefaultStart !== undefined) body.is_default_start = data.isDefaultStart;
      if (data.isDefaultEnd !== undefined) body.is_default_end = data.isDefaultEnd;
      const result = await requestJson(`/statuses/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      // Reload all statuses to get consistent flags
      const all = await requestJson('/statuses');
      setStatuses(all);
    } catch { setApiAvailable(false); }
  }
};

const deleteStatus = async (id, migrateTo) => {
  setStatuses(prev => prev.filter(s => s.id !== id));
  if (migrateTo) {
    setTodos(prev => prev.map(t => t.status === id ? { ...t, status: migrateTo } : t));
  }
  if (apiAvailable) {
    try {
      const url = migrateTo ? `/statuses/${id}?migrate_to=${migrateTo}` : `/statuses/${id}`;
      await requestJson(url, { method: 'DELETE' });
    } catch { setApiAvailable(false); }
  }
};

const reorderStatuses = async (items) => {
  const reordered = items.map((item, i) => ({ ...item, sortOrder: i }));
  setStatuses(reordered);
  if (apiAvailable) {
    try {
      const body = reordered.map(s => ({ id: s.id, sortOrder: s.sortOrder }));
      const result = await requestJson('/statuses/reorder', { method: 'POST', body: JSON.stringify(body) });
      setStatuses(result);
    } catch { setApiAvailable(false); }
  }
};
```

- [ ] **Step 3: Pass statuses and handlers to TodoBoard**

Find where `<TodoBoard>` is rendered and update the props:

```jsx
<TodoBoard
  todos={todos}
  statuses={statuses}
  allTasks={allTasks}
  projects={projects}
  onCreateTodo={createTodo}
  onUpdateTodo={updateTodo}
  onDeleteTodo={deleteTodo}
  onCreateStatus={createStatus}
  onUpdateStatus={updateStatus}
  onDeleteStatus={deleteStatus}
  onReorderStatuses={reorderStatuses}
/>
```

- [ ] **Step 4: Update createTodo to default to start status**

Find the `createTodo` function. Update the default status from `'todo'` to the start status id:

```javascript
// In createTodo, replace hardcoded status default:
const startStatus = statuses.find(s => s.isDefaultStart);
const defaultStatus = startStatus ? startStatus.id : 'todo';
// Use defaultStatus when payload.status is not provided
```

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(frontend): add statuses state, CRUD functions, and pass to TodoBoard"
```

---

### Task 11: Frontend — Dynamic Kanban columns in TodoBoard

**Files:**
- Modify: `src/components/TodoBoard.jsx`

This is the core UI change: replace the hardcoded `COLUMNS` array with dynamic columns from `statuses` prop.

- [ ] **Step 1: Remove hardcoded COLUMNS and use statuses prop**

In `src/components/TodoBoard.jsx`, replace the entire component. Key changes:

1. Remove the hardcoded `COLUMNS` constant.
2. Accept new props: `statuses`, `onCreateStatus`, `onUpdateStatus`, `onDeleteStatus`, `onReorderStatuses`.
3. Render columns dynamically from `statuses`.

Replace the component signature and remove `COLUMNS`:

```jsx
import React, { useState, useCallback, useMemo } from 'react';
import { Plus, EyeOff, Eye, Filter, X, GripVertical, Play, Flag } from 'lucide-react';
import TodoCard from './TodoCard';
import TodoFormModal from './TodoFormModal';

export default function TodoBoard({
  todos, statuses, allTasks, projects,
  onCreateTodo, onUpdateTodo, onDeleteTodo,
  onCreateStatus, onUpdateStatus, onDeleteStatus, onReorderStatuses,
}) {
```

- [ ] **Step 2: Add column inline editing state**

Add these state variables inside the component:

```javascript
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [draggingColumnId, setDraggingColumnId] = useState(null);
  const [dragOverColumnId, setDragOverColumnId] = useState(null);
```

- [ ] **Step 3: Update columnTodos to use status ids**

Replace the `columnTodos` memo:

```javascript
  const columnTodos = useMemo(() => {
    const grouped = {};
    statuses.forEach(s => { grouped[s.id] = []; });
    filteredTodos.forEach(t => {
      if (grouped[t.status]) grouped[t.status].push(t);
    });
    Object.values(grouped).forEach(arr => arr.sort((a, b) => a.sortOrder - b.sortOrder));
    return grouped;
  }, [filteredTodos, statuses]);
```

- [ ] **Step 4: Add column edit handlers**

Add these handlers:

```javascript
  const startEditColumn = (status) => {
    setEditingColumnId(status.id);
    setEditingColumnName(status.name);
  };

  const saveColumnName = () => {
    if (editingColumnId && editingColumnName.trim()) {
      onUpdateStatus(editingColumnId, { name: editingColumnName.trim() });
    }
    setEditingColumnId(null);
    setEditingColumnName('');
  };

  const cancelEditColumn = () => {
    setEditingColumnId(null);
    setEditingColumnName('');
  };

  const handleAddColumn = async () => {
    const endStatus = statuses.find(s => s.isDefaultEnd);
    const sortOrder = endStatus ? endStatus.sortOrder - 0.5 : statuses.length;
    const result = await onCreateStatus({ name: '新狀態', sortOrder });
    if (result) {
      // Enter edit mode for the new column
      setEditingColumnId(result.id);
      setEditingColumnName(result.name);
    }
  };

  const handleDeleteColumn = (statusToDelete) => {
    const todosInColumn = todos.filter(t => t.status === statusToDelete.id);
    if (todosInColumn.length === 0) {
      if (window.confirm(`確定要刪除「${statusToDelete.name}」狀態嗎？`)) {
        onDeleteStatus(statusToDelete.id);
      }
    } else {
      // Show migration dialog — for now, use a simple prompt
      const otherStatuses = statuses.filter(s => s.id !== statusToDelete.id);
      const targetName = window.prompt(
        `「${statusToDelete.name}」下有 ${todosInColumn.length} 個 Todo。\n請輸入要遷移到的狀態名稱：\n${otherStatuses.map(s => s.name).join('、')}`
      );
      if (targetName) {
        const target = otherStatuses.find(s => s.name === targetName);
        if (target) {
          onDeleteStatus(statusToDelete.id, target.id);
        }
      }
    }
  };
```

- [ ] **Step 5: Add column drag-and-drop handlers**

```javascript
  const handleColumnDragStart = (e, statusId) => {
    e.dataTransfer.setData('column-id', statusId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingColumnId(statusId);
  };

  const handleColumnDragOver = (e, statusId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (statusId !== draggingColumnId) {
      setDragOverColumnId(statusId);
    }
  };

  const handleColumnDrop = (e, targetStatusId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('column-id');
    if (!sourceId || sourceId === targetStatusId) {
      setDraggingColumnId(null);
      setDragOverColumnId(null);
      return;
    }
    const ordered = [...statuses];
    const sourceIdx = ordered.findIndex(s => s.id === sourceId);
    const targetIdx = ordered.findIndex(s => s.id === targetStatusId);
    const [moved] = ordered.splice(sourceIdx, 1);
    ordered.splice(targetIdx, 0, moved);
    onReorderStatuses(ordered);
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  };
```

- [ ] **Step 6: Update the Kanban grid render**

Replace the Kanban grid section. Change `grid-cols-3` to dynamic columns, and render from `statuses` instead of `COLUMNS`:

```jsx
      {/* Kanban Columns */}
      <div
        className="flex gap-4 overflow-x-auto pb-2"
        style={{ minHeight: '60vh' }}
      >
        {statuses.map(col => {
          if (col.isDefaultEnd && hideDone) return null;
          const items = columnTodos[col.id] || [];
          const isOver = dragOverColumn === col.id;
          const isColumnDragOver = dragOverColumnId === col.id;
          const canDelete = !col.isDefaultStart && !col.isDefaultEnd;

          return (
            <div
              key={col.id}
              draggable
              onDragStart={(e) => {
                // Only allow column drag from the grip handle
                if (e.target.dataset.columnDrag) {
                  handleColumnDragStart(e, col.id);
                }
              }}
              onDragOver={(e) => {
                if (draggingColumnId) {
                  handleColumnDragOver(e, col.id);
                } else {
                  handleDragOver(e, col.id);
                }
              }}
              onDragLeave={() => {
                setDragOverColumn(null);
                setDragOverColumnId(null);
              }}
              onDrop={(e) => {
                if (draggingColumnId) {
                  handleColumnDrop(e, col.id);
                } else {
                  handleDrop(e, col.id);
                }
              }}
              className={`
                min-w-[280px] flex-1 bg-gray-50 rounded-xl border-t-4
                ${col.isDefaultStart ? 'border-gray-300' : col.isDefaultEnd ? 'border-emerald-400' : 'border-blue-400'}
                p-3 flex flex-col
                ${isOver ? 'ring-2 ring-indigo-300 bg-indigo-50/30' : ''}
                ${isColumnDragOver ? 'ring-2 ring-amber-300' : ''}
                ${draggingColumnId === col.id ? 'opacity-50' : ''}
              `}
            >
              <div className="flex justify-between items-center mb-3 group">
                <div className="flex items-center gap-1">
                  <button
                    data-column-drag="true"
                    draggable
                    onDragStart={(e) => handleColumnDragStart(e, col.id)}
                    className="cursor-grab text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition"
                  >
                    <GripVertical size={14} />
                  </button>
                  {editingColumnId === col.id ? (
                    <input
                      autoFocus
                      value={editingColumnName}
                      onChange={e => setEditingColumnName(e.target.value)}
                      onBlur={saveColumnName}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveColumnName();
                        if (e.key === 'Escape') cancelEditColumn();
                      }}
                      className="text-sm font-bold text-gray-700 border border-indigo-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-indigo-400 w-24"
                    />
                  ) : (
                    <h3
                      className="text-sm font-bold text-gray-700 cursor-pointer hover:text-indigo-600"
                      onDoubleClick={() => startEditColumn(col)}
                    >
                      {col.name}
                    </h3>
                  )}
                  {col.isDefaultStart && (
                    <span title="起始狀態" className="text-xs text-gray-400"><Play size={10} /></span>
                  )}
                  {col.isDefaultEnd && (
                    <span title="完成狀態" className="text-xs text-gray-400"><Flag size={10} /></span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">{items.length}</span>
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteColumn(col)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      title={`刪除「${col.name}」`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {items.length === 0 ? (
                  <div className="text-center text-gray-300 text-sm py-8">
                    沒有{col.name}事項
                  </div>
                ) : (
                  items.map(todo => (
                    <TodoCard
                      key={todo.id}
                      todo={todo}
                      isDone={col.isDefaultEnd}
                      onEdit={openEdit}
                      onDragStart={setDraggingId}
                      onDragEnd={() => { setDraggingId(null); setDragOverColumn(null); }}
                      allTasks={allTasks}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Add Column Button */}
        <div className="min-w-[60px] flex items-start justify-center pt-3">
          <button
            onClick={handleAddColumn}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-dashed border-gray-300 hover:border-indigo-300 transition"
            title="新增狀態"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
```

- [ ] **Step 7: Update handleDrop to use status id instead of key**

The `handleDrop` callback already receives the status id from `col.id`. Verify it passes the status id to `onUpdateTodo`:

```javascript
  const handleDrop = useCallback((e, targetStatusId) => {
    e.preventDefault();
    const todoId = e.dataTransfer.getData('text/plain');
    if (!todoId) return;
    const todo = todos.find(t => t.id === todoId);
    if (!todo || todo.status === targetStatusId) {
      setDragOverColumn(null);
      setDraggingId(null);
      return;
    }
    onUpdateTodo(todoId, { status: targetStatusId });
    setDragOverColumn(null);
    setDraggingId(null);
  }, [todos, onUpdateTodo]);
```

- [ ] **Step 8: Update hideDone toggle text**

Replace the hide done button to use the end status name:

```javascript
  const endStatus = statuses.find(s => s.isDefaultEnd);
  const endStatusName = endStatus ? endStatus.name : '已完成';
```

```jsx
  <button onClick={() => setHideDone(h => !h)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
    {hideDone ? <Eye size={14} /> : <EyeOff size={14} />}
    {hideDone ? `顯示${endStatusName}` : `隱藏${endStatusName}`}
  </button>
```

- [ ] **Step 9: Commit**

```bash
git add src/components/TodoBoard.jsx
git commit -m "feat(frontend): dynamic Kanban columns with inline edit, add, delete, reorder"
```

---

### Task 12: Frontend — Update TodoCard done styling

**Files:**
- Modify: `src/components/TodoCard.jsx`

- [ ] **Step 1: Accept isDone prop instead of checking status === 'done'**

In `TodoCard.jsx`, the component currently checks `todo.status === 'done'` for done styling. Change it to use the `isDone` prop passed from TodoBoard:

```jsx
// Change the function signature to accept isDone:
export default function TodoCard({ todo, isDone, onEdit, onDragStart, onDragEnd, allTasks }) {
```

Replace any `todo.status === 'done'` checks with `isDone`:

```jsx
// Where done styling is applied:
className={`... ${isDone ? 'opacity-60' : ''}`}
// Where title has strikethrough:
className={`... ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TodoCard.jsx
git commit -m "feat(frontend): TodoCard uses isDone prop instead of hardcoded status check"
```

---

### Task 13: Frontend — Update TodoFormModal status field

**Files:**
- Modify: `src/components/TodoFormModal.jsx`

- [ ] **Step 1: Accept statuses prop and render dynamic status dropdown**

In `TodoFormModal.jsx`, add `statuses` to the props. Replace the hardcoded status dropdown:

```jsx
// Old:
<select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
  <option value="todo">待辦</option>
  <option value="in_progress">進行中</option>
  <option value="done">已完成</option>
</select>

// New:
<select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
  {statuses.map(s => (
    <option key={s.id} value={s.id}>{s.name}</option>
  ))}
</select>
```

- [ ] **Step 2: Update TodoBoard to pass statuses to TodoFormModal**

In `TodoBoard.jsx`, find where `<TodoFormModal>` is rendered and add the `statuses` prop:

```jsx
<TodoFormModal
  todo={editingTodo}
  statuses={statuses}
  allTasks={allTasks}
  projects={projects}
  onSave={handleSave}
  onDelete={handleDelete}
  onClose={() => { setShowFormModal(false); setEditingTodo(null); }}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TodoFormModal.jsx src/components/TodoBoard.jsx
git commit -m "feat(frontend): TodoFormModal uses dynamic statuses dropdown"
```

---

### Task 14: Frontend — Update TodoSection in Task Detail Modal

**Files:**
- Modify: `src/components/TodoSection.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Update TodoSection to use status ids**

In `TodoSection.jsx`, the checklist toggles between `'todo'` and `'done'` strings. Update to use status ids:

```jsx
// Accept statuses prop:
export default function TodoSection({ linkedTodos, statuses, onUpdateTodo, onNavigateToTodo }) {
  const startStatus = statuses.find(s => s.isDefaultStart);
  const endStatus = statuses.find(s => s.isDefaultEnd);

  // In the checkbox toggle:
  const toggleTodo = (todo) => {
    const newStatus = todo.status === endStatus?.id ? startStatus?.id : endStatus?.id;
    onUpdateTodo(todo.id, { status: newStatus });
  };

  // In the progress calculation:
  const doneCount = linkedTodos.filter(t => t.status === endStatus?.id).length;
```

- [ ] **Step 2: Pass statuses prop to TodoSection in App.jsx**

Find where `<TodoSection>` is rendered in `App.jsx` and add the `statuses` prop:

```jsx
<TodoSection
  linkedTodos={linkedTodos}
  statuses={statuses}
  onUpdateTodo={updateTodo}
  onNavigateToTodo={...}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TodoSection.jsx src/App.jsx
git commit -m "feat(frontend): TodoSection uses dynamic status ids for checklist"
```

---

### Task 15: Playwright E2E — Custom statuses tests

**Files:**
- Create: `e2e/custom-statuses.spec.js`

- [ ] **Step 1: Create the test file with helpers**

Create `e2e/custom-statuses.spec.js`:

```javascript
import { test, expect } from '@playwright/test';
import { API_BASE } from './test-config.js';

/** Reset statuses to default via API (delete all custom, restore defaults via re-init). */
async function resetStatuses() {
  const res = await fetch(`${API_BASE}/statuses`);
  if (!res.ok) return;
  const statuses = await res.json();
  // Delete non-default statuses
  for (const s of statuses) {
    if (!s.isDefaultStart && !s.isDefaultEnd) {
      // Only delete custom ones (not the middle default)
      const hasDefaultMiddle = statuses.filter(st => !st.isDefaultStart && !st.isDefaultEnd);
      if (hasDefaultMiddle.length > 1 || s.name !== '進行中') {
        await fetch(`${API_BASE}/statuses/${s.id}`, { method: 'DELETE' });
      }
    }
  }
}

async function deleteAllTodos() {
  const res = await fetch(`${API_BASE}/todos`);
  if (!res.ok) return;
  const todos = await res.json();
  await Promise.all(todos.map(t => fetch(`${API_BASE}/todos/${t.id}`, { method: 'DELETE' })));
}

async function getStatuses() {
  const res = await fetch(`${API_BASE}/statuses`);
  return res.json();
}

async function createTodoViaAPI(title, statusId) {
  const body = { title };
  if (statusId) body.status = statusId;
  const res = await fetch(`${API_BASE}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

test.describe('Custom Statuses', () => {
  test.beforeEach(async ({ page }) => {
    await deleteAllTodos();
    await resetStatuses();
    await page.goto('/');
    // Navigate to Todo tab
    await page.getByText('Todo').click();
  });

  test('displays default 3 status columns', async ({ page }) => {
    await expect(page.getByText('待辦')).toBeVisible();
    await expect(page.getByText('進行中')).toBeVisible();
    await expect(page.getByText('已完成')).toBeVisible();
  });

  test('inline rename a status column', async ({ page }) => {
    // Double-click on "進行中" header to edit
    await page.getByText('進行中').dblclick();
    const input = page.locator('input[value="進行中"]');
    await expect(input).toBeVisible();
    await input.fill('開發中');
    await input.press('Enter');
    await expect(page.getByText('開發中')).toBeVisible();
    await expect(page.getByText('進行中')).not.toBeVisible();

    // Verify persistence after reload
    await page.reload();
    await page.getByText('Todo').click();
    await expect(page.getByText('開發中')).toBeVisible();
  });

  test('add a new status column', async ({ page }) => {
    // Click the + button
    await page.locator('button[title="新增狀態"]').click();
    // New column should appear with input in edit mode
    const input = page.locator('input[value="新狀態"]');
    await expect(input).toBeVisible();
    await input.fill('Review');
    await input.press('Enter');
    await expect(page.getByText('Review')).toBeVisible();

    // Verify 4 columns now
    const statuses = await getStatuses();
    expect(statuses.length).toBe(4);
  });

  test('delete a custom status (no todos)', async ({ page }) => {
    // First add a custom status via API
    await fetch(`${API_BASE}/statuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Review' }),
    });
    await page.reload();
    await page.getByText('Todo').click();
    await expect(page.getByText('Review')).toBeVisible();

    // Hover over the Review column header and click delete
    const reviewHeader = page.getByText('Review');
    await reviewHeader.hover();
    await page.locator('button[title="刪除「Review」"]').click();

    // Accept confirmation
    page.on('dialog', dialog => dialog.accept());
    await expect(page.getByText('Review')).not.toBeVisible();
  });

  test('cannot delete start or end status', async ({ page }) => {
    // The delete button should not be visible for start/end statuses
    const startHeader = page.getByText('待辦');
    await startHeader.hover();
    await expect(page.locator('button[title="刪除「待辦」"]')).not.toBeVisible();

    const endHeader = page.getByText('已完成');
    await endHeader.hover();
    await expect(page.locator('button[title="刪除「已完成」"]')).not.toBeVisible();
  });

  test('drag todo across custom status columns', async ({ page }) => {
    // Add a custom status via API
    const statuses = await getStatuses();
    await fetch(`${API_BASE}/statuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Review', sort_order: 1.5 }),
    });
    const startStatus = statuses.find(s => s.isDefaultStart);
    await createTodoViaAPI('Test drag', startStatus.id);

    await page.reload();
    await page.getByText('Todo').click();

    // Verify todo is in the start column
    await expect(page.getByText('Test drag')).toBeVisible();

    // Drag to Review column
    const card = page.getByText('Test drag');
    const reviewColumn = page.getByText('Review').locator('..');
    await card.dragTo(reviewColumn);

    // Verify via API that status changed
    const todosAfter = await (await fetch(`${API_BASE}/todos`)).json();
    const updatedTodo = todosAfter.find(t => t.title === 'Test drag');
    const reviewStatus = (await getStatuses()).find(s => s.name === 'Review');
    expect(updatedTodo.status).toBe(reviewStatus.id);
  });

  test('column reorder persists after reload', async ({ page }) => {
    // Get initial order via API
    const before = await getStatuses();
    const names = before.map(s => s.name);
    expect(names[0]).toBe('待辦');

    // Drag 進行中 before 待辦
    const source = page.getByText('進行中').locator('..').locator('button[data-column-drag]');
    const target = page.getByText('待辦');
    await source.dragTo(target);

    // Reload and check order
    await page.reload();
    await page.getByText('Todo').click();
    const after = await getStatuses();
    expect(after[0].name).toBe('進行中');
    expect(after[1].name).toBe('待辦');
  });

  test('delete status with todos shows migration', async ({ page }) => {
    // Create a custom status and a todo in it
    const customRes = await fetch(`${API_BASE}/statuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Review' }),
    });
    const customStatus = await customRes.json();
    await createTodoViaAPI('Migrating todo', customStatus.id);

    await page.reload();
    await page.getByText('Todo').click();

    // Delete the custom status - should prompt for migration target
    const reviewHeader = page.getByText('Review');
    await reviewHeader.hover();

    // Set up dialog handler to type migration target
    page.on('dialog', async dialog => {
      await dialog.accept('待辦');
    });

    await page.locator('button[title="刪除「Review」"]').click();

    // Verify todo was migrated to 待辦 column
    const statuses = await getStatuses();
    const startStatus = statuses.find(s => s.isDefaultStart);
    const todos = await (await fetch(`${API_BASE}/todos`)).json();
    expect(todos[0].status).toBe(startStatus.id);
  });
});
```

- [ ] **Step 2: Run e2e tests**

Run: `npx playwright test e2e/custom-statuses.spec.js --headed`
Expected: All tests pass (assuming the Todo feature is fully implemented).

- [ ] **Step 3: Commit**

```bash
git add e2e/custom-statuses.spec.js
git commit -m "test(e2e): add Playwright tests for custom statuses feature"
```

---

### Task 16: Final integration verification

**Files:** None (verification only)

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && python -m pytest tests/test_api.py -v`
Expected: All PASS

- [ ] **Step 2: Run all e2e tests**

Run: `npx playwright test --headed`
Expected: All PASS

- [ ] **Step 3: Manual smoke test**

1. Start the app: `cd backend && python main.py` + `npm run dev`
2. Navigate to Todo tab
3. Verify 3 default columns render
4. Double-click a column name → rename → Enter → verify
5. Click + → add new column → name it
6. Add a todo → drag between columns
7. Delete a custom column → verify migration prompt
8. Drag columns to reorder → reload → verify order persists

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final integration fixes for custom statuses"
```
