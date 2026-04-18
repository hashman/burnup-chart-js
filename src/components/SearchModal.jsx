import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';
import Fuse from 'fuse.js';
import { assigneeColor } from '../utils/assigneeColor';

export default function SearchModal({ todos, subProjects, statuses, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const subProjectMap = useMemo(() => {
    const m = new Map();
    (subProjects || []).forEach(sp => m.set(sp.id, sp));
    return m;
  }, [subProjects]);

  const statusMap = useMemo(() => {
    const m = new Map();
    (statuses || []).forEach(s => m.set(s.id, s));
    return m;
  }, [statuses]);

  const enrichedTodos = useMemo(() =>
    todos.map(t => ({
      ...t,
      _subProjectName: t.subProjectId ? (subProjectMap.get(t.subProjectId)?.name || '') : '',
    })),
    [todos, subProjectMap]
  );

  const fuse = useMemo(() =>
    new Fuse(enrichedTodos, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'assignee', weight: 1 },
        { name: 'tags', weight: 1 },
        { name: 'note', weight: 0.5 },
        { name: '_subProjectName', weight: 1 },
      ],
      threshold: 0.4,
      includeScore: true,
    }),
    [enrichedTodos]
  );

  const results = useMemo(() => {
    if (!query.trim()) {
      return [...enrichedTodos]
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 10);
    }
    return fuse.search(query).slice(0, 20).map(r => r.item);
  }, [query, fuse, enrichedTodos]);

  const scrollToActive = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        const active = listRef.current.querySelector('[data-active="true"]');
        if (active) active.scrollIntoView({ block: 'nearest' });
      }
    });
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
      scrollToActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
      scrollToActive();
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      onSelect(results[activeIndex].id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [results, activeIndex, onSelect, onClose, scrollToActive]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[90] bg-black/40" onClick={onClose}>
      <div
        className="max-w-lg w-full mx-auto mt-[15vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '60vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
            placeholder="搜尋 Todo..."
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-xs text-gray-400 hover:text-gray-600">
              清除
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">
              {query ? '找不到符合的 Todo' : '尚無 Todo'}
            </div>
          ) : (
            <div className="py-1">
              {!query && <p className="px-4 py-1 text-[11px] text-gray-400">最近的 Todo</p>}
              {results.map((todo, i) => {
                const isActive = i === activeIndex;
                const status = statusMap.get(todo.status);
                const sp = todo.subProjectId ? subProjectMap.get(todo.subProjectId) : null;
                return (
                  <div
                    key={todo.id}
                    data-active={isActive}
                    onClick={() => onSelect(todo.id)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors ${
                      isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-800 font-medium truncate">{todo.title}</span>
                        {sp && (
                          <span className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                            {sp.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {todo.assignee && (
                        <div className={`w-5 h-5 rounded-full ${assigneeColor(todo.assignee)} text-white flex items-center justify-center text-[10px] font-bold`}>
                          {todo.assignee.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {status && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {status.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><ArrowUp size={10} /><ArrowDown size={10} /> 選擇</span>
          <span className="flex items-center gap-1"><CornerDownLeft size={10} /> 開啟</span>
          <span>esc 關閉</span>
        </div>
      </div>
    </div>
  );
}
