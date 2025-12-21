import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart, ReferenceLine, ReferenceDot, Label } from 'recharts';
import { Upload, Download, Plus, Trash2, Calendar, User, Layout, Briefcase, AlertTriangle, CheckCircle2, Filter, Lock, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, Eye, EyeOff, Settings, Percent, MessageSquare, X, Send, Tag, Maximize2, Minimize2, Check } from 'lucide-react';
import Holidays from 'date-holidays';

// --- Utility Functions ---

const generateId = () => Date.now() + Math.random().toString(36).substr(2, 9);

const normalizeDateString = (value) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) {
    const [year, month, day] = value.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().split('T')[0];
};
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
};

const buildTaskPayload = (task) => ({
  name: task.name || "",
  points: Number(task.points) || 0,
  people: task.people || "",
  addedDate: normalizeDateString(task.addedDate),
  expectedStart: normalizeDateString(task.expectedStart),
  expectedEnd: normalizeDateString(task.expectedEnd),
  actualStart: normalizeDateString(task.actualStart),
  actualEnd: normalizeDateString(task.actualEnd),
  showLabel: task.showLabel === true
});

/**
 * 自定義 Hook: 台灣行事曆邏輯
 * 使用 date-holidays library 提供日期計算方法
 */
const useTaiwanCalendar = () => {
  const holidayApi = useMemo(() => {
    const hd = new Holidays('TW');
    hd.setLanguages('zh');
    return hd;
  }, []);

  // 判斷是否為工作日
  const isWorkingDay = useCallback((dateStr) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return false;
    const day = date.getDay();
    // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) return false;
    if (holidayApi.isHoliday(date)) return false;
    return true;
  }, [holidayApi]);

  // 計算預期完成日 (跳過假日)
  const getExpectedEndDate = useCallback((startDateStr, points) => {
    if (!startDateStr || !points || points <= 0) return "";

    // 1. 如果開始日期是假日，先找到下一個工作日
    let d = new Date(startDateStr);
    while (!isWorkingDay(d.toISOString().split('T')[0])) {
      d.setDate(d.getDate() + 1);
    }

    // 2. 往後推算 (points - 1) 個工作天
    let remaining = parseInt(points) - 1;
    let currentDate = new Date(d);

    while (remaining > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      const dateStr = currentDate.toISOString().split('T')[0];
      if (isWorkingDay(dateStr)) {
        remaining--;
      }
    }

    return currentDate.toISOString().split('T')[0];
  }, [isWorkingDay]);

  const getExpectedPoints = useCallback((startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return 0;

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
    if (endDate < startDate) return 0;

    let cursor = new Date(startDate);
    let safeCount = 0;
    while (!isWorkingDay(cursor.toISOString().split('T')[0]) && safeCount < 3660) {
      cursor.setDate(cursor.getDate() + 1);
      safeCount++;
    }

    if (cursor > endDate) return 0;

    let points = 0;
    safeCount = 0;
    while (cursor <= endDate && safeCount < 3660) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (isWorkingDay(dateStr)) {
        points++;
      }
      cursor.setDate(cursor.getDate() + 1);
      safeCount++;
    }

    return points;
  }, [isWorkingDay]);

  return { isWorkingDay, getExpectedEndDate, getExpectedPoints, loading: false };
};

// Generate a sequence of dates between start and end
const getDateRange = (startDateStr, endDateStr) => {
  const startDate = normalizeDateString(startDateStr);
  const endDate = normalizeDateString(endDateStr);
  if (!startDate || !endDate) return [];
  const dates = [];
  let currentDate = new Date(startDate);
  const endDateValue = new Date(endDate);

  // Safety break to prevent infinite loops if dates are crazy
  let safeCount = 0;
  while (currentDate <= endDateValue && safeCount < 3650) { // Limit to ~10 years
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
    safeCount++;
  }
  return dates;
};

// Default Initial Data with Multiple Projects
const INITIAL_PROJECTS = [
  {
    id: 'proj_1',
    name: "專案 Alpha (電商網站 - 2024 Q1)",
    tasks: [
      // --- 一月 (January) ---
      // Alice Task 1: 1/1 - 1/3
      {
        id: 't1',
        name: "需求訪談",
        points: 3,
        people: "Alice",
        addedDate: "2024-01-01",
        expectedStart: "2024-01-01",
        expectedEnd: "2024-01-03",
        actualStart: "2024-01-01",
        actualEnd: "2024-01-03",
        showLabel: true,
        logs: [
          { id: 'l1', date: '2024-01-01', content: '與客戶確認了初步需求，主要針對首頁與商品頁。' },
          { id: 'l2', date: '2024-01-03', content: '需求確認完畢，客戶簽名。' }
        ]
      },
      // Bob Task 2: 1/3 - 1/7
      { id: 't2', name: "UI 設計 (首頁)", points: 5, people: "Bob", addedDate: "2024-01-01", expectedStart: "2024-01-02", expectedEnd: "2024-01-06", actualStart: "2024-01-03", actualEnd: "2024-01-07", showLabel: false, logs: [] },
      // Alice Task 3: 1/1 - 1/2 (Overlap with t1)
      { id: 't3', name: "資料庫 Schema 設計", points: 8, people: "Alice", addedDate: "2024-01-02", expectedStart: "2024-01-01", expectedEnd: "2024-01-02", actualStart: "2024-01-01", actualEnd: "2024-01-02", showLabel: false, logs: [] },
      // Alice Task 4: Start 1/2 (Overlap with t1 and t3 -> Red Alert!)
      { id: 't4', name: "API 架構規劃", points: 5, people: "Alice", addedDate: "2024-01-03", expectedStart: "2024-01-02", expectedEnd: "2024-01-05", actualStart: "2024-01-02", actualEnd: "2024-01-05", showLabel: true, logs: [] },

      // --- 二月 (February) ---
      { id: 't6', name: "會員系統後端開發", points: 13, people: "Charlie", addedDate: "2024-01-15", expectedStart: "2024-02-01", expectedEnd: "2024-02-14", actualStart: "2024-02-01", actualEnd: "2024-02-15", showLabel: true, logs: [] },
      {
        id: 't7',
        name: "前端切版 (會員中心)",
        points: 8,
        people: "Bob",
        addedDate: "2024-01-20",
        expectedStart: "2024-02-05",
        expectedEnd: "2024-02-12",
        actualStart: "2024-02-06",
        actualEnd: "",
        showLabel: false,
        logs: [
          { id: 'l3', date: '2024-02-06', content: '開始切版，遇到 Tailwind CSS 設定問題，已解決。' },
          { id: 'l4', date: '2024-02-08', content: '手機版跑版，需要調整 RWD 設定。' }
        ]
      },
      { id: 't8', name: "金流串接 (ECPay)", points: 8, people: "Alice", addedDate: "2024-01-25", expectedStart: "2024-02-15", expectedEnd: "2024-02-23", actualStart: "", actualEnd: "", showLabel: false, logs: [] },
      // Bob Overlap Warning test in Feb
      { id: 't8_1', name: "前端切版 (商品頁)", points: 5, people: "Bob", addedDate: "2024-01-25", expectedStart: "2024-02-10", expectedEnd: "2024-02-15", actualStart: "", actualEnd: "", showLabel: false, logs: [] },

      // --- 三月 (March) ---
      { id: 't9', name: "購物車核心功能", points: 13, people: "Charlie", addedDate: "2024-02-10", expectedStart: "2024-03-01", expectedEnd: "2024-03-15", actualStart: "", actualEnd: "", showLabel: true, logs: [] },
      { id: 't10', name: "前端串接 (購物車)", points: 8, people: "Bob", addedDate: "2024-02-15", expectedStart: "2024-03-10", expectedEnd: "2024-03-18", actualStart: "", actualEnd: "", showLabel: false, logs: [] },
      { id: 't11', name: "訂單管理後台", points: 8, people: "Alice", addedDate: "2024-02-20", expectedStart: "2024-03-05", expectedEnd: "2024-03-12", actualStart: "", actualEnd: "", showLabel: false, logs: [] },
      { id: 't12', name: "系統整合測試 (SIT)", points: 5, people: "QA Team", addedDate: "2024-03-01", expectedStart: "2024-03-20", expectedEnd: "2024-03-25", actualStart: "", actualEnd: "", showLabel: true, logs: [] },
      { id: 't13', name: "正式環境部署", points: 3, people: "Alice", addedDate: "2024-03-01", expectedStart: "2024-03-28", expectedEnd: "2024-03-30", actualStart: "", actualEnd: "", showLabel: true, logs: [] },
    ]
  },
  {
    id: 'proj_2',
    name: "專案 Beta (內部系統)",
    tasks: [
      { id: 't5', name: "系統分析", points: 5, people: "Bob", addedDate: "2024-02-01", expectedStart: "2024-02-01", expectedEnd: "2024-02-05", actualStart: "2024-02-01", actualEnd: "2024-02-04", showLabel: false, logs: [] },
      { id: 't14', name: "HR 模組開發", points: 13, people: "Charlie", addedDate: "2024-02-10", expectedStart: "2024-02-15", expectedEnd: "2024-03-05", actualStart: "", actualEnd: "", showLabel: true, logs: [] },
    ]
  }
];

export default function BurnupChartApp() {
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState(INITIAL_PROJECTS[0].id);
  const [filterPerson, setFilterPerson] = useState("");
  const [showAddTask, setShowAddTask] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [projectNameDraft, setProjectNameDraft] = useState("");

  // New Project UI State
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Date Range State for Chart
  const [chartConfig, setChartConfig] = useState({
    isAuto: true,
    startDate: '',
    endDate: '',
    usePercentage: true
  });

  // State for Logs Modal
  const [activeLogTaskId, setActiveLogTaskId] = useState(null);
  const [newLogContent, setNewLogContent] = useState("");
  const [newLogDate, setNewLogDate] = useState(new Date().toISOString().split('T')[0]);

  const { getExpectedEndDate, getExpectedPoints, loading: holidayLoading } = useTaiwanCalendar();

  const [newTask, setNewTask] = useState({
    name: "",
    points: 1,
    people: "",
    addedDate: new Date().toISOString().split('T')[0],
    expectedStart: "",
    expectedEnd: "",
    actualStart: "",
    actualEnd: "",
    showLabel: false,
    logs: []
  });

  useEffect(() => {
    let isActive = true;

    const loadProjects = async () => {
      try {
        const data = await requestJson("/api/projects");
        if (!isActive) return;
        if (Array.isArray(data) && data.length > 0) {
          setProjects(data);
          setActiveProjectId(data[0].id);
          setApiAvailable(true);
        } else {
          const created = await requestJson("/api/projects", {
            method: "POST",
            body: JSON.stringify({ name: "新專案" })
          });
          if (!isActive) return;
          setProjects([created]);
          setActiveProjectId(created.id);
          setApiAvailable(true);
        }
      } catch (err) {
        if (!isActive) return;
        setApiAvailable(false);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadProjects();

    return () => {
      isActive = false;
    };
  }, []);

  const fileInputRef = useRef(null);

  const activeProject = useMemo(() =>
    projects.find(p => p.id === activeProjectId) || projects[0],
  [projects, activeProjectId]);

  const allTasks = activeProject.tasks;

  const uniquePeople = useMemo(() => {
    const people = new Set(allTasks.map(t => t.people?.trim()).filter(Boolean));
    return Array.from(people).sort();
  }, [allTasks]);

  const displayedTasks = useMemo(() => {
    let filtered = allTasks;
    if (filterPerson) {
      filtered = filtered.filter(t => t.people?.trim() === filterPerson);
    }
    if (!showCompleted) {
      filtered = filtered.filter(t => !(t.actualStart && t.actualEnd));
    }
    return filtered;
  }, [allTasks, filterPerson, showCompleted]);

  // Find active task object for modal
  const activeLogTask = useMemo(() =>
    allTasks.find(t => t.id === activeLogTaskId),
  [allTasks, activeLogTaskId]);

  // --- Workload Validation Logic ---
  const getTaskValidationStatus = (currentTask, tasksToValidateAgainst) => {
    if (!currentTask.people) return 'normal';

    const normalizePerson = (name) => name?.trim().toLowerCase();
    const currentPerson = normalizePerson(currentTask.people);

    const getRange = (t) => {
      const start = t.actualStart || t.expectedStart;
      const end = t.actualEnd || t.expectedEnd || start;
      return { start, end };
    };

    const currentRange = getRange(currentTask);
    if (!currentRange.start) return 'normal';

    let maxOverlapCount = 0;
    const start = new Date(currentRange.start);
    const end = currentRange.end ? new Date(currentRange.end) : new Date(start);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'normal';

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const activeTasksOnDay = tasksToValidateAgainst.filter(t => {
        if (normalizePerson(t.people) !== currentPerson) return false;
        const tRange = getRange(t);
        if (!tRange.start) return false;
        const tEnd = tRange.end || tRange.start;
        return tRange.start <= dateStr && tEnd >= dateStr;
      });

      if (activeTasksOnDay.length > maxOverlapCount) {
        maxOverlapCount = activeTasksOnDay.length;
      }
    }

    if (maxOverlapCount >= 3) return 'danger';
    if (maxOverlapCount === 2) return 'warning';
    return 'normal';
  };

  const getProgressStats = (task) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    let expectedPct = 0;
    if (task.expectedStart && task.expectedEnd) {
      const start = new Date(task.expectedStart);
      const end = new Date(task.expectedEnd);
      if (today >= end) {
        expectedPct = 100;
      } else if (today > start) {
        const total = end - start;
        const elapsed = today - start;
        expectedPct = total === 0 ? 100 : Math.round((elapsed / total) * 100);
      }
    }
    let actualPct = (task.actualStart && task.actualEnd) ? 100 : 0;
    return { expectedPct, actualPct };
  };

  // --- Chart Data Logic ---
  const { chartData, chartAnnotations } = useMemo(() => {
    if (allTasks.length === 0) return { chartData: [], chartAnnotations: [] };

    const normalizedTasks = allTasks.map(task => ({
      ...task,
      addedDate: normalizeDateString(task.addedDate),
      expectedStart: normalizeDateString(task.expectedStart),
      expectedEnd: normalizeDateString(task.expectedEnd),
      actualStart: normalizeDateString(task.actualStart),
      actualEnd: normalizeDateString(task.actualEnd)
    }));

    let minDate = '9999-12-31';
    let maxDate = '0000-01-01';

    normalizedTasks.forEach(t => {
      if (t.expectedStart && t.expectedStart < minDate) minDate = t.expectedStart;
      if (t.expectedEnd && t.expectedEnd > maxDate) maxDate = t.expectedEnd;
    });

    if (minDate === '9999-12-31' || maxDate === '0000-01-01') {
       normalizedTasks.forEach(t => {
        const dates = [t.addedDate, t.actualStart, t.actualEnd].filter(Boolean);
        dates.forEach(d => {
          if (d < minDate) minDate = d;
          if (d > maxDate) maxDate = d;
        });
      });
    }

    if (minDate === '9999-12-31') return { chartData: [], chartAnnotations: [] };

    const viewStart = chartConfig.isAuto ? minDate : (chartConfig.startDate || minDate);
    const viewEnd = chartConfig.isAuto ? maxDate : (chartConfig.endDate || maxDate);

    const timeline = getDateRange(viewStart, viewEnd);

    // Filter active tasks for calculation (scope adjusted to window)
    const activeTasks = normalizedTasks.filter(t => {
      const taskStart = t.expectedStart || t.addedDate || '9999-12-31';
      const taskEnd = t.actualEnd || t.expectedEnd || taskStart;
      return taskStart <= viewEnd && taskEnd >= viewStart;
    });

    // Calculate Fixed Total Scope (Denominator for Percentage Mode)
    const fixedTotalScope = activeTasks.reduce((acc, t) => acc + (parseInt(t.points) || 0), 0);

    const data = timeline.map(date => {
      let expectedCompleted = 0;
      let actualCompleted = 0;

      activeTasks.forEach(task => {
        const points = parseInt(task.points) || 0;

        if (task.expectedEnd && task.expectedEnd <= date) {
          expectedCompleted += points;
        }

        if (task.actualEnd && task.actualEnd <= date) {
          actualCompleted += points;
        }
      });

      const expectedPct = fixedTotalScope > 0 ? (expectedCompleted / fixedTotalScope) * 100 : 0;
      const actualPct = fixedTotalScope > 0 ? (actualCompleted / fixedTotalScope) * 100 : 0;

      return {
        date,
        ExpectedPct: parseFloat(expectedPct.toFixed(1)),
        ActualPct: parseFloat(actualPct.toFixed(1))
      };
    });

    // --- Generate Annotations ---
    // For tasks marked to show label, find their position on the chart
    const annotations = [];
    normalizedTasks.forEach(t => {
      if (t.showLabel) {
        // Decide which date to attach the label to.
        // Priority: Actual End > Actual Start > Expected Start > Added Date > Expected End
        const targetDate = t.actualEnd || t.actualStart || t.expectedStart || t.addedDate || t.expectedEnd;
        const normalizedTargetDate = normalizeDateString(targetDate);
        if (!normalizedTargetDate) return;

        // Find data point for this date to get Y value
        const point = data.find(d => d.date === normalizedTargetDate)
          || data.find(d => d.date > normalizedTargetDate)
          || data[data.length - 1];
        if (!point) return;

        // If task is done, stick to Actual line. If not, stick to Expected line.
        const yValue = t.actualEnd ? point.ActualPct : point.ExpectedPct;

        annotations.push({
          ...t,
          x: point.date,
          y: yValue,
          isActual: !!t.actualEnd
        });
      }
    });

    return { chartData: data, chartAnnotations: annotations };
  }, [allTasks, chartConfig]);

  const updateChartConfig = (field, value) => {
    setChartConfig(prev => ({
      ...prev,
      [field]: value,
      isAuto: (field === 'startDate' || field === 'endDate') ? false : (field === 'isAuto' ? value : prev.isAuto)
    }));
  };

  const updateNewTaskField = useCallback((field, value) => {
    const isDateField = [
      'addedDate',
      'expectedStart',
      'expectedEnd',
      'actualStart',
      'actualEnd'
    ].includes(field);
    const normalizedValue = isDateField ? normalizeDateString(value) : value;

    setNewTask(prev => {
      let updatedTask = { ...prev, [field]: normalizedValue };
      if (field === 'points' || field === 'expectedStart') {
        const points = field === 'points' ? normalizedValue : prev.points;
        const start = field === 'expectedStart' ? normalizedValue : prev.expectedStart;
        updatedTask.expectedEnd = start && points ? getExpectedEndDate(start, points) : "";
      }
      if (field === 'expectedEnd') {
        const start = prev.expectedStart;
        if (start && normalizedValue) {
          updatedTask.points = getExpectedPoints(start, normalizedValue);
        }
      }
      return updatedTask;
    });
  }, [getExpectedEndDate, getExpectedPoints]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.name || !newTask.addedDate || !activeProjectId) return;

    const taskPayload = buildTaskPayload(newTask);
    if (!taskPayload.expectedEnd && taskPayload.expectedStart && taskPayload.points) {
      taskPayload.expectedEnd = getExpectedEndDate(taskPayload.expectedStart, taskPayload.points);
    }

    if (apiAvailable) {
      try {
        const createdTask = await requestJson(
          `/api/projects/${activeProjectId}/tasks`,
          {
            method: "POST",
            body: JSON.stringify(taskPayload)
          }
        );
        setProjects(prevProjects => prevProjects.map(p => {
          if (p.id === activeProjectId) {
            return { ...p, tasks: [...p.tasks, createdTask] };
          }
          return p;
        }));
      } catch (err) {
        setApiAvailable(false);
        const fallbackTask = { ...taskPayload, id: generateId(), logs: [] };
        setProjects(prevProjects => prevProjects.map(p => {
          if (p.id === activeProjectId) {
            return { ...p, tasks: [...p.tasks, fallbackTask] };
          }
          return p;
        }));
      }
    } else {
      const task = { ...taskPayload, id: generateId(), logs: [] };
      setProjects(prevProjects => prevProjects.map(p => {
        if (p.id === activeProjectId) {
          return { ...p, tasks: [...p.tasks, task] };
        }
        return p;
      }));
    }
    setNewTask({ name: "", points: 1, people: newTask.people, addedDate: new Date().toISOString().split('T')[0], expectedStart: "", expectedEnd: "", actualStart: "", actualEnd: "", showLabel: false, logs: [] });
  };

  const updateTask = async (taskId, field, value) => {
    const isDateField = [
      'addedDate',
      'expectedStart',
      'expectedEnd',
      'actualStart',
      'actualEnd'
    ].includes(field);
    const normalizedValue = isDateField ? normalizeDateString(value) : value;

    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id === activeProjectId) {
        return {
          ...p,
          tasks: p.tasks.map(t => {
            if (t.id !== taskId) return t;
            let updatedTask = { ...t, [field]: normalizedValue };
            if (field === 'points' || field === 'expectedStart') {
              const points = field === 'points' ? normalizedValue : t.points;
              const start = field === 'expectedStart' ? normalizedValue : t.expectedStart;
              if (start && points) {
                updatedTask.expectedEnd = getExpectedEndDate(start, points);
              } else {
                updatedTask.expectedEnd = "";
              }
            }
            if (field === 'expectedEnd') {
              const start = t.expectedStart;
              if (start && normalizedValue) {
                updatedTask.points = getExpectedPoints(start, normalizedValue);
              }
            }
            return updatedTask;
          })
        };
      }
      return p;
    }));

    if (!apiAvailable) return;
    const currentTask = allTasks.find(t => t.id === taskId);
    if (!currentTask) return;

    const patch = { [field]: normalizedValue };
    if (field === 'points') {
      patch.points = Number(value) || 0;
    }
    if (field === 'showLabel') {
      patch.showLabel = value === true;
    }
    if (field === 'points' || field === 'expectedStart') {
      const points = field === 'points' ? Number(value) || 0 : Number(currentTask.points) || 0;
      const start = field === 'expectedStart' ? normalizedValue : currentTask.expectedStart;
      patch.expectedEnd = start && points ? getExpectedEndDate(start, points) : "";
    }
    if (field === 'expectedEnd') {
      const start = currentTask.expectedStart;
      if (start && normalizedValue) {
        patch.points = getExpectedPoints(start, normalizedValue);
      }
    }

    try {
      const updatedTask = await requestJson(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      setProjects(prevProjects => prevProjects.map(p => {
        if (p.id !== activeProjectId) return p;
        return {
          ...p,
          tasks: p.tasks.map(t => (t.id === taskId ? updatedTask : t))
        };
      }));
    } catch (err) {
      setApiAvailable(false);
    }
  };

  const deleteTask = async (taskId) => {
    if (!activeProjectId) return;

    if (apiAvailable) {
      try {
        await requestJson(`/api/tasks/${taskId}`, { method: "DELETE" });
      } catch (err) {
        setApiAvailable(false);
      }
    }

    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id === activeProjectId) {
        return { ...p, tasks: p.tasks.filter(t => t.id !== taskId) };
      }
      return p;
    }));
  };

  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!newLogContent || !activeLogTaskId) return;

    if (apiAvailable) {
      try {
        const createdLog = await requestJson(`/api/tasks/${activeLogTaskId}/logs`, {
          method: "POST",
          body: JSON.stringify({ date: newLogDate, content: newLogContent })
        });
        setProjects(prevProjects => prevProjects.map(p => {
          if (p.id === activeProjectId) {
            return {
              ...p,
              tasks: p.tasks.map(t => {
                if (t.id === activeLogTaskId) {
                  return { ...t, logs: [...(t.logs || []), createdLog] };
                }
                return t;
              })
            };
          }
          return p;
        }));
      } catch (err) {
        setApiAvailable(false);
        const fallbackLog = {
          id: generateId(),
          date: newLogDate,
          content: newLogContent
        };
        setProjects(prevProjects => prevProjects.map(p => {
          if (p.id === activeProjectId) {
            return {
              ...p,
              tasks: p.tasks.map(t => {
                if (t.id === activeLogTaskId) {
                  return { ...t, logs: [...(t.logs || []), fallbackLog] };
                }
                return t;
              })
            };
          }
          return p;
        }));
      }
    } else {
      const newLog = {
        id: generateId(),
        date: newLogDate,
        content: newLogContent
      };
      setProjects(prevProjects => prevProjects.map(p => {
        if (p.id === activeProjectId) {
          return {
            ...p,
            tasks: p.tasks.map(t => {
              if (t.id === activeLogTaskId) {
                return { ...t, logs: [...(t.logs || []), newLog] };
              }
              return t;
            })
          };
        }
        return p;
      }));
    }
    setNewLogContent("");
  };

  const handleDeleteLog = async (logId) => {
    if (!activeLogTaskId) return;

    if (apiAvailable) {
      try {
        await requestJson(`/api/logs/${logId}`, { method: "DELETE" });
      } catch (err) {
        setApiAvailable(false);
      }
    }

    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id === activeProjectId) {
        return {
          ...p,
          tasks: p.tasks.map(t => {
            if (t.id === activeLogTaskId) {
              return { ...t, logs: (t.logs || []).filter(l => l.id !== logId) };
            }
            return t;
          })
        };
      }
      return p;
    }));
  };

  const handleCreateProjectSave = async () => {
    if (!newProjectName.trim()) return;

    const projectName = newProjectName.trim();
    if (apiAvailable) {
      try {
        const createdProject = await requestJson("/api/projects", {
          method: "POST",
          body: JSON.stringify({ name: projectName })
        });
        setProjects(prevProjects => [...prevProjects, createdProject]);
        setActiveProjectId(createdProject.id);
      } catch (err) {
        setApiAvailable(false);
        const newProj = { id: generateId(), name: projectName, tasks: [] };
        setProjects(prevProjects => [...prevProjects, newProj]);
        setActiveProjectId(newProj.id);
      }
    } else {
      const newProj = { id: generateId(), name: projectName, tasks: [] };
      setProjects(prevProjects => [...prevProjects, newProj]);
      setActiveProjectId(newProj.id);
    }

    setNewProjectName("");
    setIsCreatingProject(false);
  };

  const handleCreateProjectCancel = () => {
    setNewProjectName("");
    setIsCreatingProject(false);
  };

  const startProjectRename = (project) => {
    setEditingProjectId(project.id);
    setProjectNameDraft(project.name || "");
  };

  const cancelProjectRename = () => {
    setEditingProjectId(null);
    setProjectNameDraft("");
  };

  const commitProjectRename = async (projectId) => {
    if (editingProjectId !== projectId) return;
    const nextName = projectNameDraft.trim();
    if (!nextName) {
      cancelProjectRename();
      return;
    }

    if (apiAvailable) {
      try {
        const updatedProject = await requestJson(`/api/projects/${projectId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: nextName })
        });
        setProjects(prevProjects => prevProjects.map(p => {
          if (p.id === projectId) {
            return { ...p, name: updatedProject.name };
          }
          return p;
        }));
      } catch (err) {
        setApiAvailable(false);
        setProjects(prevProjects => prevProjects.map(p => {
          if (p.id === projectId) {
            return { ...p, name: nextName };
          }
          return p;
        }));
      }
    } else {
      setProjects(prevProjects => prevProjects.map(p => {
        if (p.id === projectId) {
          return { ...p, name: nextName };
        }
        return p;
      }));
    }

    cancelProjectRename();
  };

  const deleteProject = async (e, projId) => {
    e.stopPropagation();
    if (projects.length <= 1) {
      alert("至少需要保留一個專案。");
      return;
    }
    // if (!window.confirm("確定要刪除整個專案及其所有任務嗎？")) return;
    if (apiAvailable) {
      try {
        await requestJson(`/api/projects/${projId}`, { method: "DELETE" });
      } catch (err) {
        setApiAvailable(false);
      }
    }
    const newProjects = projects.filter(p => p.id !== projId);
    setProjects(newProjects);
    if (activeProjectId === projId && newProjects.length > 0) {
      setActiveProjectId(newProjects[0].id);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activeProjectId) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csv = event.target.result;
        const lines = csv.split('\n');
        const parsedTasks = [];
        const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.split(',');
          if (parts.length >= 2) {
            parsedTasks.push({
              id: generateId() + i,
              name: parts[0]?.trim() || "Untitled",
              points: parseInt(parts[1]) || 1,
              people: parts[2]?.trim() || "",
              addedDate: normalizeDateString(parts[3]?.trim()),
              expectedStart: normalizeDateString(parts[4]?.trim()),
              expectedEnd: normalizeDateString(parts[5]?.trim()),
              actualStart: normalizeDateString(parts[6]?.trim()),
              actualEnd: normalizeDateString(parts[7]?.trim()),
              showLabel: false,
              logs: []
            });
          }
        }
        if (apiAvailable) {
          try {
            await Promise.all(
              (activeProject.tasks || []).map(task =>
                requestJson(`/api/tasks/${task.id}`, { method: "DELETE" })
              )
            );
            const createdTasks = await Promise.all(
              parsedTasks.map(task => requestJson(
                `/api/projects/${activeProjectId}/tasks`,
                {
                  method: "POST",
                  body: JSON.stringify(buildTaskPayload(task))
                }
              ))
            );
            setProjects(prevProjects => prevProjects.map(p => {
              if (p.id === activeProjectId) {
                return { ...p, tasks: createdTasks };
              }
              return p;
            }));
          } catch (err) {
            setApiAvailable(false);
            setProjects(prevProjects => prevProjects.map(p => {
              if (p.id === activeProjectId) {
                return { ...p, tasks: parsedTasks };
              }
              return p;
            }));
          }
        } else {
          setProjects(prevProjects => prevProjects.map(p => {
            if (p.id === activeProjectId) {
              return { ...p, tasks: parsedTasks };
            }
            return p;
          }));
        }
      } catch (err) {
        alert("CSV 解析失敗。");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const exportCSV = () => {
    const header = "Name,Points,People,AddedDate,ExpectedStart,ExpectedEnd,ActualStart,ActualEnd,ShowLabel\n";
    const rows = allTasks.map(t =>
      `${t.name},${t.points},${t.people},${t.addedDate},${t.expectedStart},${t.expectedEnd},${t.actualStart},${t.actualEnd},${t.showLabel !== false}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.name}-burnup.csv`;
    a.click();
  };

  const getRowStyle = (status) => {
    switch (status) {
      case 'danger': return 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500 text-red-700';
      case 'warning': return 'bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-400 text-orange-800';
      default: return 'bg-white hover:bg-gray-50 border-l-4 border-l-transparent text-gray-700';
    }
  };

  // Reusable Chart Component Function
  const renderChart = (height = "100%") => (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorScope" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
        <XAxis dataKey="date" tick={{fill: '#9ca3af', fontSize: 12}} tickLine={false} axisLine={false} dy={10} />
        <YAxis
          tick={{fill: '#9ca3af', fontSize: 12}}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          tickFormatter={(val) => `${val}%`}
        />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          formatter={(value, name) => [`${value}%`, name]}
        />
        <Legend iconType="circle" />

        <Line
          type="monotone"
          dataKey="ExpectedPct"
          name="預期進度 (Planned)"
          stroke="#60a5fa"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />

        <Line
          type="monotone"
          dataKey="ActualPct"
          name="實際進度 (Actual)"
          stroke="#10b981"
          strokeWidth={3}
          dot={{ r: 3, fill: '#10b981' }}
          activeDot={{ r: 6 }}
        />

        {chartAnnotations.map(anno => (
          <ReferenceDot
            key={anno.id}
            x={anno.x}
            y={anno.y}
            r={4}
            fill={anno.isActual ? "#10b981" : "#60a5fa"}
            stroke="#fff"
            strokeWidth={2}
          >
            <Label
              value={anno.name}
              position="top"
              offset={10}
              style={{ fontSize: '10px', fill: '#4b5563', fontWeight: 'bold', pointerEvents: 'none' }}
            />
          </ReferenceDot>
        ))}

      </ComposedChart>
    </ResponsiveContainer>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 text-gray-600 flex items-center justify-center">
        <div className="text-sm">載入資料中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans pb-10">
      <datalist id="people-options">
        {uniquePeople.map(person => (
          <option key={person} value={person} />
        ))}
      </datalist>

      {/* Fullscreen Chart Modal */}
      {isFullScreen && (
        <div className="fixed inset-0 bg-white z-[100] p-6 flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">{activeProject.name} - 進度趨勢 (全螢幕)</h2>
            <button
              onClick={() => setIsFullScreen(false)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition text-gray-600"
              title="關閉全螢幕"
            >
              <Minimize2 size={24} />
            </button>
          </div>
          <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-100 shadow-inner">
             {renderChart("100%")}
          </div>
        </div>
      )}

      {/* Log Modal */}
      {activeLogTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <MessageSquare size={18} className="text-indigo-500" />
                任務紀錄：{activeLogTask.name}
              </h3>
              <button onClick={() => setActiveLogTaskId(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(activeLogTask.logs && activeLogTask.logs.length > 0) ? (
                activeLogTask.logs
                  .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort newest first
                  .map(log => (
                  <div key={log.id} className="group relative bg-gray-50 p-3 rounded-lg border border-gray-100 hover:border-indigo-100 transition">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{log.date}</span>
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.content}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-gray-400 text-sm">
                  尚無紀錄，開始寫下第一筆筆記吧！
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <form onSubmit={handleAddLog} className="flex flex-col gap-2">
                <input
                  type="date"
                  value={newLogDate}
                  onChange={(e) => setNewLogDate(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 w-full bg-white focus:border-indigo-500 outline-none"
                />
                <textarea
                  placeholder="紀錄進度、困難或是備註..."
                  value={newLogContent}
                  onChange={(e) => setNewLogContent(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-3 min-h-[80px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none resize-none"
                />
                <button
                  type="submit"
                  disabled={!newLogContent.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Send size={16} /> 新增紀錄
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation / Tabs */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Briefcase className="text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-900">專案管理 Burnup</h1>
            </div>
            <div className="flex space-x-2">
              <button onClick={() => fileInputRef.current.click()} className="p-2 text-gray-500 hover:text-indigo-600 transition" title="匯入 CSV">
                <Upload size={20} />
              </button>
              <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              <button onClick={exportCSV} className="p-2 text-gray-500 hover:text-indigo-600 transition" title="匯出 CSV">
                <Download size={20} />
              </button>
            </div>
          </div>

          <div className="flex overflow-x-auto gap-2 mt-2 pb-0 no-scrollbar items-center">
            {projects.map(proj => (
              <div
                key={proj.id}
                onClick={() => { setActiveProjectId(proj.id); setFilterPerson(""); }}
                className={`
                  group flex items-center gap-2 px-4 py-3 border-b-2 cursor-pointer whitespace-nowrap text-sm font-medium transition-colors
                  ${activeProjectId === proj.id
                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                {editingProjectId === proj.id ? (
                  <input
                    type="text"
                    value={projectNameDraft}
                    onChange={(e) => setProjectNameDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => commitProjectRename(proj.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelProjectRename();
                      }
                    }}
                    className="text-sm border border-gray-300 rounded px-2 py-1 w-40 focus:border-indigo-500 outline-none"
                    autoFocus
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startProjectRename(proj);
                    }}
                    title="雙擊改名"
                  >
                    {proj.name}
                  </span>
                )}
                <button
                  onClick={(e) => deleteProject(e, proj.id)}
                  className={`opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-gray-200 ${projects.length === 1 ? 'hidden' : ''}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {isCreatingProject ? (
              <div className="flex items-center gap-1 px-2 py-2 border-b-2 border-transparent">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="專案名稱"
                  className="text-sm border border-gray-300 rounded px-2 py-1 w-32 focus:border-indigo-500 outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateProjectSave();
                    if (e.key === 'Escape') handleCreateProjectCancel();
                  }}
                />
                <button onClick={handleCreateProjectSave} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded"><CheckCircle2 size={16}/></button>
                <button onClick={handleCreateProjectCancel} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded"><X size={16}/></button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreatingProject(true)}
                className="flex items-center gap-1 px-3 py-3 text-sm text-gray-400 hover:text-indigo-600 transition"
              >
                <Plus size={16} /> 新增專案
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ... Rest of the component (Chart Section, Task Management Grid) remains the same ... */}
      <div className="max-w-[95%] mx-auto mt-6 space-y-6">

        {/* Chart Section */}
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-800">{activeProject.name} - 進度趨勢</h2>
                <button
                  onClick={() => setIsFullScreen(true)}
                  className="text-gray-400 hover:text-indigo-600 transition p-1 hover:bg-indigo-50 rounded"
                  title="全螢幕顯示 (適合簡報)"
                >
                  <Maximize2 size={18} />
                </button>
              </div>
              <div className="flex gap-4 mt-2 text-sm">
                 <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-400"></div> 預期進度</div>
                 <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> 實際進度</div>
              </div>
            </div>

            {/* Chart Config Controls */}
            <div className="flex flex-wrap gap-2 items-end justify-end bg-gray-50 p-3 rounded-lg border border-gray-100">
               {/* Date Range Controls */}
               <div className="flex flex-col gap-1">
                 <div className="text-xs font-medium text-gray-500 flex items-center gap-1"><Calendar size={12}/> 區間設定</div>
                 <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer text-xs text-gray-600 bg-white px-2 py-1.5 rounded border border-gray-200 hover:border-indigo-300 transition">
                      <input
                        type="checkbox"
                        checked={chartConfig.isAuto}
                        onChange={(e) => updateChartConfig('isAuto', e.target.checked)}
                        className="accent-indigo-600"
                      />
                      自動範圍
                    </label>
                    {!chartConfig.isAuto && (
                      <div className="flex items-center gap-1 text-xs">
                        <input
                          type="date"
                          value={chartConfig.startDate}
                          onChange={(e) => updateChartConfig('startDate', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 bg-white focus:border-indigo-500 outline-none w-28"
                        />
                        <span className="text-gray-400">~</span>
                        <input
                          type="date"
                          value={chartConfig.endDate}
                          onChange={(e) => updateChartConfig('endDate', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 bg-white focus:border-indigo-500 outline-none w-28"
                        />
                      </div>
                    )}
                 </div>
               </div>
            </div>
          </div>

          <div className="h-[400px] w-full">
            {renderChart()}
          </div>
        </div>

        {/* Task Management Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

          {/* Add Task Form - Only shown if showAddTask is true */}
          {showAddTask && (
            <div className="xl:col-span-1">
               <div className="bg-white p-5 rounded-xl shadow border border-gray-200 sticky top-6">
                  <div className="flex justify-between items-center mb-4">
                     <h3
                       onClick={() => setShowAddTask(false)}
                       className="font-bold text-gray-800 flex items-center gap-2 cursor-pointer hover:opacity-70 transition"
                       title="點擊收合"
                     >
                       <Plus className="text-indigo-600 bg-indigo-50 p-1 rounded" size={24}/> 新增任務
                     </h3>
                     <button
                       onClick={() => setShowAddTask(false)}
                       className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition"
                       title="收合面板 (列表將展開)"
                     >
                       <ChevronLeft size={20} />
                     </button>
                  </div>

                  <form onSubmit={handleAddTask} className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">任務名稱</label>
                      <input
                        type="text"
                        required
                        value={newTask.name}
                        onChange={e => setNewTask({...newTask, name: e.target.value})}
                        placeholder="例如：實作 API"
                        className="w-full mt-1 px-3 py-2 bg-gray-50 rounded border border-gray-200 focus:bg-white focus:border-indigo-500 outline-none transition text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">故事點數</label>
                        <input type="number" min="0" value={newTask.points} onChange={e => updateNewTaskField('points', e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-50 rounded border border-gray-200 focus:bg-white focus:border-indigo-500 outline-none transition text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">負責人</label>
                        <input
                          type="text"
                          value={newTask.people}
                          onChange={e => setNewTask({...newTask, people: e.target.value})}
                          placeholder="Name"
                          list="people-options"
                          className="w-full mt-1 px-3 py-2 bg-gray-50 rounded border border-gray-200 focus:bg-white focus:border-indigo-500 outline-none transition text-sm"
                        />
                      </div>
                    </div>

                    <div>
                       <label className="text-xs font-semibold text-gray-500 uppercase">新增日期 (Scope)</label>
                       <input type="date" required value={newTask.addedDate} onChange={e => setNewTask({...newTask, addedDate: e.target.value})} className="w-full mt-1 px-3 py-2 bg-gray-50 rounded border border-gray-200 focus:bg-white focus:border-indigo-500 outline-none transition text-sm" />
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <label className="text-xs font-bold text-blue-600 uppercase mb-2 block">預期時程 (Plan)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" title="預期開始" value={newTask.expectedStart} onChange={e => updateNewTaskField('expectedStart', e.target.value)} className="px-2 py-1 bg-blue-50/50 border border-blue-100 rounded text-xs" />
                        <input type="date" title="預期完成" value={newTask.expectedEnd} onChange={e => updateNewTaskField('expectedEnd', e.target.value)} className="px-2 py-1 bg-blue-50/50 border border-blue-100 rounded text-xs" />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <label className="text-xs font-bold text-emerald-600 uppercase mb-2 block">實際時程 (Actual)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" title="實際開始" value={newTask.actualStart} onChange={e => setNewTask({...newTask, actualStart: e.target.value})} className="px-2 py-1 bg-emerald-50/50 border border-emerald-100 rounded text-xs" />
                        <input type="date" title="實際完成" value={newTask.actualEnd} onChange={e => setNewTask({...newTask, actualEnd: e.target.value})} className="px-2 py-1 bg-emerald-50/50 border border-emerald-100 rounded text-xs" />
                      </div>
                    </div>

                    <button type="submit" className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded shadow-md transition text-sm">
                      加入任務
                    </button>
                  </form>
               </div>
            </div>
          )}

          {/* Task List Table - Expands when form is hidden */}
          <div className={showAddTask ? "xl:col-span-3" : "xl:col-span-4"}>
            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">

              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                   {!showAddTask && (
                     <button
                       onClick={() => setShowAddTask(true)}
                       className="flex items-center gap-1 text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition border border-indigo-200 shadow-sm"
                     >
                        <Plus size={16} />
                        <span className="font-medium">開啟新增面板</span>
                     </button>
                   )}
                   <h3 className="font-semibold text-gray-700 text-sm">任務列表 ({displayedTasks.length})</h3>
                 </div>

                 <div className="flex items-center gap-4">
                    {/* Show Completed Toggle */}
                    <button
                      onClick={() => setShowCompleted(!showCompleted)}
                      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition border ${
                        showCompleted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                      }`}
                      title={showCompleted ? "點擊隱藏已完成任務" : "點擊顯示已完成任務"}
                    >
                      {showCompleted ? <Eye size={14} /> : <EyeOff size={14} />}
                      <span className="font-medium">{showCompleted ? "顯示已完成" : "隱藏已完成"}</span>
                    </button>

                    {/* Person Filter */}
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-gray-400" />
                        <select
                          value={filterPerson}
                          onChange={(e) => setFilterPerson(e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white focus:border-indigo-500 outline-none text-gray-600"
                        >
                          <option value="">顯示全部人員</option>
                          {uniquePeople.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                    </div>
                 </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase font-semibold">
                      <th className="px-4 py-3 w-12 text-center">
                        <div className="flex items-center justify-center gap-1" title="顯示於圖表上">
                          <Tag size={14} />
                        </div>
                      </th>
                      <th className="px-4 py-3 w-10"></th>
                      <th className="px-4 py-3">任務名稱</th>
                      <th className="px-2 py-3 w-16 text-center">點數</th>
                      <th className="px-2 py-3 w-24">負責人</th>
                      <th className="px-2 py-3 w-28">新增日</th>
                      <th className="px-2 py-3 w-28 text-center">進度 (%)</th>
                      <th className="px-2 py-3 w-32 bg-blue-50/30 text-blue-600 border-l border-blue-100">預期 (起/迄)</th>
                      <th className="px-2 py-3 w-32 bg-emerald-50/30 text-emerald-600 border-l border-emerald-100">實際 (起/迄)</th>
                      <th className="px-2 py-3 w-10">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {displayedTasks.length === 0 ? (
                      <tr><td colSpan="11" className="p-8 text-center text-gray-400">沒有符合篩選條件的任務</td></tr>
                    ) : (
                      displayedTasks.map(task => {
                        const isCompleted = task.actualStart && task.actualEnd;
                        // Completed tasks are considered 'normal' status to remove warning colors
                        const validationStatus = isCompleted ? 'normal' : getTaskValidationStatus(task, allTasks);
                        const rowClass = getRowStyle(validationStatus);
                        const { expectedPct, actualPct } = getProgressStats(task);

                        return (
                          <tr
                            key={task.id}
                            className={`${rowClass} transition-colors group`}
                            data-task-name={task.name}
                          >
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); updateTask(task.id, 'showLabel', !task.showLabel); }}
                                className={`transition p-1 rounded-full ${task.showLabel !== false ? 'text-indigo-600 hover:bg-indigo-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
                                title={task.showLabel !== false ? "隱藏標籤" : "在圖表上顯示標籤"}
                              >
                                <Tag size={16} className={task.showLabel !== false ? "fill-indigo-100" : ""} />
                              </button>
                            </td>
                            <td className="px-4 py-2 text-center">
                              {validationStatus === 'danger' && <AlertTriangle size={16} className="text-red-500" title="此人同時段執行超過2個任務！" />}
                              {validationStatus === 'warning' && <AlertTriangle size={16} className="text-orange-500" title="此人同時段執行2個任務" />}
                              {validationStatus === 'normal' && <div className="w-2 h-2 rounded-full bg-gray-300 mx-auto"></div>}
                            </td>

                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={task.name}
                                onChange={(e) => updateTask(task.id, 'name', e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 p-0 font-medium text-gray-900"
                              />
                            </td>

                            <td className="px-2 py-2 text-center relative">
                              <input
                                type="number"
                                value={task.points}
                                disabled={!!isCompleted}
                                onChange={(e) => updateTask(task.id, 'points', e.target.value)}
                                className={`w-full bg-transparent border-none focus:ring-0 p-0 text-center font-mono ${isCompleted ? 'text-gray-400 cursor-not-allowed' : ''}`}
                                title={isCompleted ? "任務已完成，無法修改點數" : "修改點數會自動更新預期完成日"}
                              />
                              {isCompleted && <Lock size={10} className="absolute top-1 right-0 text-gray-300" />}
                            </td>

                            <td className="px-2 py-2 relative">
                              <div className="flex items-center gap-1">
                                <User size={12} className={isCompleted ? "text-gray-300" : "text-gray-400"}/>
                                <input
                                  type="text"
                                  value={task.people}
                                  disabled={!!isCompleted}
                                  onChange={(e) => updateTask(task.id, 'people', e.target.value)}
                                  className={`w-full bg-transparent border-none focus:ring-0 p-0 ${isCompleted ? 'text-gray-400 cursor-not-allowed' : ''}`}
                                  placeholder="未指派"
                                  list="people-options"
                                />
                              </div>
                            </td>

                            <td className="px-2 py-2">
                              <input
                                type="date"
                                value={task.addedDate}
                                onChange={(e) => updateTask(task.id, 'addedDate', e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-500 text-xs"
                              />
                            </td>

                            {/* Progress Bars Column with Percentage Text */}
                            <td className="px-2 py-2">
                              <div className="flex flex-col gap-1 w-full max-w-[100px] mx-auto">
                                {/* Expected Progress Bar (Time) */}
                                <div className="flex items-center gap-1" title="時間經過 (Expected)">
                                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden flex-1">
                                    <div className="h-full bg-blue-400" style={{ width: `${expectedPct}%` }}></div>
                                  </div>
                                  <span className="text-[10px] text-blue-600 font-mono w-6 text-right">{expectedPct}%</span>
                                </div>
                                {/* Actual Progress Bar (Completion) */}
                                <div className="flex items-center gap-1" title="完成度 (Actual)">
                                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden flex-1">
                                    <div className={`h-full ${actualPct === 100 ? 'bg-emerald-500' : 'bg-gray-300'}`} style={{ width: `${actualPct}%` }}></div>
                                  </div>
                                  <span className={`text-[10px] font-mono w-6 text-right ${actualPct === 100 ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>{actualPct}%</span>
                                </div>
                              </div>
                            </td>

                            <td className="px-2 py-2 bg-blue-50/10 border-l border-blue-50">
                              <div className="flex flex-col gap-1">
                                <input
                                  type="date"
                                  value={task.expectedStart}
                                  onChange={(e) => updateTask(task.id, 'expectedStart', e.target.value)}
                                  className="w-full bg-transparent border-b border-transparent hover:border-blue-200 focus:border-blue-400 p-0 text-xs text-blue-800"
                                  title="修改開始日期會自動推算結束日期"
                                />
                                <input
                                  type="date"
                                  value={task.expectedEnd}
                                  onChange={(e) => updateTask(task.id, 'expectedEnd', e.target.value)}
                                  className="w-full bg-transparent border-b border-transparent hover:border-blue-200 focus:border-blue-400 p-0 text-xs text-blue-800"
                                />
                              </div>
                            </td>

                            <td className="px-2 py-2 bg-emerald-50/10 border-l border-emerald-50">
                              <div className="flex flex-col gap-1">
                                <input
                                  type="date"
                                  value={task.actualStart}
                                  onChange={(e) => updateTask(task.id, 'actualStart', e.target.value)}
                                  className="w-full bg-transparent border-b border-transparent hover:border-emerald-200 focus:border-emerald-400 p-0 text-xs text-emerald-800"
                                />
                                <input
                                  type="date"
                                  value={task.actualEnd}
                                  onChange={(e) => updateTask(task.id, 'actualEnd', e.target.value)}
                                  className="w-full bg-transparent border-b border-transparent hover:border-emerald-200 focus:border-emerald-400 p-0 text-xs text-emerald-800 font-bold"
                                />
                              </div>
                            </td>

                            <td className="px-2 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveLogTaskId(task.id);
                                    setNewLogDate(new Date().toISOString().split('T')[0]);
                                  }}
                                  className="text-gray-400 hover:text-indigo-600 p-1 rounded-md hover:bg-indigo-50 transition relative"
                                  title="紀錄"
                                >
                                  <MessageSquare size={16} />
                                  {(task.logs && task.logs.length > 0) && (
                                    <span className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-full border border-white"></span>
                                  )}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                  className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"
                                  title="刪除"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-gray-50 p-3 text-xs text-gray-500 flex gap-4 border-t border-gray-200">
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-gray-300"></div> 正常 (1 任務)</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-100 border border-orange-400"></div> 警告 (2 任務重疊)</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-500"></div> 危險 (3+ 任務重疊)</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
