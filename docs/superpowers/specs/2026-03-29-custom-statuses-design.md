# Custom Statuses Design

## Overview

讓使用者可以自訂 Kanban 看板的狀態欄位——改名、新增、刪除、重新排序。預設提供三個狀態（待辦、進行中、已完成），但使用者可以自由調整。所有操作直接在 Kanban 看板上 inline 完成。

## Constraints

- 全域設定：所有 Todo 共用同一組狀態
- 至少保留一個「起始」狀態和一個「完成」狀態
- 使用者可自訂欄位順序

## Data Model

### Status Table

新增 `statuses` 資料表：

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | TEXT (PK) | yes | UUID |
| `name` | TEXT | yes | 顯示名稱（如「待辦」、「Review」） |
| `sort_order` | REAL | yes | 排序順序，REAL 方便中間插入 |
| `is_default_start` | INTEGER | yes | 是否為起始狀態（0/1），全域唯一 |
| `is_default_end` | INTEGER | yes | 是否為完成狀態（0/1），全域唯一 |

### 預設資料

DB 初始化時，若 `statuses` 表為空，自動建立：

| id | name | sort_order | is_default_start | is_default_end |
|----|------|------------|------------------|----------------|
| (generated) | 待辦 | 0 | 1 | 0 |
| (generated) | 進行中 | 1 | 0 | 0 |
| (generated) | 已完成 | 2 | 0 | 1 |

### Todo 關聯變更

- Todo 的 `status` 欄位從硬編碼字串（`todo` / `in_progress` / `done`）改為存放 **status id**
- 加上 `FOREIGN KEY (status) REFERENCES statuses(id)`
- Migration：既有 Todo 的硬編碼字串對應到新建的 status id

## Backend API

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/statuses` | 取得所有狀態，按 `sort_order` 排序 |
| `POST` | `/api/statuses` | 新增狀態。Body: `{ name, sort_order? }` |
| `PATCH` | `/api/statuses/:id` | 更新狀態（改名、改 sort_order、改 is_default_start/end） |
| `DELETE` | `/api/statuses/:id` | 刪除狀態。Query/Body: `{ migrate_to }` |
| `POST` | `/api/statuses/reorder` | 批次更新排序。Body: `[{ id, sort_order }]` |

### Pydantic Models

```python
class StatusCreate(BaseModel):
    name: str
    sort_order: Optional[float] = None  # 若未提供，自動放在最後

class StatusUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[float] = None
    is_default_start: Optional[bool] = None
    is_default_end: Optional[bool] = None

class StatusOut(BaseModel):
    id: str
    name: str
    sort_order: float
    is_default_start: bool
    is_default_end: bool

class StatusReorderItem(BaseModel):
    id: str
    sort_order: float
```

### 驗證邏輯

- `name` 不可為空字串
- 建立/更新 Todo 時，`status` 必須是存在的 status id
- 刪除狀態時：
  - 若為唯一的 start 或 end 狀態 → 拒絕刪除（400）
  - 若有 Todo 使用該狀態 → 必須提供 `migrate_to`（有效的其他 status id），後端將相關 Todo 遷移
  - 若無 Todo 使用 → 直接刪除
- 設定 `is_default_start=true` 時，自動將原本的 start 狀態取消
- 設定 `is_default_end=true` 時，自動將原本的 end 狀態取消

## Frontend UI

### Kanban 欄位動態渲染

- 不再硬編碼三欄，改為根據 `GET /api/statuses` 回傳的資料動態渲染
- App 啟動時（或切換到 Todo Tab 時）載入狀態清單

### Inline 編輯欄位名稱

- 欄位標題顯示為文字，**雙擊**進入編輯模式（input 取代文字）
- 按 **Enter** 或**失焦**時呼叫 `PATCH /api/statuses/:id` 儲存
- 按 **Esc** 取消編輯
- start/end 狀態旁顯示小標記（如 icon 或 badge），告知使用者其特殊角色

### 新增狀態

- 最後一個欄位右側顯示「**＋**」按鈕
- 點擊後呼叫 `POST /api/statuses` 建立新狀態（預設 sort_order 插在 end 狀態之前）
- 新欄位自動進入編輯模式讓使用者命名

### 刪除狀態

- 每個欄位標題旁有「**×**」按鈕（hover 時顯示）
- start/end 狀態的刪除按鈕隱藏或 disabled
- 點擊刪除時：
  - 該狀態下無 Todo → 直接刪除（帶確認 dialog）
  - 該狀態下有 Todo → 確認 dialog 中提供下拉選單，讓使用者選擇遷移目標狀態

### 欄位拖曳排序

- 欄位標題區域可拖曳調整順序（使用現有 DnD 機制）
- 拖曳完成後呼叫 `POST /api/statuses/reorder` 批次更新

### 狀態角色切換

- 欄位 hover menu 或右鍵選單可設定「設為起始狀態」/「設為完成狀態」
- 同一時間只能有一個 start 和一個 end

### 其他前端調整

- 新增 Todo 時，預設 status 為 `is_default_start=1` 的狀態 id
- Todo Card 的 Done 樣式（半透明 + 刪除線）改為判斷狀態是否為 `is_default_end=1`
- 「隱藏已完成」toggle 改為隱藏 `is_default_end=1` 的欄位
- Task Detail Modal 中的 Todo checklist：勾選 = 設為 end 狀態，取消勾選 = 設為 start 狀態

## Migration Strategy

1. DB 初始化時建立 `statuses` 表
2. 若 `statuses` 表為空，插入三筆預設狀態
3. 若已有 Todo 且 `status` 欄位存硬編碼字串：
   - `"todo"` → 對應 is_default_start=1 的 status id
   - `"in_progress"` → 對應中間狀態的 status id
   - `"done"` → 對應 is_default_end=1 的 status id
4. 更新 Todo 表的 `status` 欄位為 status id

## Testing

### 後端單元/整合測試

- `GET /api/statuses`：回傳預設三筆，按 sort_order 排序
- `POST /api/statuses`：建立新狀態、驗證 name 不可為空
- `PATCH /api/statuses/:id`：改名、改 sort_order、切換 start/end flag
- `DELETE /api/statuses/:id`：
  - 無 Todo → 成功刪除
  - 有 Todo + 提供 migrate_to → 成功刪除並遷移
  - 有 Todo + 未提供 migrate_to → 400
  - 刪除唯一 start/end → 400
- `POST /api/statuses/reorder`：批次更新排序
- Todo CRUD 驗證 status 必須為有效 status id
- Migration：舊字串 status 正確對應到 status id

### Playwright E2E 測試

測試檔案：`e2e/custom-statuses.spec.js`

沿用現有 e2e 測試模式（`API_BASE` helper、`beforeEach` 清理、fetch API seed 資料）。

**測試案例：**

1. **預設狀態顯示**
   - 進入 Todo Tab，應看到三個預設欄位（待辦、進行中、已完成）

2. **Inline 改名**
   - 雙擊欄位標題 → 出現 input
   - 輸入新名稱 → 按 Enter
   - 驗證欄位標題已更新
   - 重新載入頁面後名稱仍為新名稱

3. **新增狀態**
   - 點擊「＋」按鈕
   - 輸入名稱並確認
   - 驗證新欄位出現在正確位置（end 狀態之前）

4. **刪除狀態（無 Todo）**
   - 新增一個自訂狀態
   - hover 並點擊「×」
   - 確認 dialog 後，驗證欄位消失

5. **刪除狀態（有 Todo，需遷移）**
   - 在自訂狀態下建立 Todo
   - 刪除該狀態 → 選擇遷移目標
   - 驗證 Todo 出現在目標欄位中

6. **禁止刪除唯一 start/end 狀態**
   - 嘗試刪除 start 或 end 狀態
   - 驗證刪除按鈕不可用或操作被阻止

7. **欄位拖曳排序**
   - 拖曳欄位到新位置
   - 驗證順序已更新
   - 重新載入後順序仍正確

8. **Todo 拖曳跨自訂欄位**
   - 建立 Todo 在起始狀態
   - 拖曳到自訂狀態欄位
   - 驗證 Todo 的 status 已更新

## Edge Cases

- **所有中間狀態被刪除**：只剩 start 和 end 兩欄，仍可正常運作
- **狀態名稱重複**：允許（不以名稱作唯一鍵），使用者自行管理
- **並行修改**：前端樂觀更新 + API 回應確認，失敗時回滾並提示
- **大量狀態**：Kanban 欄位水平滾動（不限制最大數量）
