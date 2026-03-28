# Todo List Feature Design

## Overview

Add a global, cross-project Kanban-style todo list to the burnup chart application. Todos are independent from but can link to existing burnup tasks, enabling both daily task management and burnup task breakdown workflows.

## Data Model

### Todo Item

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `title` | string | yes | Todo title |
| `status` | enum | yes | `todo` \| `in_progress` \| `done` |
| `priority` | enum | yes | `high` \| `medium` \| `low` |
| `dueDate` | string (YYYY-MM-DD) | no | Due date |
| `assignee` | string | no | Assignee name (shared namespace with burnup task `people`) |
| `tags` | string[] | yes (default `[]`) | Custom classification tags |
| `note` | string | no | Freeform notes |
| `linkedTaskId` | string | no | Associated burnup task ID (`null` = independent todo) |
| `createdAt` | string (ISO 8601) | yes | Creation timestamp |
| `order` | number | yes | Sort order within the same status column |

### Scope

- Global: todos are not scoped to any project.
- A todo may link to a task in any project via `linkedTaskId`.

### Relationship with Burnup Tasks

- **Todo → Task**: `linkedTaskId` references a burnup task. The todo card displays the linked task name as a clickable link.
- **Task → Todo**: The Task Detail Modal displays a progress bar and checklist of linked todos. Users can check/uncheck todos from there.
- **Orphan handling**: When a linked burnup task is deleted, `linkedTaskId` is cleared to `null` and the todo is preserved with "no link" display.

## UI Architecture

### 1. Todo Tab (Kanban Board)

**Location:** Top navigation bar, after project tabs and merged view tab. A dedicated "Todo" tab.

**Layout:** Full-page three-column Kanban board.

| Column | Status |
|--------|--------|
| 待辦 (Todo) | `todo` |
| 進行中 (In Progress) | `in_progress` |
| 已完成 (Done) | `done` |

**Column header:** Column name + item count badge.

**Toolbar (top):**
- Filter controls: assignee, priority, tag, linked task (AND logic, multiple simultaneous)
- "+ 新增" button to create a new todo
- "隱藏已完成" toggle for the Done column

**Filter state:** Persisted in localStorage.

### 2. Todo Card

Each card displays:
- **Left border color** by priority: red (high), orange (medium), gray (low)
- **Title** + priority badge (top-right)
- **Linked task** link (format: clickable task name, navigates to project + opens detail modal) or "無關聯任務" in muted text
- **Bottom row:** Assignee avatar + name, due date, tag badges
- **Done cards:** Semi-transparent with strikethrough title

**Click behavior:** Opens an edit modal with all fields.

### 3. Drag & Drop

- **Cross-column drag** = change `status` (e.g., drag from 待辦 to 進行中)
- **Within-column drag** = reorder (`order` field)
- Cards in Done column can be dragged back to other columns (reopen)

### 4. Burnup Integration (Task Detail Modal)

In the existing Task Detail Modal, below the date section:

- **"關聯 Todo" section** — only shown when linked todos exist
- **Progress bar**: green fill showing completion ratio (e.g., 3/5)
- **Expandable checklist**: Click to expand, shows all linked todos with checkboxes
- **Check/uncheck**: Toggling a checkbox updates the todo's status (`todo` ↔ `done`)
- **"前往 Todo Tab →" link**: Top-right of section, navigates to Todo Tab

When no todos are linked to the task, this section is hidden entirely.

## Interactions

### Create Todo

- Click "+ 新增" in toolbar → modal opens
- Fields: title (required), status (default: `todo`), priority (default: `medium`), due date, assignee, tags (comma-separated, autocomplete from history), note, linked task (dropdown: `Project Name / Task Name`)
- Save creates the card in the appropriate column

### Edit Todo

- Click any card → edit modal opens with all fields pre-filled
- Can change or remove linked task
- Delete button at bottom of modal with confirmation dialog

### Delete Todo

- Available in edit modal only
- Requires confirmation before deletion

### Filtering

- Multiple filters can be active simultaneously (AND logic)
- Filter options: assignee, priority, tag, has linked task (yes/no)
- Filter state persisted in localStorage across sessions

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/todos` | List all todos |
| `POST` | `/api/todos` | Create a todo |
| `PATCH` | `/api/todos/:id` | Update a todo (status, order, fields) |
| `DELETE` | `/api/todos/:id` | Delete a todo |
| `GET` | `/api/tasks/:id/todos` | Get todos linked to a specific burnup task |

All endpoints follow the existing pattern: JSON request/response, optimistic UI updates with async API sync, graceful degradation when backend is unavailable.

## Edge Cases

- **Linked task deleted**: `linkedTaskId` cleared to `null`, todo preserved, displays "無關聯任務"
- **Done column overflow**: "隱藏已完成" toggle hides the Done column content; alternatively show only the most recent N completed items
- **Backend unavailable**: Todos work in-memory with localStorage fallback, matching existing burnup behavior
- **Empty state**: Each column shows a subtle empty-state message (e.g., "沒有待辦事項") when no cards are present
