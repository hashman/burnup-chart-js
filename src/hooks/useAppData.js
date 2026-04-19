// Data layer for the "next" UI. Loads projects + active project data
// independently so legacy App doesn't need to be refactored.
// Mirrors only what the new pages consume.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchActivity, requestJson } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

const TODAY = () => new Date().toISOString().split('T')[0];

function normalizeDate(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().split('T')[0];
}

export function useAppData() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [todos, setTodos] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [subProjects, setSubProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [projectData, statusData, todoData, subProjectData] = await Promise.all([
          requestJson('/api/projects'),
          requestJson('/api/statuses'),
          requestJson('/api/todos'),
          requestJson('/api/sub-projects'),
        ]);
        if (cancelled) return;
        setProjects(projectData);
        setStatuses(statusData);
        setTodos(todoData);
        setSubProjects(subProjectData);
        if (projectData.length > 0 && !activeProjectId) {
          setActiveProjectId(projectData[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeProject = useMemo(
    () => projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const allTasks = useMemo(
    () => {
      const normalized = (activeProject?.tasks || []).map(t => ({
        ...t,
        addedDate: normalizeDate(t.addedDate),
        expectedStart: normalizeDate(t.expectedStart),
        expectedEnd: normalizeDate(t.expectedEnd),
        actualStart: normalizeDate(t.actualStart),
        actualEnd: normalizeDate(t.actualEnd),
      }));
      return normalized.sort((a, b) => {
        const aStart = a.expectedStart || '9999-12-31';
        const bStart = b.expectedStart || '9999-12-31';
        if (aStart < bStart) return -1;
        if (aStart > bStart) return 1;
        return 0;
      });
    },
    [activeProject]
  );

  const endStatusId = useMemo(
    () => statuses.find(s => s.isDefaultEnd)?.id,
    [statuses]
  );

  const todoProgressByTask = useMemo(() => {
    const map = {};
    todos.forEach(t => {
      if (!t.linkedTaskId) return;
      if (!map[t.linkedTaskId]) map[t.linkedTaskId] = { total: 0, done: 0 };
      map[t.linkedTaskId].total += 1;
      if (t.status === endStatusId) map[t.linkedTaskId].done += 1;
    });
    return map;
  }, [todos, endStatusId]);

  // Unified activity feed for the active project.
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const refreshActivity = useCallback(async () => {
    if (!activeProjectId) { setActivity([]); return; }
    setActivityLoading(true);
    try {
      const items = await fetchActivity(activeProjectId);
      setActivity(items);
    } catch (err) {
      setError(err);
    } finally {
      setActivityLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => { refreshActivity(); }, [refreshActivity]);

  // Poll for new activity entries every 20 seconds. Skip when the tab
  // is hidden; refresh immediately when it becomes visible again.
  useEffect(() => {
    if (!activeProjectId) return undefined;
    const POLL_MS = 20_000;
    const tick = () => { if (!document.hidden) refreshActivity(); };
    const id = setInterval(tick, POLL_MS);
    const onVis = () => { if (!document.hidden) refreshActivity(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [activeProjectId, refreshActivity]);

  const updateTodo = useCallback(async (todoId, patch) => {
    setTodos(prev => prev.map(t => t.id === todoId ? { ...t, ...patch } : t));
    try {
      const updated = await requestJson(`/api/todos/${todoId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setTodos(prev => prev.map(t => t.id === todoId ? updated : t));
      return updated;
    } catch (err) {
      setError(err);
      return null;
    }
  }, []);

  const createTodo = useCallback(async (payload) => {
    try {
      const created = await requestJson('/api/todos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setTodos(prev => [...prev, created]);
      return created;
    } catch (err) {
      setError(err);
      return null;
    }
  }, []);

  const deleteTodo = useCallback(async (todoId) => {
    try {
      await requestJson(`/api/todos/${todoId}`, { method: 'DELETE' });
      setTodos(prev => prev.filter(t => t.id !== todoId));
      return true;
    } catch (err) {
      setError(err);
      return false;
    }
  }, []);

  const createComment = useCallback(async (todoId, content) => {
    try {
      const created = await requestJson(`/api/todos/${todoId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setTodos(prev => prev.map(t => t.id === todoId
        ? { ...t, comments: [...(t.comments || []), created] }
        : t));
      return created;
    } catch (err) {
      setError(err);
      return null;
    }
  }, []);

  const updateComment = useCallback(async (commentId, content) => {
    try {
      const updated = await requestJson(`/api/todo-comments/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      });
      setTodos(prev => prev.map(t => ({
        ...t,
        comments: (t.comments || []).map(c => c.id === commentId ? updated : c),
      })));
      return updated;
    } catch (err) {
      setError(err);
      return null;
    }
  }, []);

  const deleteComment = useCallback(async (commentId) => {
    try {
      await requestJson(`/api/todo-comments/${commentId}`, { method: 'DELETE' });
      setTodos(prev => prev.map(t => ({
        ...t,
        comments: (t.comments || []).filter(c => c.id !== commentId),
      })));
      return true;
    } catch (err) {
      setError(err);
      return false;
    }
  }, []);

  const createStatus = useCallback(async ({ name, sortOrder }) => {
    try {
      const created = await requestJson('/api/statuses', {
        method: 'POST',
        body: JSON.stringify({ name, sort_order: sortOrder }),
      });
      // Re-fetch the authoritative order from the server to avoid state drift
      // (identical pattern to updateStatus).
      const refreshed = await requestJson('/api/statuses');
      setStatuses(refreshed);
      return created;
    } catch (err) {
      setError(err);
      return null;
    }
  }, []);

  const updateStatus = useCallback(async (id, patch) => {
    const body = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.sortOrder !== undefined) body.sort_order = patch.sortOrder;
    if (patch.isDefaultStart !== undefined) body.is_default_start = patch.isDefaultStart;
    if (patch.isDefaultEnd !== undefined) body.is_default_end = patch.isDefaultEnd;
    try {
      await requestJson(`/api/statuses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const refreshed = await requestJson('/api/statuses');
      setStatuses(refreshed);
      return true;
    } catch (err) {
      setError(err);
      return false;
    }
  }, []);

  const deleteStatus = useCallback(async (id, migrateTo) => {
    const url = migrateTo ? `/api/statuses/${id}?migrate_to=${migrateTo}` : `/api/statuses/${id}`;
    try {
      await requestJson(url, { method: 'DELETE' });
      setStatuses(prev => prev.filter(s => s.id !== id));
      if (migrateTo) {
        setTodos(prev => prev.map(t => t.status === id ? { ...t, status: migrateTo } : t));
      }
      return true;
    } catch (err) {
      setError(err);
      return false;
    }
  }, []);

  const createSubProject = useCallback(async (projectId, payload) => {
    try {
      const created = await requestJson(`/api/projects/${projectId}/sub-projects`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSubProjects(prev => [...prev, created]);
      return created;
    } catch (err) { setError(err); return null; }
  }, []);

  const updateSubProject = useCallback(async (spId, patch) => {
    try {
      const updated = await requestJson(`/api/sub-projects/${spId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setSubProjects(prev => prev.map(s => s.id === spId ? updated : s));
      return updated;
    } catch (err) { setError(err); return null; }
  }, []);

  const deleteSubProject = useCallback(async (spId) => {
    try {
      await requestJson(`/api/sub-projects/${spId}`, { method: 'DELETE' });
      setSubProjects(prev => prev.filter(s => s.id !== spId));
      return true;
    } catch (err) { setError(err); return false; }
  }, []);

  const fetchSubProjectEvents = useCallback(async (spId) => {
    try {
      return await requestJson(`/api/sub-projects/${spId}/events`);
    } catch (err) { setError(err); return []; }
  }, []);

  const createSubProjectEvent = useCallback(async (spId, payload) => {
    try {
      return await requestJson(`/api/sub-projects/${spId}/events`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) { setError(err); return null; }
  }, []);

  const updateSubProjectEvent = useCallback(async (eventId, patch) => {
    try {
      return await requestJson(`/api/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    } catch (err) { setError(err); return null; }
  }, []);

  const deleteSubProjectEvent = useCallback(async (eventId) => {
    try {
      await requestJson(`/api/events/${eventId}`, { method: 'DELETE' });
      return true;
    } catch (err) { setError(err); return false; }
  }, []);

  // -------- Time log (per-user) --------
  const [timeEntries, setTimeEntries] = useState([]);

  const refreshTimeEntries = useCallback(async () => {
    if (!user) { setTimeEntries([]); return; }
    try {
      const list = await requestJson('/api/time-entries');
      setTimeEntries(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err);
    }
  }, [user]);

  useEffect(() => { refreshTimeEntries(); }, [refreshTimeEntries]);

  const createTimeEntry = useCallback(async (payload) => {
    try {
      const created = await requestJson('/api/time-entries', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setTimeEntries(prev => [created, ...prev]);
      return created;
    } catch (err) { setError(err); return null; }
  }, []);

  const updateTimeEntry = useCallback(async (id, patch) => {
    try {
      const updated = await requestJson(`/api/time-entries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setTimeEntries(prev => prev.map(e => e.id === id ? updated : e));
      return updated;
    } catch (err) { setError(err); return null; }
  }, []);

  const deleteTimeEntry = useCallback(async (id) => {
    try {
      await requestJson(`/api/time-entries/${id}`, { method: 'DELETE' });
      setTimeEntries(prev => prev.filter(e => e.id !== id));
      return true;
    } catch (err) { setError(err); return false; }
  }, []);

  const fetchTimeEntrySummary = useCallback(async (period, fromDate, toDate) => {
    const params = new URLSearchParams({ period });
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    try {
      return await requestJson(`/api/time-entries/summary?${params.toString()}`);
    } catch (err) { setError(err); return null; }
  }, []);

  // Merged view state: which projects are included. Persisted in localStorage.
  const [mergedProjectIds, setMergedProjectIds] = useState(() => {
    try {
      const raw = localStorage.getItem('mergedProjectIds');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('mergedProjectIds', JSON.stringify(mergedProjectIds)); } catch { /* ignore */ }
  }, [mergedProjectIds]);

  const reorderStatuses = useCallback(async (ordered) => {
    const body = ordered.map((s, i) => ({ id: s.id, sortOrder: i }));
    const optimistic = ordered.map((s, i) => ({ ...s, sortOrder: i }));
    setStatuses(optimistic);
    try {
      const refreshed = await requestJson('/api/statuses/reorder', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      // Server returns the full sorted list; take it as source of truth.
      if (Array.isArray(refreshed)) setStatuses(refreshed);
      return true;
    } catch (err) {
      setError(err);
      return false;
    }
  }, []);

  const updateTask = useCallback(async (taskId, patch) => {
    setProjects(prev => prev.map(p => p.id !== activeProjectId ? p : ({
      ...p,
      tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t),
    })));
    try {
      const updated = await requestJson(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setProjects(prev => prev.map(p => p.id !== activeProjectId ? p : ({
        ...p,
        tasks: p.tasks.map(t => t.id === taskId ? updated : t),
      })));
      return updated;
    } catch (err) {
      setError(err);
      return null;
    }
  }, [activeProjectId]);

  return {
    user,
    loading,
    error,
    projects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    allTasks,
    todos,
    statuses,
    subProjects,
    todoProgressByTask,
    today: TODAY(),
    updateTask,
    updateTodo,
    createTodo,
    deleteTodo,
    createComment,
    updateComment,
    deleteComment,
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
    createSubProject,
    updateSubProject,
    deleteSubProject,
    fetchSubProjectEvents,
    createSubProjectEvent,
    updateSubProjectEvent,
    deleteSubProjectEvent,
    mergedProjectIds,
    setMergedProjectIds,
    timeEntries,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    fetchTimeEntrySummary,
    refreshTimeEntries,
    activity,
    activityLoading,
    refreshActivity,
  };
}
