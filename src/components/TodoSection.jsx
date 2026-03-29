import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

export default function TodoSection({ todos, statuses, onToggleTodo, onNavigateToTodoTab }) {
  const [expanded, setExpanded] = useState(false);

  if (!todos || todos.length === 0) return null;

  const startStatus = statuses.find(s => s.isDefaultStart);
  const endStatus = statuses.find(s => s.isDefaultEnd);

  const doneCount = todos.filter(t => t.status === endStatus?.id).length;
  const total = todos.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
        📋 關聯 Todo
        <span
          onClick={onNavigateToTodoTab}
          className="text-xs font-normal normal-case text-indigo-500 hover:text-indigo-700 cursor-pointer ml-auto"
        >
          前往 Todo Tab →
        </span>
      </h4>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        {/* Progress bar */}
        <div
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 font-mono whitespace-nowrap">{doneCount} / {total}</span>
        </div>

        {/* Checklist */}
        {expanded && (
          <div className="flex flex-col gap-1.5 pl-5">
            {todos.map(todo => {
              const isDone = todo.status === endStatus?.id;
              return (
                <label key={todo.id} className="flex items-center gap-2 text-sm cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => onToggleTodo(todo.id, isDone ? startStatus?.id : endStatus?.id)}
                    className="accent-emerald-500"
                  />
                  <span className={isDone ? 'line-through text-gray-400' : 'text-gray-700 group-hover:text-gray-900'}>
                    {todo.title}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
