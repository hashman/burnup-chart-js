# burnup-chart-js

React + Vite + Recharts 製作的 Burnup 圖與任務管理工具，支援多專案、Todo 看板、使用者認證與角色權限。

## 功能特色

### Burnup 圖表
- 多專案分頁管理，支援新增與刪除
- 任務可直接編輯（名稱/點數/負責人/日期），可標記顯示在圖表上
- Burnup 圖同時呈現預期進度與實際進度
- 圖表區間自動或手動指定，支援全螢幕顯示
- 台灣工作日計算：預期完成日會跳過週末與國定假日
- 同人任務重疊警示（2 件警告、3 件以上危險）
- 任務紀錄（Log）新增/刪除
- 人員篩選、顯示/隱藏已完成
- CSV 匯入/匯出
- 合併檢視：將多個專案合併成一張 Burnup 圖

### Todo 看板
- Kanban 風格的 Todo 管理，支援拖放排序
- 自訂狀態欄位（新增、重新命名、刪除、排序）
- 優先順序（高/中/低）、到期日、指派人
- Todo 留言功能
- Todo 可連結至任務，追蹤進度

### 認證與權限
- JWT 認證（access token + refresh token rotation）
- 角色權限：admin / member / viewer
- 首次使用自動引導建立管理員帳號
- 管理員可新增使用者、變更角色、停用帳號

### 資料庫備份
- 自動排程備份（APScheduler）
- 可設定備份間隔與保留數量

## 開發環境

### 前端

需要 Node.js 24+（專案內含 `.nvmrc`）。

```bash
npm install
npm run dev
```

### 後端

需要 Python 3.12+ 與 Poetry。

```bash
cd backend
poetry install
poetry run uvicorn main:app --reload --port 8000
```

## 環境變數

### 後端

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `BURNUP_DB_PATH` | SQLite 檔案路徑 | `backend/data/burnup.sqlite3` |
| `BURNUP_CORS_ORIGINS` | 允許的來源（逗號分隔） | `http://localhost:5173,http://127.0.0.1:5173` |
| `BURNUP_JWT_SECRET` | JWT 簽章密鑰 | `dev-secret-change-in-production` |
| `BURNUP_ACCESS_TOKEN_EXPIRE_MINUTES` | Access token 有效時間（分鐘） | `30` |
| `BURNUP_REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token 有效時間（天） | `7` |
| `BURNUP_BACKUP_ENABLED` | 啟用自動備份（`1` / `true` / `yes`） | 停用 |
| `BURNUP_BACKUP_DIR` | 備份目錄 | `backend/data/backups` |
| `BURNUP_BACKUP_RETENTION` | 保留備份數量 | `7` |
| `BURNUP_BACKUP_INTERVAL_HOURS` | 備份間隔（小時） | `24` |

### 前端

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `VITE_API_BASE_URL` | API 位址 | `http://127.0.0.1:8000` |

## 測試

```bash
# 前端 lint
npx eslint src/

# 後端 lint
ruff check backend/
ruff format --check backend/

# 後端測試
cd backend && poetry run pytest -v

# E2E 測試（會自動啟動前後端）
npx playwright test
```

## CI

GitHub Actions 在 PR 與手動觸發時執行：
1. **Code Style** — ESLint（前端）+ Ruff（後端）
2. **Backend Tests** — pytest
3. **E2E Tests** — Playwright（Chromium）

## 專案結構

```
src/
├── App.jsx                 # 主要 UI（Burnup 圖表、任務管理、合併檢視）
├── api.js                  # API 請求工具
├── main.jsx                # 入口
├── index.css               # Tailwind CSS
├── auth/                   # 認證模組
│   ├── AuthContext.jsx     # Auth 狀態管理、token 處理
│   ├── LoginPage.jsx       # 登入頁面
│   ├── UserMenu.jsx        # 使用者選單
│   └── AdminPanel.jsx      # 使用者管理介面
└── components/             # UI 元件
    ├── TodoBoard.jsx       # Kanban 看板
    ├── TodoCard.jsx        # Todo 卡片
    ├── TodoFormModal.jsx   # Todo 表單
    └── TodoSection.jsx     # Todo 區塊

backend/
├── main.py                 # FastAPI 應用
├── auth.py                 # JWT / 密碼雜湊
├── db.py                   # SQLite 連線與 schema
├── models.py               # Pydantic models
├── permissions.py          # 角色權限
├── backup.py               # 資料庫備份
├── routers/                # API 路由
│   ├── auth_routes.py      # 認證相關
│   ├── projects.py         # 專案 CRUD
│   ├── tasks.py            # 任務 CRUD
│   ├── todos.py            # Todo CRUD + 留言
│   ├── statuses.py         # 自訂狀態
│   └── logs.py             # 任務紀錄
└── tests/                  # 後端測試

e2e/                        # Playwright E2E 測試
```

## CSV 格式

匯入時依欄位順序解析（第一列若包含 `name` 會視為表頭略過）。

欄位順序：Name, Points, People, AddedDate, ExpectedStart, ExpectedEnd, ActualStart, ActualEnd, ShowLabel

日期格式：`YYYY-MM-DD`

```csv
Name,Points,People,AddedDate,ExpectedStart,ExpectedEnd,ActualStart,ActualEnd,ShowLabel
API 設計,5,Alice,2024-03-01,2024-03-01,2024-03-07,2024-03-02,2024-03-08,true
前端切版,8,Bob,2024-03-03,2024-03-04,2024-03-15,,,false
```

## 假日資料來源

台灣國定假日由 `date-holidays` library 依 TW 規則計算，不需遠端 API。
