import React from 'react';
import { T, MONO } from '../../design/tokens.js';
import { I, ICON, Avatar, Badge } from '../../design/primitives.jsx';

// Single todo card in the kanban board. Ported from design bundle's
// TodoCard component and wired to real data.

const PRIO_META = {
  high:   { tone: 'danger',  label: 'High', bar: T.danger },
  medium: { tone: 'warn',    label: 'Med',  bar: T.warn },
  low:    { tone: 'neutral', label: 'Low',  bar: T.textFaint },
};

const PRIO_ORDER = { high: 0, medium: 1, low: 2 };

function shortDue(d) {
  return d ? d.slice(5) : '';
}

export { PRIO_ORDER };

export function KanbanCard({ todo, done, today, linkedTaskName, subProjectName, onDragStart, onDragEnd, onClick }) {
  const prio = PRIO_META[todo.priority] || PRIO_META.medium;
  const overdue = todo.dueDate && !done && todo.dueDate < today;
  const tags = Array.isArray(todo.tags) ? todo.tags : [];
  const commentCount = (todo.comments || []).length;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 5,
        padding: 9,
        cursor: 'grab',
        opacity: done ? 0.55 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
        <div style={{
          width: 3, alignSelf: 'stretch', borderRadius: 2,
          background: prio.bar, marginTop: 1, marginBottom: 1,
        }} />
        <div style={{
          flex: 1, fontSize: 12.5, fontWeight: 500, lineHeight: 1.35,
          textDecoration: done ? 'line-through' : 'none',
          color: done ? T.textMute : T.text,
          wordBreak: 'break-word',
        }}>
          {todo.title}
        </div>
        <Badge tone={prio.tone} size="sm">{prio.label}</Badge>
      </div>
      {(linkedTaskName || subProjectName) && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          {subProjectName && <Badge tone="violet" size="sm">◆ {subProjectName}</Badge>}
          {linkedTaskName && (
            <Badge tone="neutral" size="sm">
              <I d={ICON.link} size={9} />
              {linkedTaskName}
            </Badge>
          )}
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, color: T.textMute,
      }}>
        {todo.assignee ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Avatar name={todo.assignee} size={16} />
          </div>
        ) : null}
        {tags[0] && (
          <span style={{ color: T.textDim, fontSize: 10 }}>
            #{tags[0]}{tags.length > 1 && ` +${tags.length - 1}`}
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {commentCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: T.textDim }}>
              <I d={ICON.msg} size={10} />{commentCount}
            </span>
          )}
          {todo.dueDate && (
            <span style={{
              fontFamily: MONO,
              color: overdue ? T.danger : T.textMute,
              fontWeight: overdue ? 600 : 400,
            }}>
              {shortDue(todo.dueDate)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
