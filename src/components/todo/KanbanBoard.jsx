import React, { useState } from 'react';
import { T, FONT, MONO } from '../../design/tokens.js';
import { I, ICON, Badge, Btn } from '../../design/primitives.jsx';
import { KanbanCard } from './KanbanCard.jsx';

// Kanban column board with:
// - card drag-and-drop between columns
// - column drag-and-drop for reordering
// - inline rename on column name click
// - per-column action menu (set default / delete)
// - "+ new status" tile at end

function ColumnMenu({ status, statuses, onRename, onDelete, onSetDefaultStart, onSetDefaultEnd, onClose }) {
  const otherStatuses = statuses.filter(s => s.id !== status.id);
  const [migrateTarget, setMigrateTarget] = useState(otherStatuses[0]?.id || '');
  const [showDelete, setShowDelete] = useState(false);
  return (
    <div style={{
      position: 'absolute', top: 28, right: 6, zIndex: 10,
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
      padding: 6, minWidth: 180,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      fontFamily: FONT, fontSize: 12,
    }} onClick={(e) => e.stopPropagation()}>
      <MenuItem onClick={() => { onRename(); onClose(); }}>
        <I d={ICON.pencil} size={11} />Rename
      </MenuItem>
      {!status.isDefaultStart && (
        <MenuItem onClick={() => { onSetDefaultStart(); onClose(); }}>
          <I d={ICON.arrow} size={11} />Set as default start
        </MenuItem>
      )}
      {!status.isDefaultEnd && (
        <MenuItem onClick={() => { onSetDefaultEnd(); onClose(); }}>
          <I d={ICON.check} size={11} />Set as end
        </MenuItem>
      )}
      <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
      {!showDelete ? (
        <MenuItem danger onClick={() => setShowDelete(true)}>
          <I d={ICON.trash} size={11} />Delete column
        </MenuItem>
      ) : (
        <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: T.textMute }}>
            Move existing todos to:
          </div>
          <select
            value={migrateTarget}
            onChange={(e) => setMigrateTarget(e.target.value)}
            style={{
              padding: '4px 6px', fontSize: 11, fontFamily: FONT,
              border: `1px solid ${T.border}`, borderRadius: 3,
            }}
          >
            {otherStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            <Btn variant="danger" type="button" onClick={() => { onDelete(migrateTarget); onClose(); }}>
              Delete
            </Btn>
            <Btn variant="ghost" type="button" onClick={() => setShowDelete(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, danger, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '5px 8px',
        background: 'transparent', border: 'none', borderRadius: 3,
        cursor: 'pointer', fontFamily: FONT, fontSize: 12,
        color: danger ? T.danger : T.text,
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}
      onMouseOver={(e) => { e.currentTarget.style.background = T.surface2; }}
      onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function ColumnHeader({
  status, count, isEditing, editingName, onStartEdit, onCommitEdit, onCancelEdit,
  onChangeEditingName, menuOpen, onToggleMenu, onDragStart, onDragEnd,
}) {
  return (
    <div style={{
      padding: '8px 10px', borderBottom: `1px solid ${T.divider}`,
      display: 'flex', alignItems: 'center', gap: 6, position: 'relative',
    }}>
      <span
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{ cursor: 'grab', display: 'inline-flex' }}
        title="Drag to reorder column"
      >
        <I d={ICON.grip} size={12} style={{ color: T.textFaint }} />
      </span>
      {isEditing ? (
        <input
          autoFocus
          value={editingName}
          onChange={(e) => onChangeEditingName(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitEdit();
            if (e.key === 'Escape') onCancelEdit();
          }}
          style={{
            fontSize: 12, fontWeight: 600, color: T.text,
            background: T.surface, border: `1px solid ${T.iris}`,
            borderRadius: 3, padding: '1px 4px', outline: 'none',
            flex: 1, minWidth: 0, fontFamily: FONT,
          }}
        />
      ) : (
        <button
          onClick={onStartEdit}
          style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'text',
            fontSize: 12, fontWeight: 600, color: T.text, textAlign: 'left',
            fontFamily: FONT,
          }}
          title="Click to rename"
        >
          {status.name}
        </button>
      )}
      <span style={{ fontSize: 10, color: T.textDim, fontFamily: MONO }}>{count}</span>
      {status.isDefaultStart && <Badge tone="neutral" size="sm">default</Badge>}
      {status.isDefaultEnd && <Badge tone="green" size="sm">end</Badge>}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
          style={{
            background: menuOpen ? T.surface2 : 'transparent',
            border: 'none', cursor: 'pointer', color: T.textDim,
            width: 20, height: 20, borderRadius: 3,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Column actions"
        >
          <I d={ICON.more} size={12} />
        </button>
      </div>
    </div>
  );
}

function EmptyDrop() {
  return (
    <div style={{
      padding: '24px 10px', textAlign: 'center',
      border: `1px dashed ${T.border}`, borderRadius: 4,
      fontSize: 11, color: T.textDim,
    }}>
      <I d={ICON.inbox} size={18} style={{ color: T.textFaint, marginBottom: 6 }} />
      <div>No todos yet</div>
      <div style={{ fontSize: 10, marginTop: 2 }}>Drop one here</div>
    </div>
  );
}

export function KanbanBoard({
  statuses,
  todos,
  today,
  taskNameById,
  subProjectNameById,
  onMoveTodo,
  onCardClick,
  onRenameStatus,
  onAddStatus,
  onDeleteStatus,
  onReorderStatuses,
  onSetDefaultStart,
  onSetDefaultEnd,
}) {
  const [draggingCardId, setDraggingCardId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [menuColumnId, setMenuColumnId] = useState(null);
  const [draggingColumnId, setDraggingColumnId] = useState(null);
  const [dragOverColumnId, setDragOverColumnId] = useState(null);

  const byStatus = new Map();
  statuses.forEach(s => byStatus.set(s.id, []));
  todos.forEach(t => {
    if (byStatus.has(t.status)) byStatus.get(t.status).push(t);
  });

  // -- Card DnD ---
  const onCardDragStart = (e, todo) => {
    setDraggingCardId(todo.id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', todo.id); } catch { /* ignore */ }
  };
  const onCardDragEnd = () => {
    setDraggingCardId(null);
    setDragOverStatus(null);
  };
  const onDragOverColumn = (e, statusId) => {
    if (draggingCardId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverStatus(statusId);
    } else if (draggingColumnId && draggingColumnId !== statusId) {
      e.preventDefault();
      setDragOverColumnId(statusId);
    }
  };
  const onDropColumn = (e, statusId) => {
    if (draggingCardId) {
      e.preventDefault();
      const todoId = draggingCardId || e.dataTransfer.getData('text/plain');
      setDraggingCardId(null);
      setDragOverStatus(null);
      if (!todoId) return;
      const todo = todos.find(t => t.id === todoId);
      if (!todo || todo.status === statusId) return;
      onMoveTodo?.(todoId, statusId);
    } else if (draggingColumnId) {
      e.preventDefault();
      const sourceId = draggingColumnId;
      setDraggingColumnId(null);
      setDragOverColumnId(null);
      if (sourceId === statusId) return;
      const ordered = [...statuses];
      const sourceIdx = ordered.findIndex(s => s.id === sourceId);
      const targetIdx = ordered.findIndex(s => s.id === statusId);
      if (sourceIdx < 0 || targetIdx < 0) return;
      const [moved] = ordered.splice(sourceIdx, 1);
      ordered.splice(targetIdx, 0, moved);
      onReorderStatuses?.(ordered);
    }
  };

  // --- Column rename ---
  const startEdit = (status) => {
    setEditingColumnId(status.id);
    setEditingName(status.name);
  };
  const commitEdit = () => {
    const name = editingName.trim();
    if (name && name !== statuses.find(s => s.id === editingColumnId)?.name) {
      onRenameStatus?.(editingColumnId, name);
    }
    setEditingColumnId(null);
  };
  const cancelEdit = () => setEditingColumnId(null);

  return (
    <div
      style={{ flex: 1, display: 'flex', gap: 10, overflow: 'auto', minHeight: 0 }}
      onClick={() => setMenuColumnId(null)}
    >
      {statuses.map(s => {
        const items = byStatus.get(s.id) || [];
        const isCardDropTarget = dragOverStatus === s.id && draggingCardId;
        const isColumnDropTarget = dragOverColumnId === s.id && draggingColumnId;
        return (
          <div
            key={s.id}
            onDragOver={(e) => onDragOverColumn(e, s.id)}
            onDrop={(e) => onDropColumn(e, s.id)}
            onDragLeave={() => { if (draggingColumnId) setDragOverColumnId(null); }}
            style={{
              flex: '1 1 0', minWidth: 232, maxWidth: 420,
              background: T.bg,
              border: `1px solid ${isCardDropTarget || isColumnDropTarget ? T.iris : T.border}`,
              boxShadow: isCardDropTarget ? `0 0 0 2px ${T.irisSoft}` : 'none',
              borderRadius: 6,
              display: 'flex', flexDirection: 'column', maxHeight: '100%',
              transition: 'border-color 120ms ease, box-shadow 120ms ease',
              opacity: draggingColumnId === s.id ? 0.5 : 1,
              position: 'relative',
            }}
          >
            <ColumnHeader
              status={s}
              count={items.length}
              isEditing={editingColumnId === s.id}
              editingName={editingName}
              onChangeEditingName={setEditingName}
              onStartEdit={() => startEdit(s)}
              onCommitEdit={commitEdit}
              onCancelEdit={cancelEdit}
              menuOpen={menuColumnId === s.id}
              onToggleMenu={() => setMenuColumnId(prev => prev === s.id ? null : s.id)}
              onDragStart={() => setDraggingColumnId(s.id)}
              onDragEnd={() => { setDraggingColumnId(null); setDragOverColumnId(null); }}
            />
            {menuColumnId === s.id && (
              <ColumnMenu
                status={s}
                statuses={statuses}
                onRename={() => startEdit(s)}
                onDelete={(migrateTo) => onDeleteStatus?.(s.id, migrateTo)}
                onSetDefaultStart={() => onSetDefaultStart?.(s.id)}
                onSetDefaultEnd={() => onSetDefaultEnd?.(s.id)}
                onClose={() => setMenuColumnId(null)}
              />
            )}
            <div style={{
              padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
              overflow: 'auto', flex: 1, minHeight: 0,
            }}>
              {items.length === 0 ? <EmptyDrop /> : items.map(t => (
                <KanbanCard
                  key={t.id}
                  todo={t}
                  done={s.isDefaultEnd}
                  today={today}
                  linkedTaskName={t.linkedTaskId ? taskNameById?.get?.(t.linkedTaskId) : null}
                  subProjectName={t.subProjectId ? subProjectNameById?.get?.(t.subProjectId) : null}
                  onDragStart={(e) => onCardDragStart(e, t)}
                  onDragEnd={onCardDragEnd}
                  onClick={() => onCardClick?.(t)}
                />
              ))}
            </div>
          </div>
        );
      })}
      <button
        onClick={onAddStatus}
        style={{
          flex: '0 0 auto', width: 180, minHeight: 120,
          background: 'transparent', border: `1px dashed ${T.border}`,
          borderRadius: 6, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, fontSize: 12, color: T.textDim, fontFamily: FONT,
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = T.borderStrong;
          e.currentTarget.style.color = T.textMute;
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = T.border;
          e.currentTarget.style.color = T.textDim;
        }}
      >
        <I d={ICON.plus} size={12} />New status
      </button>
    </div>
  );
}
