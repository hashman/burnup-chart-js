import React from 'react';
import { Calendar, MessageSquare } from 'lucide-react';

const PRIORITY_STYLES = {
  high: { border: 'border-l-red-500', badge: 'bg-red-50 text-red-600' },
  medium: { border: 'border-l-amber-500', badge: 'bg-amber-50 text-amber-600' },
  low: { border: 'border-l-gray-400', badge: 'bg-gray-100 text-gray-500' },
};

const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' };

const ASSIGNEE_COLORS = [
  'bg-rose-400',
  'bg-orange-400',
  'bg-amber-400',
  'bg-lime-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-indigo-400',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
];

function assigneeColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return ASSIGNEE_COLORS[Math.abs(hash) % ASSIGNEE_COLORS.length];
}

export default function TodoCard({ todo, isDone, onEdit, onDragStart, onDragEnd, allTasks }) {
  const ps = PRIORITY_STYLES[todo.priority] || PRIORITY_STYLES.medium;

  const linkedTask = todo.linkedTaskId
    ? allTasks.find(t => t.id === todo.linkedTaskId)
    : null;

  const isOverdue = !isDone && todo.dueDate && todo.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', todo.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(todo.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(todo)}
      className={`
        bg-white rounded-lg p-3 shadow-sm border-l-4 ${ps.border} cursor-grab active:cursor-grabbing
        hover:shadow-md transition select-none
        ${isDone ? 'opacity-50' : ''}
      `}
    >
      {/* Title + Priority */}
      <div className="flex justify-between items-start mb-2">
        <span className={`font-semibold text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {todo.title}
        </span>
        <span className={`text-[11px] px-1.5 py-0.5 rounded ${ps.badge} ml-2 shrink-0`}>
          {PRIORITY_LABELS[todo.priority]}
        </span>
      </div>

      {/* Linked Task */}
      <div className="text-xs text-gray-500 mb-2">
        {linkedTask ? (
          <span className="text-indigo-500">🔗 {linkedTask.name}</span>
        ) : todo.linkedTaskId ? (
          <span className="text-gray-400">無關聯任務</span>
        ) : null}
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1">
          {todo.assignee && (
            <>
              <div className={`w-5 h-5 rounded-full ${assigneeColor(todo.assignee)} text-white flex items-center justify-center text-[10px] font-bold`}>
                {todo.assignee.charAt(0).toUpperCase()}
              </div>
              <span>{todo.assignee}</span>
            </>
          )}
        </div>
        {todo.comments && todo.comments.length > 0 && (
          <span className="flex items-center gap-0.5" title={`${todo.comments.length} 則留言`}>
            <MessageSquare size={11} />
            {todo.comments.length}
          </span>
        )}
        {todo.dueDate && (
          <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-semibold' : ''}`}>
            <Calendar size={11} />
            {todo.dueDate.slice(5).replace('-', '/')}
          </span>
        )}
        {todo.tags && todo.tags.length > 0 && (
          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
            {todo.tags[0]}{todo.tags.length > 1 ? ` +${todo.tags.length - 1}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}
