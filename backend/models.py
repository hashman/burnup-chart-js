"""Pydantic models for the Burnup Chart API."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# Type aliases
LogPayload = Dict[str, str]
TaskPayload = Dict[str, Any]
ProjectPayload = Dict[str, Any]


# ---------------------------------------------------------------------------
# Log models
# ---------------------------------------------------------------------------


class LogCreate(BaseModel):
    id: Optional[str] = None
    date: str
    content: str


class LogOut(BaseModel):
    id: str
    date: str
    content: str


# ---------------------------------------------------------------------------
# Task models
# ---------------------------------------------------------------------------


class TaskCreate(BaseModel):
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


# ---------------------------------------------------------------------------
# Project models
# ---------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    id: Optional[str] = None
    name: str


class ProjectUpdate(BaseModel):
    name: Optional[str] = None


class ProjectOut(BaseModel):
    id: str
    name: str
    tasks: List[TaskOut] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Status models
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Todo models
# ---------------------------------------------------------------------------


class TodoCreate(BaseModel):
    id: Optional[str] = None
    title: str
    status: Optional[str] = None
    priority: str = "medium"
    dueDate: Optional[str] = None
    assignee: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    note: Optional[str] = None
    linkedTaskId: Optional[str] = None
    subProjectId: Optional[str] = None


class TodoUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    dueDate: Optional[str] = None
    assignee: Optional[str] = None
    tags: Optional[List[str]] = None
    note: Optional[str] = None
    linkedTaskId: Optional[str] = None
    subProjectId: Optional[str] = None
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
    subProjectId: Optional[str] = None
    createdAt: str
    sortOrder: float
    comments: List[TodoCommentOut] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Sub-project models
# ---------------------------------------------------------------------------


class SubProjectCreate(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    status: str = "active"
    owner: Optional[str] = None
    dueDate: Optional[str] = None
    priority: str = "medium"
    tags: List[str] = Field(default_factory=list)
    linkedTaskIds: List[str] = Field(default_factory=list)


class SubProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    owner: Optional[str] = None
    dueDate: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None
    linkedTaskIds: Optional[List[str]] = None
    sortOrder: Optional[float] = None


class SubProjectOut(BaseModel):
    id: str
    burnupProjectId: str
    name: str
    description: Optional[str] = None
    status: str
    owner: Optional[str] = None
    dueDate: Optional[str] = None
    priority: str
    tags: List[str] = Field(default_factory=list)
    sortOrder: float
    linkedTaskIds: List[str] = Field(default_factory=list)
    activeWaitingCount: int = 0
    createdAt: str


class SubProjectEventCreate(BaseModel):
    type: str = Field(pattern=r"^(waiting|note|decision)$")
    title: str
    body: Optional[str] = None
    waitingOn: Optional[str] = None


class SubProjectEventUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    waitingOn: Optional[str] = None
    resolvedAt: Optional[str] = None


class SubProjectEventOut(BaseModel):
    id: str
    parentType: str
    parentId: str
    type: str
    title: str
    body: Optional[str] = None
    waitingOn: Optional[str] = None
    startedAt: str
    resolvedAt: Optional[str] = None
    createdAt: str


# ---------------------------------------------------------------------------
# Auth models
# ---------------------------------------------------------------------------


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    display_name: str = Field(min_length=1, max_length=50)
    email: Optional[str] = None
    password: str = Field(min_length=8)
    role: str = "member"


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    displayName: str
    email: Optional[str] = None
    role: str
    isActive: bool


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8)


class UserAdminUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str
