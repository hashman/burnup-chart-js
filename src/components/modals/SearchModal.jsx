import React, { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { T, FONT, MONO } from '../../design/tokens.js';
import { I, ICON, Badge, Kbd } from '../../design/primitives.jsx';

// Cmd+K search modal. Fuzzy searches tasks + todos + people + tags.
// Arrow keys to navigate, Enter to open, Esc to close.

export function SearchModal({ tasks = [], todos = [], endStatusId, today, onPickTask, onPickTodo, onClose }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  const corpus = useMemo(() => {
    const rows = [];
    tasks.forEach(t => rows.push({
      kind: 'task', id: t.id, raw: t,
      title: t.name, subtitle: t.people || 'Unassigned',
      due: t.expectedEnd, points: t.points, done: !!t.actualEnd,
    }));
    todos.forEach(t => {
      const tags = (t.tags || []).join(' ');
      const done = endStatusId ? t.status === endStatusId : false;
      rows.push({
        kind: 'todo', id: t.id, raw: t,
        title: t.title, subtitle: t.assignee || 'Unassigned',
        due: t.dueDate, points: null, prio: t.priority, tags,
        done,
        over: !done && t.dueDate && t.dueDate < today,
      });
    });
    return rows;
  }, [tasks, todos, today, endStatusId]);

  // Ranking key: incomplete todos first (0), everything else after (1).
  // Stable sort preserves Fuse.js relevance order within each bucket.
  const rankOf = (r) => (r.kind === 'todo' && !r.done) ? 0 : 1;

  const fuse = useMemo(() => new Fuse(corpus, {
    keys: ['title', 'subtitle', 'tags'],
    threshold: 0.35,
    ignoreLocation: true,
  }), [corpus]);

  const results = useMemo(() => {
    const q = query.trim();
    const raw = q
      ? fuse.search(q).map(r => r.item)
      : corpus;
    // Stable sort incomplete todos to the top while preserving fuse's
    // relevance / original order within each bucket.
    return raw
      .map((item, i) => ({ item, i }))
      .sort((a, b) => {
        const ra = rankOf(a.item);
        const rb = rankOf(b.item);
        if (ra !== rb) return ra - rb;
        return a.i - b.i;
      })
      .slice(0, 30)
      .map(x => x.item);
  }, [query, corpus, fuse]);

  // Reset the highlight when the query changes (render-time sync).
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setActive(0);
  }

  const pickItem = (item) => {
    if (item.kind === 'task') onPickTask?.(item.raw);
    else onPickTodo?.(item.raw);
    onClose?.();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(a => Math.min(results.length - 1, a + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(a => Math.max(0, a - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = results[active];
        if (item) pickItem(item);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [results, active, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: '10px 12px', borderBottom: `1px solid ${T.divider}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <I d={ICON.search} size={14} style={{ color: T.textDim }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, todos, people, tags…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 13, fontFamily: FONT, color: T.text, background: 'transparent',
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} style={{ padding: 6, maxHeight: 360, overflow: 'auto' }}>
          <div style={{
            padding: '6px 10px', fontSize: 10, color: T.textDim,
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}>
            {results.length} result{results.length === 1 ? '' : 's'}
          </div>
          {results.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', fontSize: 12, color: T.textDim }}>
              No matches
            </div>
          ) : results.map((r, i) => <ResultRow key={`${r.kind}-${r.id}`} r={r} idx={i} active={i === active} today={today}
            onPick={() => pickItem(r)}
            onHover={() => setActive(i)}
          />)}
        </div>
        <div style={{
          padding: '8px 12px', borderTop: `1px solid ${T.divider}`,
          display: 'flex', gap: 12, fontSize: 10, color: T.textDim,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Kbd>↑</Kbd><Kbd>↓</Kbd> navigate
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Kbd>↵</Kbd> open
          </span>
          <span style={{ marginLeft: 'auto' }}>
            Fuse.js · tasks · todos · people · tags
          </span>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ r, idx, active, onPick, onHover }) {
  const icon = r.kind === 'task' ? ICON.trend : ICON.kanban;
  const prioTone = r.prio === 'high' ? 'danger' : r.prio === 'medium' ? 'warn' : 'neutral';
  return (
    <div
      data-idx={idx}
      onClick={onPick}
      onMouseEnter={onHover}
      style={{
        padding: '7px 10px', borderRadius: 4, fontSize: 12,
        background: active ? T.surface2 : 'transparent',
        display: 'flex', alignItems: 'center', gap: 8,
        cursor: 'pointer',
      }}
    >
      <I d={icon} size={12} style={{ color: active ? T.text : T.textDim }} />
      <span style={{
        flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: r.done ? T.textMute : T.text,
        textDecoration: r.done ? 'line-through' : 'none',
      }}>{r.title}</span>
      <span style={{ fontSize: 10, color: T.textDim, flexShrink: 0 }}>{r.subtitle}</span>
      {r.prio && <Badge tone={prioTone} size="sm">{r.prio}</Badge>}
      {r.kind === 'task' && r.points != null && (
        <span style={{ fontFamily: MONO, fontSize: 10, color: T.textDim }}>{r.points}pt</span>
      )}
      {r.due && (
        <span style={{
          fontFamily: MONO, fontSize: 10,
          color: r.over ? T.danger : T.textDim, minWidth: 36, textAlign: 'right',
        }}>
          {r.due.slice(5)}
        </span>
      )}
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(15,15,15,0.35)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '80px 20px 20px', zIndex: 300,
};
const modal = {
  width: 520, maxWidth: '100%',
  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
  overflow: 'hidden',
  boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
  color: T.text, fontFamily: FONT,
};
