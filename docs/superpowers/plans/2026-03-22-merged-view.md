# 合併檢視分頁 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有多專案 Burnup Chart 應用中新增一個「合併檢視」固定分頁，讓使用者勾選 N 個專案並將其 tasks 合併成一張唯讀 Burnup 圖。

**Architecture:** 所有邏輯集中在 `src/App.jsx`（2307 行的 React 單檔元件）。新增 `MERGED_TAB_ID` 常數、`mergedProjectIds` state（從 localStorage 初始化）、`validMergedIds`/`mergedTasks` useMemo，以及一個 `MergedProjectModal` inline component。當 `activeProjectId === '__merged__'` 時，`activeProject` 替換為合成物件，`isReadOnly = true` flag 控制所有編輯入口。

**Tech Stack:** React 18 + Vite 5，Playwright（e2e 測試），Tailwind CSS，lucide-react

---

## File Map

| 動作 | 路徑 | 內容 |
|------|------|------|
| Modify | `src/App.jsx` | 加入所有新 state/logic/UI |
| Modify | `e2e/burnup.spec.js` | 加入合併檢視的 e2e 測試情境 |

---

## Task 1: 加入常數、state、ref、isReadOnly

**Files:**
- Modify: `src/App.jsx:295-350` (state 宣告區)

- [ ] **Step 1: 在 `INITIAL_PROJECTS` 常數之前（約 line 160 之前）加入 `MERGED_TAB_ID` 常數**

找到：
```js
// Default Initial Data with Multiple Projects
const INITIAL_PROJECTS = [
```

在其正上方插入：
```js
const MERGED_TAB_ID = '__merged__';
```

- [ ] **Step 2: 在 `BurnupChartApp` function 內部，`activeLogTaskId` state 宣告附近（約 line 332），加入新 state 與 ref**

找到：
```js
  // State for Logs Modal
  const [activeLogTaskId, setActiveLogTaskId] = useState(null);
```

在其正上方插入：
```js
  // Merged View State
  const [mergedProjectIds, setMergedProjectIds] = useState(() => {
    try {
      const raw = localStorage.getItem('burnup_merged_project_ids');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showMergedModal, setShowMergedModal] = useState(false);
  const previousProjectIdRef = useRef(null);
```

- [ ] **Step 3: 確認 `npm run dev` 啟動無報錯**

```bash
npm run dev
```

預期：no compile errors，app 正常啟動

- [ ] **Step 4: commit**

```bash
git add src/App.jsx
git commit -m "feat: add MERGED_TAB_ID constant and merged view state"
```

---

## Task 2: 加入 validMergedIds、mergedTasks useMemo 與 isReadOnly

**Files:**
- Modify: `src/App.jsx:464-470` (activeProject / allTasks 派生區)

- [ ] **Step 1: 找到 `activeProject` useMemo（約 line 464），在其正上方加入 `validMergedIds` 與 `mergedTasks`**

找到：
```js
  const activeProject = useMemo(() =>
    projects.find(p => p.id === activeProjectId) || projects[0],
  [projects, activeProjectId]);
```

替換為：
```js
  const validMergedIds = useMemo(
    () => mergedProjectIds.filter(id => projects.some(p => p.id === id)),
    [projects, mergedProjectIds]
  );

  const mergedTasks = useMemo(
    () => projects.filter(p => validMergedIds.includes(p.id)).flatMap(p => p.tasks),
    [projects, validMergedIds]
  );

  const isReadOnly = activeProjectId === MERGED_TAB_ID;

  const activeProject = useMemo(() =>
    activeProjectId === MERGED_TAB_ID
      ? { id: MERGED_TAB_ID, name: '合併檢視', tasks: mergedTasks }
      : (projects.find(p => p.id === activeProjectId) || projects[0]),
  [projects, activeProjectId, mergedTasks]);
```

- [ ] **Step 2: 確認 `npm run dev` 無報錯**

- [ ] **Step 3: commit**

```bash
git add src/App.jsx
git commit -m "feat: add validMergedIds, mergedTasks memos and isReadOnly flag"
```

---

## Task 3: 加入 useEffect（previousProjectIdRef 追蹤 & stale id 清理 & Modal 觸發）

**Files:**
- Modify: `src/App.jsx`（在現有 useEffect 群組之後加入，約 line 380~462 區段的末端）

- [ ] **Step 1: 找到現有 useEffect 群組結尾（約 line 462），在其後加入三個新的 useEffect**

找到：
```js
  }, [updateTaskDates]);
```
（這是 Gantt drag useEffect 的結尾）

在其正下方插入：
```js
  // 追蹤前一個非 merged 的 activeProjectId，供 Modal 取消時還原
  useEffect(() => {
    if (activeProjectId !== MERGED_TAB_ID) {
      previousProjectIdRef.current = activeProjectId;
    }
  }, [activeProjectId]);

  // 切換至合併 tab 時重置 filterPerson
  useEffect(() => {
    if (activeProjectId === MERGED_TAB_ID) {
      setFilterPerson('');
    }
  }, [activeProjectId]);

  // 清理已刪除的 stale mergedProjectIds；若全數清空且在合併 tab 則直接開 Modal
  useEffect(() => {
    if (validMergedIds.length !== mergedProjectIds.length) {
      setMergedProjectIds(validMergedIds);
      localStorage.setItem('burnup_merged_project_ids', JSON.stringify(validMergedIds));
      if (validMergedIds.length === 0 && activeProjectId === MERGED_TAB_ID) {
        setShowMergedModal(true);
      }
    }
  }, [validMergedIds, mergedProjectIds.length, activeProjectId]);
```

- [ ] **Step 2: 確認 `npm run dev` 無報錯，切換 tab 不崩潰**

- [ ] **Step 3: commit**

```bash
git add src/App.jsx
git commit -m "feat: add useEffects for previousProjectIdRef, filterPerson reset, stale id cleanup"
```

---

## Task 4: MergedProjectModal component

**Files:**
- Modify: `src/App.jsx`（在 `CustomTooltip` component 下方，`BurnupChartApp` function 上方）

- [ ] **Step 1: 找到 `export default function BurnupChartApp()` 宣告（約 line 295），在其正上方插入 `MergedProjectModal` component**

```js
function MergedProjectModal({ projects, initialSelectedIds, onConfirm, onCancel }) {
  const [selected, setSelected] = React.useState(new Set(initialSelectedIds));

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80 max-w-full">
        <h2 className="text-base font-bold text-gray-800 mb-1">選擇要合併的專案</h2>
        <p className="text-xs text-gray-500 mb-4">可多選，設定將被記住</p>
        <div className="flex flex-col gap-3 mb-5">
          {projects.map(p => (
            <label key={p.id} className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="w-4 h-4 accent-indigo-600"
              />
              {p.name}
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            確認並檢視
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 確認 `npm run dev` 無報錯**

- [ ] **Step 3: commit**

```bash
git add src/App.jsx
git commit -m "feat: add MergedProjectModal component"
```

---

## Task 5: Modal 開關邏輯 & 合併 tab 點擊處理

**Files:**
- Modify: `src/App.jsx`（`BurnupChartApp` function 內，靠近其他 handler function 的區段）

- [ ] **Step 1: 在 `deleteProject` function 附近（約 line 1338），加入兩個 handler**

找到：
```js
  const deleteProject = async (e, projId) => {
```

在其正上方插入：
```js
  const handleMergedTabClick = () => {
    if (previousProjectIdRef.current === null) {
      previousProjectIdRef.current = projects[0]?.id ?? null;
    }
    setActiveProjectId(MERGED_TAB_ID);
    setFilterPerson('');
  };

  const handleMergedModalConfirm = (ids) => {
    setMergedProjectIds(ids);
    localStorage.setItem('burnup_merged_project_ids', JSON.stringify(ids));
    setShowMergedModal(false);
  };

  const handleMergedModalCancel = () => {
    setShowMergedModal(false);
    const fallback = previousProjectIdRef.current ?? projects[0]?.id;
    if (fallback) setActiveProjectId(fallback);
  };
```

- [ ] **Step 2: 在現有的「進入合併 tab 時若未設定則開 Modal」的 reactive 觸發，加入 useEffect**

找到前面 Task 3 加入的三個 useEffect，在「切換至合併 tab 時重置 filterPerson」之後加入：

```js
  // 進入合併 tab 且尚未設定時，開啟 Modal
  useEffect(() => {
    if (activeProjectId === MERGED_TAB_ID && mergedProjectIds.length === 0) {
      setShowMergedModal(true);
    }
  }, [activeProjectId, mergedProjectIds.length]);
```

- [ ] **Step 3: 確認 `npm run dev` 無報錯**

- [ ] **Step 4: commit**

```bash
git add src/App.jsx
git commit -m "feat: add merged tab click handlers and modal trigger effect"
```

---

## Task 6: 加入合併 tab 到分頁列

**Files:**
- Modify: `src/App.jsx:1852`（tab bar 渲染，`projects.map(...)` 迴圈結尾之後）

- [ ] **Step 1: 找到分頁列結尾，在新增專案按鈕之前插入合併 tab**

找到（約 line 1852）：
```js
            {isCreatingProject ? (
```

在其正上方插入：
```js
            {/* Divider before merged tab */}
            <div className="w-px h-5 bg-gray-200 self-center mx-1" />

            {/* Merged View Tab */}
            <div
              onClick={handleMergedTabClick}
              className={`
                flex items-center gap-1.5 px-4 py-3 border-b-2 cursor-pointer whitespace-nowrap text-sm font-medium transition-colors
                ${activeProjectId === MERGED_TAB_ID
                  ? 'border-violet-500 text-violet-600 bg-violet-50/60 rounded-t-lg'
                  : 'border-dashed border-violet-300 text-violet-400 hover:text-violet-600 hover:border-violet-400'}
              `}
            >
              <TrendingUp size={14} />
              合併檢視
            </div>
```

- [ ] **Step 2: 確認 browser 可以看到合併 tab，點擊不崩潰**

- [ ] **Step 3: commit**

```bash
git add src/App.jsx
git commit -m "feat: add merged view tab to navigation bar"
```

---

## Task 7: 合併檢視 banner & Modal 渲染

**Files:**
- Modify: `src/App.jsx`（主要 return JSX，chart 區塊正上方）

- [ ] **Step 1: 找到 Modal 的渲染位置，在 return 的最上層 div 內最頂端加入 MergedProjectModal 渲染**

找到（約 line 1780）：
```js
      {/* Top Navigation / Tabs */}
```

在此之前插入：
```js
      {/* Merged Project Selection Modal */}
      {showMergedModal && (
        <MergedProjectModal
          projects={projects}
          initialSelectedIds={mergedProjectIds.length > 0 ? mergedProjectIds : []}
          onConfirm={handleMergedModalConfirm}
          onCancel={handleMergedModalCancel}
        />
      )}
```

- [ ] **Step 2: 找到 chart 區塊的起始位置（約 line 1892，`activeProject.name - 進度趨勢` 標題附近），在其正上方插入合併 banner**

找到：
```js
                  {activeProject.name} - {chartView === 'trend' ? '進度趨勢' : '資源甘特圖'}
```
往上找到包含此標題的整個 chart header div，在 **chart 主容器的頂部** 加入 banner（`isReadOnly` 時顯示）。

找到（約 line 1888）：
```js
                <div className="flex items-center justify-between mb-2">
```

在此正上方插入：
```js
                {/* Merged View Banner */}
                {isReadOnly && (
                  <div className="flex items-center justify-between px-1 py-2 mb-3 bg-violet-50 rounded-lg border border-violet-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">合併範圍：</span>
                      {validMergedIds.map(id => {
                        const proj = projects.find(p => p.id === id);
                        return proj ? (
                          <span key={id} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            {proj.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <button
                      onClick={() => setShowMergedModal(true)}
                      className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 px-2 py-1 rounded hover:bg-violet-100 transition"
                      title="重新設定合併專案"
                    >
                      <Settings size={12} />
                      重新設定
                    </button>
                  </div>
                )}
```

- [ ] **Step 3: 確認 banner 在合併 tab 下可見，「重新設定」開啟 Modal**

- [ ] **Step 4: commit**

```bash
git add src/App.jsx
git commit -m "feat: add merged view banner and modal render"
```

---

## Task 8: isReadOnly guards — 任務列表編輯停用

**Files:**
- Modify: `src/App.jsx:2148-2288` (task table rows)

- [ ] **Step 1: 停用 showLabel toggle 按鈕**

找到：
```js
                              <button
                                onClick={(e) => { e.stopPropagation(); updateTask(task.id, 'showLabel', !task.showLabel); }}
```

替換為：
```js
                              <button
                                onClick={(e) => { e.stopPropagation(); if (!isReadOnly) updateTask(task.id, 'showLabel', !task.showLabel); }}
                                disabled={isReadOnly}
```

- [ ] **Step 2: 任務名稱 input 加 readOnly**

找到：
```js
                                onChange={(e) => updateTask(task.id, 'name', e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 p-0 font-medium text-gray-900"
```

替換為：
```js
                                onChange={(e) => { if (!isReadOnly) updateTask(task.id, 'name', e.target.value); }}
                                readOnly={isReadOnly}
                                className={`w-full bg-transparent border-none focus:ring-0 p-0 font-medium text-gray-900 ${isReadOnly ? 'cursor-default' : ''}`}
```

- [ ] **Step 3: 點數 input 加 readOnly**

找到：
```js
                                value={task.points}
                                disabled={!!isCompleted}
                                onChange={(e) => updateTask(task.id, 'points', e.target.value)}
                                className={`w-full bg-transparent border-none focus:ring-0 p-0 text-center font-mono ${isCompleted ? 'text-gray-400 cursor-not-allowed' : ''}`}
```

替換為：
```js
                                value={task.points}
                                disabled={!!isCompleted || isReadOnly}
                                onChange={(e) => { if (!isReadOnly) updateTask(task.id, 'points', e.target.value); }}
                                className={`w-full bg-transparent border-none focus:ring-0 p-0 text-center font-mono ${(isCompleted || isReadOnly) ? 'text-gray-400 cursor-not-allowed' : ''}`}
```

- [ ] **Step 4: 負責人 input 加 readOnly**

找到：
```js
                                value={task.people}
                                disabled={!!isCompleted}
                                onChange={(e) => updateTask(task.id, 'people', e.target.value)}
                                className={`w-full bg-transparent border-none focus:ring-0 p-0 ${isCompleted ? 'text-gray-400 cursor-not-allowed' : ''}`}
```

替換為：
```js
                                value={task.people}
                                disabled={!!isCompleted || isReadOnly}
                                onChange={(e) => { if (!isReadOnly) updateTask(task.id, 'people', e.target.value); }}
                                className={`w-full bg-transparent border-none focus:ring-0 p-0 ${(isCompleted || isReadOnly) ? 'text-gray-400 cursor-not-allowed' : ''}`}
```

- [ ] **Step 5: 新增日 input 加 readOnly**

找到：
```js
                                value={task.addedDate}
                                onChange={(e) => updateTask(task.id, 'addedDate', e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-500 text-xs"
```

替換為：
```js
                                value={task.addedDate}
                                readOnly={isReadOnly}
                                onChange={(e) => { if (!isReadOnly) updateTask(task.id, 'addedDate', e.target.value); }}
                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-500 text-xs"
```

- [ ] **Step 6: 預期起/迄 date inputs 加 readOnly（2 個）**

找到（expectedStart）：
```js
                                value={task.expectedStart}
                                onChange={(e) => updateTask(task.id, 'expectedStart', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-blue-200 focus:border-blue-400 p-0 text-xs text-blue-800"
                                title="修改開始日期會自動推算結束日期"
```

替換為：
```js
                                value={task.expectedStart}
                                readOnly={isReadOnly}
                                onChange={(e) => { if (!isReadOnly) updateTask(task.id, 'expectedStart', e.target.value); }}
                                className="w-full bg-transparent border-b border-transparent hover:border-blue-200 focus:border-blue-400 p-0 text-xs text-blue-800"
                                title="修改開始日期會自動推算結束日期"
```

找到（expectedEnd）：
```js
                                value={task.expectedEnd}
                                onChange={(e) => updateTask(task.id, 'expectedEnd', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-blue-200 focus:border-blue-400 p-0 text-xs text-blue-800"
```

替換為：
```js
                                value={task.expectedEnd}
                                readOnly={isReadOnly}
                                onChange={(e) => { if (!isReadOnly) updateTask(task.id, 'expectedEnd', e.target.value); }}
                                className="w-full bg-transparent border-b border-transparent hover:border-blue-200 focus:border-blue-400 p-0 text-xs text-blue-800"
```

- [ ] **Step 7: 實際起/迄 date inputs 加 readOnly（2 個）**

找到（actualStart）：
```js
                                value={task.actualStart}
                                onChange={(e) => updateTask(task.id, 'actualStart', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-emerald-200 focus:border-emerald-400 p-0 text-xs text-emerald-800"
```

替換為：
```js
                                value={task.actualStart}
                                readOnly={isReadOnly}
                                onChange={(e) => { if (!isReadOnly) updateTask(task.id, 'actualStart', e.target.value); }}
                                className="w-full bg-transparent border-b border-transparent hover:border-emerald-200 focus:border-emerald-400 p-0 text-xs text-emerald-800"
```

找到（actualEnd）：
```js
                                value={task.actualEnd}
                                onChange={(e) => updateTask(task.id, 'actualEnd', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-emerald-200 focus:border-emerald-400 p-0 text-xs text-emerald-800 font-bold"
```

替換為：
```js
                                value={task.actualEnd}
                                readOnly={isReadOnly}
                                onChange={(e) => { if (!isReadOnly) updateTask(task.id, 'actualEnd', e.target.value); }}
                                className="w-full bg-transparent border-b border-transparent hover:border-emerald-200 focus:border-emerald-400 p-0 text-xs text-emerald-800 font-bold"
```

- [ ] **Step 5: 隱藏 Log 按鈕與刪除按鈕**

找到操作欄（約 line 2263）：
```js
                            <td className="px-2 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveLogTaskId(task.id);
```

在整個 `<div className="flex items-center justify-end gap-1">` 的兩個按鈕外加條件：

```js
                            <td className="px-2 py-2 text-right">
                              {!isReadOnly && (
                                <div className="flex items-center justify-end gap-1">
                                  {/* log button */}
                                  ...
                                  {/* delete button */}
                                  ...
                                </div>
                              )}
                            </td>
```

- [ ] **Step 6: 確認合併 tab 下任務列表無法編輯，一般 tab 正常**

- [ ] **Step 7: commit**

```bash
git add src/App.jsx
git commit -m "feat: apply isReadOnly guards to task table inputs and action buttons"
```

---

## Task 9: isReadOnly guards — 新增表單、CSV 匯入、甘特拖拉

**Files:**
- Modify: `src/App.jsx`（表單區、CSV import 按鈕、Gantt drag handler）

- [ ] **Step 1: 隱藏新增任務表單區塊**

找到（約 line 1905）：
```js
          {showAddTask && (
```

替換為：
```js
          {showAddTask && !isReadOnly && (
```

同樣找到「開啟新增面板」按鈕（約 line 2068）：
```js
                   {!showAddTask && (
                     <button
                       onClick={() => setShowAddTask(true)}
```

替換為：
```js
                   {!showAddTask && !isReadOnly && (
                     <button
                       onClick={() => setShowAddTask(true)}
```

- [ ] **Step 2: 隱藏 CSV 匯入按鈕**

找到（約 line 1792）：
```js
              <button onClick={() => fileInputRef.current.click()} className="p-2 text-gray-500 hover:text-indigo-600 transition" title="匯入 CSV">
```

替換為：
```js
              {!isReadOnly && (
                <button onClick={() => fileInputRef.current.click()} className="p-2 text-gray-500 hover:text-indigo-600 transition" title="匯入 CSV">
                  <Upload size={20} />
                </button>
              )}
```

（同時移除原本的 `<Upload size={20} />` 與 `</button>` 讓結構正確）

- [ ] **Step 3: 停用 Gantt 拖拉的 mousedown 事件（共 6 處）**

App.jsx 中有 6 個 `onMouseDown` 綁定（line 882, 895, 906, 919, 951, 963）。逐一套用以下模式：

找到（plan bar，line 882）：
```js
                          onMouseDown={(e) => handleBarMouseDown(e, task, 'plan', task.expectedStart, task.expectedEnd)}
```
替換為：
```js
                          onMouseDown={isReadOnly ? undefined : (e) => handleBarMouseDown(e, task, 'plan', task.expectedStart, task.expectedEnd)}
```

找到（plan resize handle，line 895）：
```js
                            onMouseDown={(e) => handleResizeMouseDown(e, task, 'plan', task.expectedStart, task.expectedEnd)}
```
替換為：
```js
                            onMouseDown={isReadOnly ? undefined : (e) => handleResizeMouseDown(e, task, 'plan', task.expectedStart, task.expectedEnd)}
```

找到（actual bar，line 906）：
```js
                          onMouseDown={(e) => handleBarMouseDown(e, task, 'actual', task.actualStart, task.actualEnd)}
```
替換為：
```js
                          onMouseDown={isReadOnly ? undefined : (e) => handleBarMouseDown(e, task, 'actual', task.actualStart, task.actualEnd)}
```

找到（actual resize handle，line 919）：
```js
                            onMouseDown={(e) => handleResizeMouseDown(e, task, 'actual', task.actualStart, task.actualEnd)}
```
替換為：
```js
                            onMouseDown={isReadOnly ? undefined : (e) => handleResizeMouseDown(e, task, 'actual', task.actualStart, task.actualEnd)}
```

找到（第二個 plan bar，line 951）：
```js
                      onMouseDown={(e) => handleBarMouseDown(e, task, 'plan', task.expectedStart, task.expectedEnd)}
```
替換為：
```js
                      onMouseDown={isReadOnly ? undefined : (e) => handleBarMouseDown(e, task, 'plan', task.expectedStart, task.expectedEnd)}
```

找到（第二個 plan resize handle，line 963）：
```js
                        onMouseDown={(e) => handleResizeMouseDown(e, task, 'plan', task.expectedStart, task.expectedEnd)}
```
替換為：
```js
                        onMouseDown={isReadOnly ? undefined : (e) => handleResizeMouseDown(e, task, 'plan', task.expectedStart, task.expectedEnd)}
```

- [ ] **Step 4: 啟動 dev server，切到合併 tab，驗證：**
  - 無新增表單
  - 無 CSV 匯入按鈕
  - 甘特圖 bar 無法拖動

- [ ] **Step 5: commit**

```bash
git add src/App.jsx
git commit -m "feat: hide add form and CSV import, disable gantt drag in read-only mode"
```

---

## Task 10: 防禦性 ID 保護（建立專案時排除 `__merged__`）

**Files:**
- Modify: `src/App.jsx`（`createProject` 或新增專案的 handler，約 line 1260~1310 區段）

- [ ] **Step 1: 找到新增專案的 handler，加入 ID 防禦檢查**

找到 `addProject` 或相關 handler（search `POST.*projects` 或 `isCreatingProject`），在產生 project id 處加入：

```js
// 防禦性保護：確保 id 不等於 MERGED_TAB_ID
const newId = payload.id === MERGED_TAB_ID ? `proj_${Date.now()}` : payload.id;
```

若 project id 是由後端產生（`proj_<uuid>`），則前端的防禦只需針對 local-only 路徑。在 `generateId()` 呼叫後加：

```js
let newProjId = generateId();
if (newProjId === MERGED_TAB_ID) newProjId = generateId(); // 極低機率防禦
```

- [ ] **Step 2: commit**

```bash
git add src/App.jsx
git commit -m "feat: add defensive ID protection to prevent __merged__ collision"
```

---

## Task 11: E2E 測試

**Files:**
- Modify: `e2e/burnup.spec.js`

- [ ] **Step 1: 在 `e2e/burnup.spec.js` 末尾加入以下測試情境**

```js
test.describe('合併檢視', () => {
  test('Scenario: 首次進入合併 tab 應出現 Modal，確認後顯示 banner', async ({ page }) => {
    // 清除 localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('burnup_merged_project_ids'));
    await page.reload();

    // 點擊合併 tab
    await page.getByText('合併檢視').click();

    // Modal 出現
    await expect(page.getByText('選擇要合併的專案')).toBeVisible();

    // 勾選第一個 checkbox（至少一個）
    await page.locator('input[type="checkbox"]').first().check();

    // 點確認
    await page.getByRole('button', { name: '確認並檢視' }).click();

    // Modal 消失，banner 出現
    await expect(page.getByText('選擇要合併的專案')).not.toBeVisible();
    await expect(page.getByText('合併範圍：')).toBeVisible();
  });

  test('Scenario: 再次進入合併 tab 不再出現 Modal（localStorage 已設定）', async ({ page }) => {
    await page.goto('/');

    // 先設定 localStorage
    await page.evaluate(() => {
      localStorage.setItem('burnup_merged_project_ids', JSON.stringify(['proj_1']));
    });
    await page.reload();

    // 點擊合併 tab
    await page.getByText('合併檢視').click();

    // Modal 不出現
    await expect(page.getByText('選擇要合併的專案')).not.toBeVisible();

    // banner 出現
    await expect(page.getByText('合併範圍：')).toBeVisible();
  });

  test('Scenario: 合併 tab 唯讀 — 無新增表單、無刪除按鈕', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('burnup_merged_project_ids', JSON.stringify(['proj_1']));
    });
    await page.reload();

    await page.getByText('合併檢視').click();

    // 無新增任務表單的 submit 按鈕
    await expect(page.getByRole('button', { name: '加入任務' })).not.toBeVisible();

    // 無 CSV 匯入按鈕（title 屬性辨識）
    await expect(page.locator('button[title="匯入 CSV"]')).not.toBeVisible();
  });

  test('Scenario: 取消 Modal 應切回上一個 tab', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('burnup_merged_project_ids'));
    await page.reload();

    // 先在第一個 tab
    const firstTabName = await page.locator('.border-indigo-500').first().textContent();

    // 點合併 tab → Modal 出現
    await page.getByText('合併檢視').click();
    await expect(page.getByText('選擇要合併的專案')).toBeVisible();

    // 取消
    await page.getByRole('button', { name: '取消' }).click();

    // Modal 消失，合併 tab 不再是 active
    await expect(page.getByText('選擇要合併的專案')).not.toBeVisible();
    await expect(page.locator('.border-indigo-500')).not.toHaveText('合併檢視');
  });

  test('Scenario: 重新設定可更改合併的專案', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('burnup_merged_project_ids', JSON.stringify(['proj_1']));
    });
    await page.reload();

    await page.getByText('合併檢視').click();
    await expect(page.getByText('合併範圍：')).toBeVisible();

    // 點重新設定
    await page.getByRole('button', { name: '重新設定' }).click();
    await expect(page.getByText('選擇要合併的專案')).toBeVisible();

    // 取消重新設定 → 仍在合併 tab
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByText('合併範圍：')).toBeVisible();
  });
});
```

- [ ] **Step 2: 執行 e2e 測試**

```bash
npm run test:e2e -- --project=chromium e2e/burnup.spec.js
```

預期：所有合併檢視測試通過

- [ ] **Step 3: 若有測試失敗，根據錯誤訊息修正 App.jsx 的對應位置，重新執行直到全過**

- [ ] **Step 4: commit**

```bash
git add e2e/burnup.spec.js src/App.jsx
git commit -m "test: add e2e scenarios for merged view tab"
```

---

## 完成驗收清單

- [ ] 合併 tab 在分頁列最右側，視覺上與一般 tab 不同
- [ ] 首次點入彈出 Modal，需勾選至少 1 個，確認後進入圖表
- [ ] 再次點入不再彈 Modal，直接顯示合併圖表
- [ ] banner 顯示合併專案名稱，「重新設定」按鈕可重新開 Modal
- [ ] 取消 Modal 切回前一個 tab
- [ ] 合併 tab 下：無新增表單、無編輯輸入、無刪除/Log 按鈕、無 CSV 匯入
- [ ] 甘特圖在合併 tab 下無法拖拉
- [ ] 人員篩選、顯示/隱藏已完成正常運作
- [ ] 刪除已選專案後 banner 自動更新，若全刪則重開 Modal
- [ ] localStorage 在重整後保持設定
