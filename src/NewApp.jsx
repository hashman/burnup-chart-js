// "Next" UI — shell + all redesigned pages. Data + modal orchestration live here.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { T, FONT } from './design/tokens.js';
import { Shell } from './design/layout/Shell.jsx';
import { useAppData } from './hooks/useAppData.js';
import { BurnupPage } from './pages/BurnupPage.jsx';
import { GanttPage } from './pages/GanttPage.jsx';
import { TodosPage } from './pages/TodosPage.jsx';
import { SubProjectsPage } from './pages/SubProjectsPage.jsx';
import { MergedPage } from './pages/MergedPage.jsx';
import { TimeLogPage } from './pages/TimeLogPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { EmptyProject } from './components/EmptyProject.jsx';
import { SearchModal } from './components/modals/SearchModal.jsx';
import { TaskDetailModal } from './components/modals/TaskDetailModal.jsx';
import { useAuth } from './auth/AuthContext.jsx';

const PAGE_KEYS = ['burnup', 'gantt', 'todos', 'subs', 'merged', 'timelog'];

function readHashPage() {
  const h = window.location.hash.slice(1);
  return PAGE_KEYS.includes(h) ? h : 'burnup';
}

export default function NewApp() {
  const { user, isLoading: authLoading } = useAuth();

  // If not authenticated, show the new login screen.
  if (authLoading) return <BootingScreen />;
  if (!user) return <LoginPage />;

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [page, setPage] = useState(readHashPage);
  const data = useAppData();

  // Global modal state
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailTask, setDetailTask] = useState(null);
  const [pendingEditTodoId, setPendingEditTodoId] = useState(null);

  // Cmd+K / Ctrl+K opens search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Hash routing
  useEffect(() => {
    window.history.replaceState(null, '', `#${page}`);
  }, [page]);
  useEffect(() => {
    const onHash = () => setPage(readHashPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const sidebarProjects = useMemo(() => data.projects.map(p => ({
    id: p.id,
    name: p.name,
    count: (p.tasks || []).length,
  })), [data.projects]);

  const handlePickTask = useCallback((t) => {
    setDetailTask(t);
  }, []);

  const handlePickTodo = useCallback((todo) => {
    setPage('todos');
    setPendingEditTodoId(todo.id);
  }, []);

  const needsEmptyState = !data.loading && page === 'burnup' && data.activeProject && data.allTasks.length === 0;

  return (
    <Shell
      active={page}
      project={data.activeProject?.name || 'Untitled'}
      user={data.user}
      projects={sidebarProjects}
      activeProjectId={data.activeProjectId}
      onSelectProject={data.setActiveProjectId}
      onNavigate={setPage}
      onOpenSearch={() => setSearchOpen(true)}
    >
      {data.loading ? (
        <LoadingState />
      ) : data.error ? (
        <ErrorState error={data.error} />
      ) : needsEmptyState ? (
        <EmptyProject projectName={data.activeProject?.name} />
      ) : page === 'burnup' ? (
        <BurnupPage data={{ ...data, onSelectTask: handlePickTask }} />
      ) : page === 'gantt' ? (
        <GanttPage data={{ ...data, onSelectTask: handlePickTask }} />
      ) : page === 'todos' ? (
        <TodosPage
          data={data}
          initialEditTodoId={pendingEditTodoId}
          onClearInitialEditTodoId={() => setPendingEditTodoId(null)}
        />
      ) : page === 'subs' ? (
        <SubProjectsPage data={data} />
      ) : page === 'merged' ? (
        <MergedPage data={data} />
      ) : page === 'timelog' ? (
        <TimeLogPage data={data} />
      ) : null}

      {searchOpen && (
        <SearchModal
          tasks={data.allTasks}
          todos={data.todos}
          endStatusId={data.statuses.find(s => s.isDefaultEnd)?.id}
          today={data.today}
          onPickTask={handlePickTask}
          onPickTodo={handlePickTodo}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          todos={data.todos}
          statuses={data.statuses}
          onClose={() => setDetailTask(null)}
        />
      )}
    </Shell>
  );
}

function BootingScreen() {
  return (
    <div style={{
      height: '100vh', background: T.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, fontSize: 12, color: T.textDim,
    }}>
      Booting…
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: T.textDim, fontSize: 12, fontFamily: FONT,
    }}>
      Loading…
    </div>
  );
}

function ErrorState({ error }) {
  return (
    <div style={{ padding: 24, fontFamily: FONT, color: T.danger, fontSize: 13 }}>
      Failed to load data: {String(error?.message || error)}
    </div>
  );
}
