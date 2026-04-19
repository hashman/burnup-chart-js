import React, { useEffect, useMemo } from 'react';
import { T, FONT, MONO, weekCodeRange } from '../../design/tokens.js';
import { I, ICON, Avatar, Badge } from '../../design/primitives.jsx';

// Read-only task detail modal. Shown when a task is clicked from
// Burnup / Gantt. For editing tasks, the main burnup table still
// owns the inline editing flow.

export function TaskDetailModal({ task, todos = [], statuses = [], onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const linkedTodos = useMemo(
    () => todos.filter(t => t.linkedTaskId === task?.id),
    [todos, task]
  );

  const endStatusId = useMemo(
    () => statuses.find(s => s.isDefaultEnd)?.id,
    [statuses]
  );

  const doneCount = linkedTodos.filter(t => t.status === endStatusId).length;
  const totalCount = linkedTodos.length;
  const todoPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : null;
  const progressPct = todoPct ?? task?.progress ?? 0;

  if (!task) return null;

  const done = !!task.actualEnd;
  const logs = task.logs || [];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={{
          padding: '14px 16px', borderBottom: `1px solid ${T.divider}`,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <Avatar name={task.people || 'Unassigned'} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
              {task.showLabel && <Badge tone="iris" size="sm">in chart</Badge>}
              {done && <Badge tone="green" size="sm">done</Badge>}
              <span style={{ fontSize: 10, color: T.textDim, fontFamily: MONO }}>
                #{task.id.slice(-6)} · {task.points}pt
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, wordBreak: 'break-word' }}>{task.name}</div>
            <div style={{ fontSize: 11, color: T.textMute, marginTop: 2 }}>
              {task.people || 'Unassigned'}
              {task.addedDate && <> · added {task.addedDate}</>}
            </div>
          </div>
          <button style={iconBtn} onClick={onClose} title="Close (Esc)">
            <I d={ICON.x} size={14} />
          </button>
        </header>

        <div style={{
          padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
          overflow: 'auto', flex: 1, minHeight: 0,
        }}>
          {/* Date cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <DateCard
              label="Planned"
              tone={T.iris}
              soft={T.irisSoft}
              border="#D7DAFF"
              start={task.expectedStart}
              end={task.expectedEnd}
            />
            <DateCard
              label="Actual"
              tone={T.green}
              soft={T.greenSoft}
              border="#C6E5CC"
              start={task.actualStart}
              end={task.actualEnd || (task.actualStart ? 'in progress' : null)}
            />
          </div>

          {/* Progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 500 }}>Progress</span>
              <span style={{ fontSize: 11, fontFamily: MONO, color: T.textMute }}>
                {totalCount > 0 ? `${doneCount}/${totalCount} todos · ` : ''}{progressPct}%
              </span>
            </div>
            <div style={{ height: 6, background: T.surface2, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${progressPct}%`, height: '100%',
                background: done ? T.green : T.iris,
              }} />
            </div>
            {totalCount > 0 && (
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
                Auto-derived from linked todos
              </div>
            )}
          </div>

          {/* Linked todos */}
          {linkedTodos.length > 0 && (
            <div>
              <div style={sectionHeader}>
                Linked todos <Badge tone="neutral" size="sm">{linkedTodos.length}</Badge>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {linkedTodos.slice(0, 12).map(td => {
                  const tdDone = td.status === endStatusId;
                  return (
                    <div key={td.id} style={{
                      padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 12, borderRadius: 4,
                      background: tdDone ? T.surface2 : 'transparent',
                    }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: 3,
                        border: `1.5px solid ${tdDone ? T.green : T.borderStrong}`,
                        background: tdDone ? T.green : 'transparent',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {tdDone && <I d={ICON.check} size={8} style={{ color: '#fff' }} />}
                      </div>
                      <span style={{
                        color: tdDone ? T.textMute : T.text,
                        textDecoration: tdDone ? 'line-through' : 'none',
                        flex: 1, minWidth: 0, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{td.title}</span>
                      {td.assignee && (
                        <span style={{ fontSize: 10, color: T.textDim }}>{td.assignee}</span>
                      )}
                    </div>
                  );
                })}
                {linkedTodos.length > 12 && (
                  <div style={{ fontSize: 10, color: T.textDim, padding: '4px 8px' }}>
                    and {linkedTodos.length - 12} more…
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Week code row */}
          {(task.expectedStart || task.actualStart) && (
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.textMute, flexWrap: 'wrap' }}>
              {task.expectedStart && (
                <div>
                  <span style={sectionLabel}>Planned W-code</span>{' '}
                  <span style={{ fontFamily: MONO, color: T.iris }}>
                    {weekCodeRange(task.expectedStart, task.expectedEnd || task.expectedStart)}
                  </span>
                </div>
              )}
              {task.actualStart && (
                <div>
                  <span style={sectionLabel}>Actual W-code</span>{' '}
                  <span style={{ fontFamily: MONO, color: T.green }}>
                    {weekCodeRange(task.actualStart, task.actualEnd || task.actualStart)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div>
              <div style={sectionHeader}>Logs <Badge tone="neutral" size="sm">{logs.length}</Badge></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {logs.slice(0, 8).map(l => (
                  <div key={l.id} style={{
                    padding: '6px 8px', borderRadius: 4, background: T.surface2,
                    fontSize: 11, color: T.textMute,
                  }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: T.textDim, marginBottom: 2 }}>
                      {l.date}
                    </div>
                    <div style={{ color: T.text, wordBreak: 'break-word' }}>{l.content}</div>
                  </div>
                ))}
                {logs.length > 8 && (
                  <div style={{ fontSize: 10, color: T.textDim, padding: '2px 8px' }}>
                    and {logs.length - 8} more…
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DateCard({ label, tone, soft, border, start, end }) {
  const emptyStyle = { color: T.textFaint };
  return (
    <div style={{
      padding: 10, border: `1px solid ${border}`, borderRadius: 5, background: soft,
    }}>
      <div style={{
        fontSize: 10, color: tone, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
      }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 12, color: T.text, ...(!start ? emptyStyle : {}) }}>
        {start ? `${start} → ${end || '—'}` : '—'}
      </div>
    </div>
  );
}

const sectionHeader = {
  fontSize: 11, fontWeight: 500, marginBottom: 6,
  display: 'flex', alignItems: 'center', gap: 6,
};
const sectionLabel = {
  fontSize: 10, color: T.textDim, textTransform: 'uppercase',
  letterSpacing: 0.5, fontWeight: 600,
};
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 200, padding: 20,
};
const modal = {
  background: T.surface, color: T.text, fontFamily: FONT,
  border: `1px solid ${T.border}`, borderRadius: 8,
  width: 600, maxWidth: '100%', maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 12px 36px rgba(0,0,0,0.14)',
};
const iconBtn = {
  width: 26, height: 26, border: 'none', background: 'transparent',
  color: T.textDim, cursor: 'pointer', borderRadius: 4,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
