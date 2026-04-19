import React, { useEffect, useMemo, useState } from 'react';
import { T, FONT } from '../design/tokens.js';
import { Btn } from '../design/primitives.jsx';
import { KanbanBoard } from '../components/todo/KanbanBoard.jsx';
import { PRIO_ORDER } from '../components/todo/KanbanCard.jsx';
import { TodoFormModal } from '../components/todo/TodoFormModal.jsx';

export function TodosPage({ data, initialEditTodoId, onClearInitialEditTodoId }) {
  const {
    todos, statuses, allTasks, subProjects, today,
    createTodo, updateTodo, deleteTodo,
    createComment, updateComment, deleteComment,
    createStatus, updateStatus, deleteStatus, reorderStatuses,
  } = data;

  const [modalTodo, setModalTodo] = useState(null); // current todo for editing; {} for new

  // Honour an external request to open a specific todo (e.g. from Cmd+K).
  useEffect(() => {
    if (!initialEditTodoId) return;
    const target = todos.find(t => t.id === initialEditTodoId);
    if (target) setModalTodo(target);
    onClearInitialEditTodoId?.();
  }, [initialEditTodoId, todos, onClearInitialEditTodoId]);
  const [filterAssignees, setFilterAssignees] = useState(new Set());
  const [filterPriorities, setFilterPriorities] = useState(new Set());
  const [filterTags, setFilterTags] = useState(new Set());
  const [filterSubProjectId, setFilterSubProjectId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [sortBy, setSortBy] = useState('dueDate-asc');

  const endStatusId = useMemo(() => statuses.find(s => s.isDefaultEnd)?.id, [statuses]);

  const orderedStatuses = useMemo(
    () => [...statuses].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [statuses]
  );
  const visibleStatuses = hideDone
    ? orderedStatuses.filter(s => !s.isDefaultEnd)
    : orderedStatuses;

  const allTags = useMemo(() => {
    const s = new Set();
    todos.forEach(t => (t.tags || []).forEach(tag => s.add(tag)));
    return Array.from(s).sort();
  }, [todos]);
  const allAssignees = useMemo(() => {
    const s = new Set();
    todos.forEach(t => { if (t.assignee) s.add(t.assignee); });
    return Array.from(s).sort();
  }, [todos]);

  const overdueCount = useMemo(() => todos.reduce((n, t) => (
    t.dueDate && t.dueDate < today && t.status !== endStatusId ? n + 1 : n
  ), 0), [todos, today, endStatusId]);

  const filteredTodos = useMemo(() => {
    let list = todos;
    if (filterAssignees.size > 0) list = list.filter(t => filterAssignees.has(t.assignee || ''));
    if (filterPriorities.size > 0) list = list.filter(t => filterPriorities.has(t.priority));
    if (filterTags.size > 0) list = list.filter(t => (t.tags || []).some(tag => filterTags.has(tag)));
    if (filterSubProjectId) list = list.filter(t => (t.subProjectId || '') === filterSubProjectId);
    const sorted = [...list];
    if (sortBy === 'dueDate-asc') sorted.sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1);
    else if (sortBy === 'dueDate-desc') sorted.sort((a, b) => (b.dueDate || '') < (a.dueDate || '') ? -1 : 1);
    else if (sortBy === 'priority') sorted.sort((a, b) => (PRIO_ORDER[a.priority] ?? 9) - (PRIO_ORDER[b.priority] ?? 9));
    else sorted.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return sorted;
  }, [todos, filterAssignees, filterPriorities, filterTags, filterSubProjectId, sortBy]);

  const taskNameById = useMemo(() => {
    const map = new Map();
    allTasks.forEach(t => map.set(t.id, t.name));
    return map;
  }, [allTasks]);
  const subProjectNameById = useMemo(() => {
    const map = new Map();
    subProjects.forEach(s => map.set(s.id, s.name));
    return map;
  }, [subProjects]);

  const handleMove = (todoId, statusId) => updateTodo(todoId, { status: statusId });

  const handleSave = async (payload) => {
    if (payload.id) {
      const { id, ...patch } = payload;
      await updateTodo(id, patch);
    } else {
      await createTodo(payload);
    }
    setModalTodo(null);
  };
  const handleDelete = async (id) => {
    await deleteTodo(id);
    setModalTodo(null);
  };

  // Column management
  const handleAddColumn = async () => {
    const maxOrder = orderedStatuses.reduce((m, s) => Math.max(m, s.sortOrder ?? 0), -1);
    await createStatus({ name: '新狀態', sortOrder: maxOrder + 1 });
  };
  const handleRenameColumn = (id, name) => updateStatus(id, { name });
  const handleDeleteColumn = (id, migrateTo) => deleteStatus(id, migrateTo);
  const handleSetDefaultStart = async (id) => {
    await updateStatus(id, { isDefaultStart: true });
  };
  const handleSetDefaultEnd = async (id) => {
    await updateStatus(id, { isDefaultEnd: true });
  };

  const openCreate = () => setModalTodo({});

  // live refresh of modal todo from store
  const liveModalTodo = modalTodo?.id
    ? (todos.find(t => t.id === modalTodo.id) || modalTodo)
    : modalTodo;

  const totalFilterCount = filterAssignees.size + filterPriorities.size + filterTags.size + (filterSubProjectId ? 1 : 0);

  return (
    <div style={{
      padding: 16, height: '100%', background: T.bg,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 12, flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, margin: 0 }}>Todos</h1>
          <div style={{ fontSize: 12, color: T.textMute, marginTop: 2 }}>
            {todos.length} cards across {orderedStatuses.length} columns
            {overdueCount > 0 && (
              <> · <span style={{ color: T.danger, fontWeight: 500 }}>{overdueCount} overdue</span></>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn
            variant={showFilters ? 'subtle' : 'ghost'}
            icon="filter"
            onClick={() => setShowFilters(v => !v)}
          >
            {totalFilterCount > 0 ? `${totalFilterCount} filter${totalFilterCount > 1 ? 's' : ''}` : 'Filter'}
          </Btn>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
            <option value="dueDate-asc">Sort · due ↑</option>
            <option value="dueDate-desc">Sort · due ↓</option>
            <option value="priority">Sort · priority</option>
            <option value="manual">Sort · manual</option>
          </select>
          <Btn variant={hideDone ? 'subtle' : 'ghost'} icon="eye" onClick={() => setHideDone(v => !v)}>
            {hideDone ? 'Show done' : 'Hide done'}
          </Btn>
          <div style={{ width: 1, height: 16, background: T.border, margin: '0 4px' }} />
          <Btn variant="primary" icon="plus" onClick={openCreate}>Add todo</Btn>
        </div>
      </div>

      {showFilters && (
        <FilterPanel
          allAssignees={allAssignees}
          allTags={allTags}
          subProjects={subProjects}
          filterAssignees={filterAssignees}
          filterPriorities={filterPriorities}
          filterTags={filterTags}
          filterSubProjectId={filterSubProjectId}
          onToggleAssignee={(v) => setFilterAssignees(toggleInSet(v))}
          onTogglePriority={(v) => setFilterPriorities(toggleInSet(v))}
          onToggleTag={(v) => setFilterTags(toggleInSet(v))}
          onSetSubProject={setFilterSubProjectId}
          onClearAll={() => {
            setFilterAssignees(new Set());
            setFilterPriorities(new Set());
            setFilterTags(new Set());
            setFilterSubProjectId('');
          }}
        />
      )}

      <KanbanBoard
        statuses={visibleStatuses}
        todos={filteredTodos}
        today={today}
        taskNameById={taskNameById}
        subProjectNameById={subProjectNameById}
        onMoveTodo={handleMove}
        onCardClick={(t) => setModalTodo(t)}
        onRenameStatus={handleRenameColumn}
        onAddStatus={handleAddColumn}
        onDeleteStatus={handleDeleteColumn}
        onReorderStatuses={reorderStatuses}
        onSetDefaultStart={handleSetDefaultStart}
        onSetDefaultEnd={handleSetDefaultEnd}
      />

      {modalTodo && (
        <TodoFormModal
          todo={liveModalTodo?.id ? liveModalTodo : null}
          statuses={orderedStatuses}
          allTasks={allTasks}
          subProjects={subProjects}
          allTags={allTags}
          allAssignees={allAssignees}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalTodo(null)}
          onCreateComment={createComment}
          onUpdateComment={updateComment}
          onDeleteComment={deleteComment}
        />
      )}
    </div>
  );
}

function toggleInSet(value) {
  return (prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };
}

function FilterPanel({
  allAssignees, allTags, subProjects,
  filterAssignees, filterPriorities, filterTags, filterSubProjectId,
  onToggleAssignee, onTogglePriority, onToggleTag, onSetSubProject, onClearAll,
}) {
  const anyActive = filterAssignees.size + filterPriorities.size + filterTags.size + (filterSubProjectId ? 1 : 0) > 0;
  return (
    <div style={{
      marginBottom: 12, padding: 12, background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <FilterSection label="Assignee" items={allAssignees} isActive={(v) => filterAssignees.has(v)} onToggle={onToggleAssignee} />
      <FilterSection
        label="Priority"
        items={[['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]}
        isActive={(v) => filterPriorities.has(v)}
        onToggle={onTogglePriority}
      />
      {allTags.length > 0 && (
        <FilterSection label="Tags" items={allTags.map(t => [t, `#${t}`])} isActive={(v) => filterTags.has(v)} onToggle={onToggleTag} />
      )}
      {subProjects.length > 0 && (
        <div>
          <div style={sectionLabel}>Sub-project</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <ChipButton active={!filterSubProjectId} onClick={() => onSetSubProject('')}>Any</ChipButton>
            {subProjects.map(sp => (
              <ChipButton key={sp.id} active={filterSubProjectId === sp.id} onClick={() => onSetSubProject(sp.id)}>
                {sp.name}
              </ChipButton>
            ))}
          </div>
        </div>
      )}
      {anyActive && (
        <div style={{ alignSelf: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClearAll}>Clear all</Btn>
        </div>
      )}
    </div>
  );
}

function FilterSection({ label, items, isActive, onToggle }) {
  const normalized = items.map(it => Array.isArray(it) ? it : [it, it]);
  return (
    <div>
      <div style={sectionLabel}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {normalized.map(([value, label]) => (
          <ChipButton key={value} active={isActive(value)} onClick={() => onToggle(value)}>
            {label}
          </ChipButton>
        ))}
      </div>
    </div>
  );
}

function ChipButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 8px', fontSize: 11, fontFamily: FONT,
        background: active ? T.irisSoft : T.surface,
        color: active ? T.iris : T.textMute,
        border: `1px solid ${active ? '#D7DAFF' : T.border}`,
        borderRadius: 3, cursor: 'pointer',
        fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </button>
  );
}

const sectionLabel = {
  fontSize: 10, color: T.textDim, textTransform: 'uppercase',
  letterSpacing: 0.5, fontWeight: 600, marginBottom: 4,
};

const selectStyle = {
  height: 26, padding: '0 22px 0 8px', fontFamily: FONT, fontSize: 11,
  color: T.text, background: T.surface, border: `1px solid ${T.border}`,
  borderRadius: 4, cursor: 'pointer', appearance: 'none',
  backgroundImage: `linear-gradient(45deg, transparent 50%, ${T.textDim} 50%), linear-gradient(135deg, ${T.textDim} 50%, transparent 50%)`,
  backgroundPosition: `right 9px top 11px, right 5px top 11px`,
  backgroundSize: '4px 4px, 4px 4px',
  backgroundRepeat: 'no-repeat',
};
