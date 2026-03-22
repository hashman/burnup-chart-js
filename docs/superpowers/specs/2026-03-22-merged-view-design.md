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

---

## 2. 首次進入設定 & 持久化

**localStorage key：** `burnup_merged_project_ids`（儲存 project id 陣列，JSON string）

**流程：**

1. 使用者點入合併 tab
2. 讀取 `localStorage.getItem('burnup_merged_project_ids')`
3. **若不存在（未設定）：** 顯示設定 Modal
   - 列出所有現有專案的 checkbox
   - 至少需勾選 1 個才能按「確認並檢視」
   - 確認後：將選取的 id 陣列寫入 localStorage，關閉 Modal，進入合併圖表
   - 取消後：切回上一個 activeProjectId
4. **若已存在：** 直接進入合併圖表頁，略過 Modal

**重新設定：** 合併圖表頁的 banner 上有「重新設定」按鈕，點擊重新開啟同一個 Modal，確認後更新 localStorage。

**專案被刪除的邊緣情況：** 每次進入合併 tab 時，從已儲存的 id 中過濾掉目前不存在的專案，若過濾後為空則自動觸發設定 Modal。

---

## 3. 合併圖表頁面

### 頂部 Banner

- 顯示目前合併的專案名稱（以 tag 形式列出）
- 右側「重新設定」按鈕（gear icon）
- 背景色：淺紫（`bg-violet-50`），與一般頁面有視覺區隔

### 圖表資料

- 將所有選定專案的 `tasks` 合併成一個陣列（`mergedTasks`）
- 直接傳入現有的 `normalizedTasks` → `chartData` useMemo 計算鏈
- **日期範圍：** 自動取 `mergedTasks` 中所有 tasks 的最早 `addedDate` 到最晚 `expectedEnd` / `actualEnd`（取兩者較晚者）
- 圖表呈現：預期進度線 + 實際進度線，與現有單一專案的 Burnup 圖相同

### 唯讀限制（隱藏以下元素）

- 新增任務表單
- 任務列表中的編輯/刪除按鈕
- 甘特圖的拖拉調整功能
- CSV 匯入按鈕（匯出可保留）

### 保留功能

- 人員篩選（`filterPerson` dropdown）
- 顯示/隱藏已完成任務 toggle
- 任務列表（唯讀顯示，可查看 logs）
- Burnup 圖 / 甘特圖切換（`chartView`），甘特圖唯讀顯示
- 全螢幕模式

---

## 4. 實作範圍

### 新增

- `MERGED_TAB_ID = '__merged__'` 常數
- `mergedProjectIds` state（從 localStorage 初始化）
- `MergedProjectModal` component（專案勾選 Modal）
- 合併 tab 的 banner component

### 修改

- 分頁列渲染：在 `projects.map(...)` 後加合併 tab
- `activeProject` / `allTasks` 邏輯：當 `activeProjectId === '__merged__'` 時，`allTasks` = 所有選定專案 tasks 的合併陣列
- 唯讀控制：在表單、編輯按鈕、拖拉事件處理加上 `isReadOnly` guard

### 不在本次範圍

- 合併檢視的任何編輯功能
- 後端儲存合併設定
- 多組合併設定（僅支援一組）

---

## 5. 資料流

```
localStorage['burnup_merged_project_ids']
        ↓
mergedProjectIds (state)
        ↓
mergedTasks = projects
  .filter(p => mergedProjectIds.includes(p.id))
  .flatMap(p => p.tasks)
        ↓
當 activeProjectId === '__merged__' 時
allTasks = mergedTasks
        ↓
現有 normalizedTasks → chartData 計算鏈（不變）
```
