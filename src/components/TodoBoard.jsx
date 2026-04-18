import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, EyeOff, Eye, Filter, X, GripVertical, Play, Flag, ArrowUpDown, PanelRight, Square } from 'lucide-react';
import TodoCard from './TodoCard';
import TodoFormModal from './TodoFormModal';

export default function TodoBoard({
  todos, statuses, allTasks, projects, subProjects = [],
  onCreateTodo, onUpdateTodo, onDeleteTodo,
  onCreateStatus, onUpdateStatus, onDeleteStatus, onReorderStatuses,
  onCreateComment, onUpdateComment, onDeleteComment,
  initialEditTodoId, onClearInitialEditTodoId,
}) {
  const [editingTodoId, setEditingTodoId] = useState(initialEditTodoId || null);
  const [showFormModal, setShowFormModal] = useState(!!initialEditTodoId);
  const [prevInitialEditTodoId, setPrevInitialEditTodoId] = useState(initialEditTodoId);
  const [_draggingId, setDraggingId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [hideDone, setHideDone] = useState(false);

  // Filters (multi-select: Sets)
  const [filterAssignees, setFilterAssignees] = useState(new Set());
  const [filterPriorities, setFilterPriorities] = useState(new Set());
  const [filterTags, setFilterTags] = useState(new Set());
  const [filterSubProjectId, setFilterSubProjectId] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Sort: null | 'priority-desc' | 'priority-asc' | 'dueDate-asc' | 'dueDate-desc'
  const [sortBy, setSortBy] = useState('dueDate-asc');

  // Edit panel variant: 'drawer' (default) | 'modal', persisted in localStorage
  const [editVariant, setEditVariant] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('todoEditVariant') : null;
    return saved === 'modal' || saved === 'drawer' ? saved : 'modal';
  });
  useEffect(() => {
    localStorage.setItem('todoEditVariant', editVariant);
  }, [editVariant]);

  const toggleFilter = (setter, value) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  // Column editing state
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [draggingColumnId, setDraggingColumnId] = useState(null);
  const [dragOverColumnId, setDragOverColumnId] = useState(null);

  const editingTodo = useMemo(() => editingTodoId ? todos.find(t => t.id === editingTodoId) || null : null, [editingTodoId, todos]);

  if (initialEditTodoId && initialEditTodoId !== prevInitialEditTodoId) {
    setPrevInitialEditTodoId(initialEditTodoId);
    setEditingTodoId(initialEditTodoId);
    setShowFormModal(true);
    if (onClearInitialEditTodoId) onClearInitialEditTodoId();
  }

  const allTags = useMemo(() => {
    const tagSet = new Set();
    todos.forEach(t => (t.tags || []).forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [todos]);

  const allAssignees = useMemo(() => {
    const set = new Set();
    todos.forEach(t => { if (t.assignee) set.add(t.assignee); });
    return Array.from(set).sort();
  }, [todos]);

  const filteredTodos = useMemo(() => {
    return todos.filter(t => {
      if (filterAssignees.size > 0 && !filterAssignees.has(t.assignee || '')) return false;
      if (filterPriorities.size > 0 && !filterPriorities.has(t.priority)) return false;
      if (filterTags.size > 0 && !(t.tags || []).some(tag => filterTags.has(tag))) return false;
      if (filterSubProjectId && (t.subProjectId || '') !== filterSubProjectId) return false;
      return true;
    });
  }, [todos, filterAssignees, filterPriorities, filterTags, filterSubProjectId]);

  const subProjectById = useMemo(() => {
    const map = new Map();
    subProjects.forEach(sp => map.set(sp.id, sp));
    return map;
  }, [subProjects]);

  const columnTodos = useMemo(() => {
    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
    const grouped = {};
    statuses.forEach(s => { grouped[s.id] = []; });
    filteredTodos.forEach(t => {
      if (grouped[t.status]) grouped[t.status].push(t);
    });
    Object.values(grouped).forEach(arr => {
      if (sortBy === 'priority-desc') {
        arr.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
      } else if (sortBy === 'priority-asc') {
        arr.sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
      } else if (sortBy === 'dueDate-asc') {
        arr.sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1);
      } else if (sortBy === 'dueDate-desc') {
        arr.sort((a, b) => (b.dueDate || '') < (a.dueDate || '') ? -1 : 1);
      } else {
        arr.sort((a, b) => a.sortOrder - b.sortOrder);
      }
    });
    return grouped;
  }, [filteredTodos, statuses, sortBy]);

  // --- Todo drag-and-drop ---
  const handleDrop = useCallback((e, targetStatusId) => {
    e.preventDefault();
    const todoId = e.dataTransfer.getData('text/plain');
    if (!todoId) return;
    const todo = todos.find(t => t.id === todoId);
    if (!todo || todo.status === targetStatusId) {
      setDragOverColumn(null);
      setDraggingId(null);
      return;
    }
    onUpdateTodo(todoId, { status: targetStatusId });
    setDragOverColumn(null);
    setDraggingId(null);
  }, [todos, onUpdateTodo]);

  const handleDragOver = useCallback((e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(colId);
  }, []);

  // --- Column inline editing ---
  const startEditColumn = (status) => {
    setEditingColumnId(status.id);
    setEditingColumnName(status.name);
  };

  const saveColumnName = () => {
    if (editingColumnId && editingColumnName.trim()) {
      onUpdateStatus(editingColumnId, { name: editingColumnName.trim() });
    }
    setEditingColumnId(null);
    setEditingColumnName('');
  };

  const cancelEditColumn = () => {
    setEditingColumnId(null);
    setEditingColumnName('');
  };

  const handleAddColumn = async () => {
    const endStatus = statuses.find(s => s.isDefaultEnd);
    const sortOrder = endStatus ? endStatus.sortOrder - 0.5 : statuses.length;
    const result = await onCreateStatus({ name: '新狀態', sortOrder });
    if (result) {
      setEditingColumnId(result.id);
      setEditingColumnName(result.name);
    }
  };

  const handleDeleteColumn = (statusToDelete) => {
    const todosInColumn = todos.filter(t => t.status === statusToDelete.id);
    if (todosInColumn.length === 0) {
      if (window.confirm(`確定要刪除「${statusToDelete.name}」狀態嗎？`)) {
        onDeleteStatus(statusToDelete.id);
      }
    } else {
      const otherStatuses = statuses.filter(s => s.id !== statusToDelete.id);
      const targetName = window.prompt(
        `「${statusToDelete.name}」下有 ${todosInColumn.length} 個 Todo。\n請輸入要遷移到的狀態名稱：\n${otherStatuses.map(s => s.name).join('、')}`
      );
      if (targetName) {
        const target = otherStatuses.find(s => s.name === targetName);
        if (target) {
          onDeleteStatus(statusToDelete.id, target.id);
        }
      }
    }
  };

  // --- Column drag-and-drop ---
  const handleColumnDragStart = (e, statusId) => {
    e.dataTransfer.setData('column-id', statusId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingColumnId(statusId);
  };

  const handleColumnDragOver = (e, statusId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (statusId !== draggingColumnId) {
      setDragOverColumnId(statusId);
    }
  };

  const handleColumnDrop = (e, targetStatusId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('column-id');
    if (!sourceId || sourceId === targetStatusId) {
      setDraggingColumnId(null);
      setDragOverColumnId(null);
      return;
    }
    const ordered = [...statuses];
    const sourceIdx = ordered.findIndex(s => s.id === sourceId);
    const targetIdx = ordered.findIndex(s => s.id === targetStatusId);
    const [moved] = ordered.splice(sourceIdx, 1);
    ordered.splice(targetIdx, 0, moved);
    onReorderStatuses(ordered);
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  };

  // --- Modal handlers ---
  const openCreate = () => {
    setEditingTodoId(null);
    setShowFormModal(true);
  };

  const openEdit = (todo) => {
    setEditingTodoId(todo.id);
    setShowFormModal(true);
  };

  const handleSave = (data) => {
    if (data.id) {
      onUpdateTodo(data.id, data);
    } else {
      onCreateTodo(data);
    }
    setShowFormModal(false);
    setEditingTodoId(null);
  };

  const handleDelete = (id) => {
    onDeleteTodo(id);
    setShowFormModal(false);
    setEditingTodoId(null);
  };

  const hasActiveFilters = filterAssignees.size > 0 || filterPriorities.size > 0 || filterTags.size > 0 || !!filterSubProjectId;
  const endStatus = statuses.find(s => s.isDefaultEnd);
  const endStatusName = endStatus ? endStatus.name : '已完成';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            <Plus size={16} /> 新增 Todo
          </button>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1 px-3 py-2 text-sm border rounded-lg transition ${hasActiveFilters ? 'border-indigo-300 text-indigo-600 bg-indigo-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            <Filter size={14} /> 篩選
          </button>
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterAssignees(new Set()); setFilterPriorities(new Set()); setFilterTags(new Set()); setFilterSubProjectId(''); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              清除篩選
            </button>
          )}
          <select
            value={filterSubProjectId}
            onChange={e => setFilterSubProjectId(e.target.value)}
            className={`text-xs px-2 py-1.5 border rounded-lg outline-none ${filterSubProjectId ? 'border-violet-300 text-violet-700 bg-violet-50' : 'border-gray-200 text-gray-500'}`}
            title="篩選 sub-project"
          >
            <option value="">所有 sub-project</option>
            {subProjects.map(sp => {
              const proj = projects.find(p => p.id === sp.burnupProjectId);
              const label = proj ? `${proj.name} / ${sp.name}` : sp.name;
              return <option key={sp.id} value={sp.id}>{label}</option>;
            })}
          </select>
          <span className="w-px h-5 bg-gray-200" />
          {/* Sort buttons */}
          <button
            onClick={() => setSortBy(s => s === 'priority-desc' ? 'priority-asc' : s === 'priority-asc' ? null : 'priority-desc')}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs border rounded-lg transition ${sortBy?.startsWith('priority') ? 'border-amber-300 text-amber-600 bg-amber-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            <ArrowUpDown size={12} />
            優先級{sortBy === 'priority-desc' ? ' ↓' : sortBy === 'priority-asc' ? ' ↑' : ''}
          </button>
          <button
            onClick={() => setSortBy(s => s === 'dueDate-asc' ? 'dueDate-desc' : s === 'dueDate-desc' ? null : 'dueDate-asc')}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs border rounded-lg transition ${sortBy?.startsWith('dueDate') ? 'border-amber-300 text-amber-600 bg-amber-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            <ArrowUpDown size={12} />
            到期日{sortBy === 'dueDate-asc' ? ' ↑' : sortBy === 'dueDate-desc' ? ' ↓' : ''}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditVariant(v => v === 'drawer' ? 'modal' : 'drawer')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            title={editVariant === 'drawer' ? '切換為置中視窗' : '切換為右側面板'}
          >
            {editVariant === 'drawer' ? <PanelRight size={14} /> : <Square size={14} />}
            {editVariant === 'drawer' ? '右側面板' : '置中視窗'}
          </button>
          <button
            onClick={() => setHideDone(h => !h)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            {hideDone ? <Eye size={14} /> : <EyeOff size={14} />}
            {hideDone ? `顯示${endStatusName}` : `隱藏${endStatusName}`}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex flex-col gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
          {/* Assignee */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 w-14 shrink-0">指派人</span>
            {allAssignees.map(a => (
              <label key={a} className={`flex items-center gap-1 text-sm px-2 py-1 rounded-lg border cursor-pointer transition ${filterAssignees.has(a) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <input type="checkbox" checked={filterAssignees.has(a)} onChange={() => toggleFilter(setFilterAssignees, a)} className="sr-only" />
                {a}
              </label>
            ))}
          </div>
          {/* Priority */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 w-14 shrink-0">優先級</span>
            {[['high', '高'], ['medium', '中'], ['low', '低']].map(([val, label]) => (
              <label key={val} className={`flex items-center gap-1 text-sm px-2 py-1 rounded-lg border cursor-pointer transition ${filterPriorities.has(val) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <input type="checkbox" checked={filterPriorities.has(val)} onChange={() => toggleFilter(setFilterPriorities, val)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 w-14 shrink-0">標籤</span>
            {allTags.map(t => (
              <label key={t} className={`flex items-center gap-1 text-sm px-2 py-1 rounded-lg border cursor-pointer transition ${filterTags.has(t) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <input type="checkbox" checked={filterTags.has(t)} onChange={() => toggleFilter(setFilterTags, t)} className="sr-only" />
                {t}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ minHeight: '60vh' }}>
        {statuses.map(col => {
          if (col.isDefaultEnd && hideDone) return null;
          const items = columnTodos[col.id] || [];
          const isOver = dragOverColumn === col.id;
          const isColumnDragOver = dragOverColumnId === col.id;
          const canDelete = !col.isDefaultStart && !col.isDefaultEnd;

          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                if (draggingColumnId) {
                  handleColumnDragOver(e, col.id);
                } else {
                  handleDragOver(e, col.id);
                }
              }}
              onDragLeave={() => {
                setDragOverColumn(null);
                setDragOverColumnId(null);
              }}
              onDrop={(e) => {
                if (draggingColumnId) {
                  handleColumnDrop(e, col.id);
                } else {
                  handleDrop(e, col.id);
                }
              }}
              className={`
                min-w-[280px] flex-1 bg-gray-50 rounded-xl border-t-4
                ${col.isDefaultStart ? 'border-gray-300' : col.isDefaultEnd ? 'border-emerald-400' : 'border-blue-400'}
                p-3 flex flex-col
                ${isOver ? 'ring-2 ring-indigo-300 bg-indigo-50/30' : ''}
                ${isColumnDragOver ? 'ring-2 ring-amber-300' : ''}
                ${draggingColumnId === col.id ? 'opacity-50' : ''}
              `}
            >
              <div className="flex justify-between items-center mb-3 group">
                <div className="flex items-center gap-1">
                  <button
                    draggable
                    onDragStart={(e) => handleColumnDragStart(e, col.id)}
                    className="cursor-grab text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition"
                  >
                    <GripVertical size={14} />
                  </button>
                  {editingColumnId === col.id ? (
                    <input
                      autoFocus
                      value={editingColumnName}
                      onChange={e => setEditingColumnName(e.target.value)}
                      onBlur={saveColumnName}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveColumnName();
                        if (e.key === 'Escape') cancelEditColumn();
                      }}
                      className="text-sm font-bold text-gray-700 border border-indigo-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-indigo-400 w-24"
                    />
                  ) : (
                    <h3
                      className="text-sm font-bold text-gray-700 cursor-pointer hover:text-indigo-600"
                      onDoubleClick={() => startEditColumn(col)}
                    >
                      {col.name}
                    </h3>
                  )}
                  {col.isDefaultStart && (
                    <span title="起始狀態" className="text-xs text-gray-400"><Play size={10} /></span>
                  )}
                  {col.isDefaultEnd && (
                    <span title="完成狀態" className="text-xs text-gray-400"><Flag size={10} /></span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">{items.length}</span>
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteColumn(col)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      title={`刪除「${col.name}」`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {items.length === 0 ? (
                  <div className="text-center text-gray-300 text-sm py-8">
                    沒有{col.name}事項
                  </div>
                ) : (
                  items.map(todo => (
                    <TodoCard
                      key={todo.id}
                      todo={todo}
                      isDone={col.isDefaultEnd}
                      onEdit={openEdit}
                      onDragStart={setDraggingId}
                      onDragEnd={() => { setDraggingId(null); setDragOverColumn(null); }}
                      allTasks={allTasks}
                      subProject={todo.subProjectId ? subProjectById.get(todo.subProjectId) : null}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Add Column Button */}
        <div className="min-w-[60px] flex items-start justify-center pt-3">
          <button
            onClick={handleAddColumn}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-dashed border-gray-300 hover:border-indigo-300 transition"
            title="新增狀態"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <TodoFormModal
          key={editingTodoId || 'new'}
          todo={editingTodo}
          statuses={statuses}
          allTasks={allTasks}
          projects={projects}
          allTags={allTags}
          allAssignees={allAssignees}
          subProjects={subProjects}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setShowFormModal(false); setEditingTodoId(null); }}
          onCreateComment={onCreateComment}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
          variant={editVariant}
        />
      )}
    </div>
  );
}
