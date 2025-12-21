# burnup-chart-js

React + Vite + Recharts 製作的 burnup 圖與任務管理小工具，支援多專案、工作日排程與 CSV 匯入/匯出。

## 功能特色
- 多專案分頁管理，支援新增與刪除
- 任務可直接編輯（名稱/點數/負責人/日期），可標記顯示在圖表上
- Burnup 圖同時呈現預期進度與實際進度
- 圖表區間自動或手動指定，支援全螢幕顯示
- 台灣工作日計算：預期完成日會跳過週末與國定假日
- 同人任務重疊警示（2 件警告、3 件以上危險）
- 任務紀錄（Log）新增/刪除
- 人員篩選、顯示/隱藏已完成
- CSV 匯入/匯出

## 開發環境
- Node.js 24+（專案內含 `.nvmrc`）
- npm

```bash
npm install
npm run dev
```

其他指令：
```bash
npm run build
npm run preview
```

## CSV 格式
匯入時依欄位順序解析（第一列若包含 `name` 會視為表頭略過）。

欄位順序：
1. Name
2. Points
3. People
4. AddedDate
5. ExpectedStart
6. ExpectedEnd
7. ActualStart
8. ActualEnd
9. ShowLabel

日期格式：`YYYY-MM-DD`

範例：
```csv
Name,Points,People,AddedDate,ExpectedStart,ExpectedEnd,ActualStart,ActualEnd,ShowLabel
API 設計,5,Alice,2024-03-01,2024-03-01,2024-03-07,2024-03-02,2024-03-08,true
前端切版,8,Bob,2024-03-03,2024-03-04,2024-03-15,,,false
```

注意：目前匯入時會忽略 `ShowLabel` 欄位，匯出會固定產出該欄位。

## 假日資料來源
台灣國定假日由 `date-holidays` library 依 TW 規則計算，不需遠端 API。

## 專案結構
- `src/App.jsx`：主要 UI 與邏輯
- `src/main.jsx`：入口檔
- `src/index.css`：Tailwind CSS 樣式

## 資料保存
目前資料僅保存在瀏覽器記憶體中，重新整理頁面會回到預設資料。
