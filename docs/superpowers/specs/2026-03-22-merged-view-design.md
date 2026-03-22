# 合併檢視分頁 — Design Spec

**Date:** 2026-03-22
**Status:** Approved

## Overview

在現有的多專案分頁架構中，新增一個「合併檢視」固定分頁，讓使用者可以選擇 N 個專案，將其 tasks 合併成一張 Burnup 圖，對比整體預期進度與實際進度。

---

## 1. 分頁列

- 在現有專案 tab 列表最右側加一個固定的「合併檢視」tab
- 視覺樣式：虛線紫色邊框（`border-dashed border-purple-500`）+ 紫色文字 + 淺紫背景，與一般專案 tab 明確區隔
- 帶有圖表 icon（如 `TrendingUp`）
- 不能被刪除，不能重新命名
- 切換至此 tab 時設定 `activeProjectId = '__merged__'`（特殊保留值）
- **ID 保護：** 建立新專案時，若自動產生或使用者輸入的 id 等於 `'__merged__'`，則重新產生（實際上 `generateId()` 產生時間戳 + random string，幾乎不可能衝突，但需加防禦性檢查）

---

## 2. 首次進入設定 & 持久化

**localStorage key：** `burnup_merged_project_ids`（儲存 project id 陣列，JSON string）

**State 初始化：** 在 component mount 時，透過 `useState` lazy initializer 一次性讀取 localStorage：

```js
const [mergedProjectIds, setMergedProjectIds] = useState(() => {
  try {
    const raw = localStorage.getItem('burnup_merged_project_ids');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
});
```

Modal 顯示條件為 reactive：`activeProjectId === '__merged__' && mergedProjectIds.length === 0`。

**「取消後切回」的機制：** 使用 `useRef` 記錄前一個 `activeProjectId`（`previousProjectIdRef`）。初始值設為 `projects[0]?.id`（確保首次點擊合併 tab 時 cancel 有有效目標）。每次 `activeProjectId` 變更為非 `'__merged__'` 的值時，透過 `useEffect` 更新此 ref。Modal 取消時，將 `activeProjectId` 還原為 `previousProjectIdRef.current ?? projects[0]?.id`。

**流程：**

1. 使用者點入合併 tab → `activeProjectId = '__merged__'`
2. **若 `mergedProjectIds.length === 0`：** 顯示設定 Modal
   - 列出所有現有專案的 checkbox
   - 至少需勾選 1 個才能按「確認並檢視」
   - 確認後：更新 `mergedProjectIds` state，寫入 localStorage，關閉 Modal
   - 取消後：`setActiveProjectId(previousProjectIdRef.current)`
3. **若 `mergedProjectIds.length > 0`：** 直接進入合併圖表頁，略過 Modal

**重新設定：** banner 上的「重新設定」按鈕會開啟同一個 Modal，但此時 checkbox 預設為目前已選的專案。同樣需至少勾選 1 個才能確認。取消重新設定 Modal 時，`mergedProjectIds` **不變**，使用者仍留在合併檢視頁。確認後更新 state 與 localStorage。

**專案刪除的邊緣情況：**

- `validMergedIds` 是一個 `useMemo`，依賴 `[projects, mergedProjectIds]`，用於 banner 顯示與 `mergedTasks` 計算：
  ```js
  const validMergedIds = useMemo(
    () => mergedProjectIds.filter(id => projects.some(p => p.id === id)),
    [projects, mergedProjectIds]
  );
  ```
- 每當 `validMergedIds` 與 `mergedProjectIds` 不同時（有 id 因專案刪除而失效），在 `useEffect([validMergedIds])` 中更新 state 與 localStorage
- 若 `validMergedIds` 為空，同一 `useEffect` 負責觸發設定 Modal（透過 reset `mergedProjectIds = []`）

---

## 3. 合併圖表頁面

### `activeProject` 合成物件

當 `activeProjectId === '__merged__'` 時，`activeProject` 不從 `projects.find(...)` 取得，而是使用一個合成物件：

```js
const activeProject = activeProjectId === MERGED_TAB_ID
  ? { id: MERGED_TAB_ID, name: '合併檢視', tasks: mergedTasks }
  : (projects.find(p => p.id === activeProjectId) || projects[0]);
```

- 程式碼審查確認 `activeProject` 在 `App.jsx` 中僅使用 `.tasks` 與 `.name` 兩個欄位，合成物件完整覆蓋
- 頁面標題顯示「合併檢視」
- CSV 匯出的檔名為 `合併檢視-burnup.csv`，匯出內容為 `mergedTasks`

### Task ID 衝突處理

後端產生的 task id 格式為 `task_<uuid_hex>`，實際上不會衝突。初始 demo 資料使用 `'t1'`、`'t2'` 等短 id 跨專案可能重複，但：

- 合併檢視為**唯讀**，不開啟任務編輯 Modal、Log Modal、Detail Modal（`activeLogTaskId`、`detailTaskId` 的觸發按鈕在唯讀模式下隱藏）
- 因此 `.find(t => t.id === ...)` 的 lookup 在合併模式下不會被觸發，ID 衝突不影響功能

### 頂部 Banner

- 顯示目前合併的專案名稱（以 tag 形式列出，取 `validMergedIds` 對應的 project name）
- 右側「重新設定」按鈕（gear icon）
- 背景色：淺紫（`bg-violet-50`），與一般頁面有視覺區隔

### 圖表資料

- `mergedTasks` 以 `useMemo` 計算，依賴 `[projects, validMergedIds]`：
  ```js
  const mergedTasks = useMemo(
    () => projects.filter(p => validMergedIds.includes(p.id)).flatMap(p => p.tasks),
    [projects, validMergedIds]
  );
  ```
- 直接傳入現有的 `normalizedTasks` → `chartData` useMemo 計算鏈，不另外建立計算路徑
- **日期範圍：** 自動取 `mergedTasks` 中所有 tasks 的最早 `addedDate` 到最晚 `expectedEnd` / `actualEnd`（取兩者較晚者）
- 圖表呈現：預期進度線 + 實際進度線，與現有單一專案的 Burnup 圖相同

### 唯讀限制（隱藏以下元素）

- 新增任務表單
- 任務列表中的編輯 / 刪除按鈕
- 任務列表中的 Log 新增按鈕與 Log Modal 開啟入口
- 任務 Detail Modal 開啟入口（避免跨專案 task ID 衝突造成錯誤 lookup）
- 甘特圖的拖拉調整（`mousedown` 事件不綁定）
- CSV 匯入按鈕

### 保留功能

- 人員篩選（`filterPerson` dropdown）；**切換至合併 tab 時重置 `filterPerson` 為 `""`** 以避免空圖
- 顯示/隱藏已完成任務 toggle（`showCompleted`，與一般 tab 共用同一 state，**切換至合併 tab 時不重置**）
- 任務列表（唯讀，**不開啟 Log Modal 與 Detail Modal**，以避免跨專案 task ID 衝突時的錯誤 lookup）
- Burnup 圖 / 甘特圖切換（`chartView`，與一般 tab 共用同一 state，**切換至合併 tab 時不重置**）；甘特圖唯讀顯示（hover tooltip 保留，拖拉停用）
- 全螢幕模式
- CSV 匯出（匯出 `mergedTasks`）

---

## 4. 實作範圍

### 新增

- `MERGED_TAB_ID = '__merged__'` 常數
- `mergedProjectIds` state（從 localStorage lazy 初始化）
- `previousProjectIdRef` useRef（記錄前一個非合併的 activeProjectId）
- `MergedProjectModal` component（專案勾選 Modal，複用於首次設定與重新設定）
- 合併 tab 的 banner component（inline 或小 component）

### 修改

- 分頁列渲染：在 `projects.map(...)` 後加合併 tab
- `activeProject` 邏輯：`activeProjectId === '__merged__'` 時使用合成物件
- `allTasks` 來源：`activeProjectId === '__merged__'` 時取 `mergedTasks`
- 切換至合併 tab 時重置 `filterPerson = ""`
- 唯讀控制：以 `isReadOnly = activeProjectId === '__merged__'` flag 控制表單、按鈕、拖拉事件
- 建立專案時防禦性檢查 id 不等於 `MERGED_TAB_ID`

### 不在本次範圍

- 合併檢視的任何編輯功能
- 後端儲存合併設定
- 多組合併設定（僅支援一組）
- 合併 1 個專案時的警告提示

---

## 5. 資料流

```
useState lazy initializer
  → JSON.parse(localStorage['burnup_merged_project_ids']) ?? []
        ↓
mergedProjectIds (state)
        ↓
validMergedIds = mergedProjectIds.filter(id => projects.some(p => p.id === id))
        ↓
mergedTasks = projects
  .filter(p => validMergedIds.includes(p.id))
  .flatMap(p => p.tasks)
        ↓
activeProjectId === '__merged__'
  → activeProject = { id: '__merged__', name: '合併檢視', tasks: mergedTasks }
  → allTasks = mergedTasks
  → isReadOnly = true
        ↓
現有 normalizedTasks → chartData 計算鏈（不變）
```
