import React from 'react';
import { T, MONO, weekCodeRange } from '../../design/tokens.js';
import { I, ICON, Avatar, Btn } from '../../design/primitives.jsx';
import { ProgressCell } from './ProgressCell.jsx';

function TaskRow({ t, onUpdateProgress, onToggleShowLabel, onSelectTask }) {
  const done = (t.progress ?? 0) === 100 || !!t.actualEnd;
  const overlap = t._overlap || 1;
  const overlapBg = overlap === 2
    ? 'rgba(217,119,6,0.05)'
    : overlap >= 3 ? 'rgba(220,38,38,0.05)' : 'transparent';
  const short = (d) => d ? d.slice(5) : '';
  const rowOpacity = done ? 0.55 : 1;
  const nameDecoration = done ? 'line-through' : 'none';
  return (
    <tr style={{
      background: overlapBg,
      borderBottom: `1px solid ${T.divider}`,
      opacity: rowOpacity,
      transition: 'opacity 120ms ease',
    }}>
      <td style={{ padding: '7px 10px', width: 28 }}>
        <input
          type="checkbox"
          checked={!!t.showLabel}
          onChange={(e) => onToggleShowLabel?.(t.id, e.target.checked)}
          title="在圖表上顯示此任務標籤"
          style={{ accentColor: T.iris, cursor: 'pointer' }}
        />
      </td>
      <td style={{ padding: '7px 8px', width: 20 }}>
        {overlap >= 2 && (
          <I d={ICON.alert} size={12} style={{ color: overlap >= 3 ? T.danger : T.warn }} />
        )}
      </td>
      <td style={{
        padding: '7px 8px', fontSize: 12,
        color: done ? T.textMute : T.text,
        fontWeight: done ? 400 : 500,
        textDecoration: nameDecoration,
      }}>
        {t.name}
      </td>
      <td style={{
        padding: '7px 8px', width: 50, fontSize: 12, fontFamily: MONO,
        color: done ? T.textDim : T.text, textAlign: 'center',
        textDecoration: nameDecoration,
      }}>
        {done && <I d={ICON.lock} size={9} style={{ color: T.textFaint, marginRight: 2 }} />}
        {t.points}
      </td>
      <td style={{ padding: '7px 8px', width: 110, fontSize: 12 }}>
        {t.people ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Avatar name={t.people} size={16} />
            <span>{t.people}</span>
          </div>
        ) : (
          <span style={{ color: T.textDim }}>—</span>
        )}
      </td>
      <td style={{ padding: '7px 8px', width: 72, fontFamily: MONO, fontSize: 11, color: T.textMute }}>
        {short(t.addedDate)}
      </td>
      <td style={{ padding: '7px 8px', width: 130 }}>
        <ProgressCell
          value={t.progress ?? 0}
          done={done}
          onCommit={(v) => onUpdateProgress?.(t.id, v)}
        />
      </td>
      <td style={{ padding: '7px 8px', width: 170, fontFamily: MONO, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.iris }}>
          <span>{short(t.expectedStart) || '—'}</span>
          <span style={{ color: T.textFaint }}>→</span>
          <span>{short(t.expectedEnd) || '—'}</span>
          {(t.expectedStart || t.expectedEnd) && (
            <span style={{
              marginLeft: 'auto', fontSize: 9.5, color: T.textDim,
              border: `1px solid ${T.border}`, background: T.surface2,
              padding: '1px 4px', borderRadius: 3, letterSpacing: 0.3,
            }}>
              {weekCodeRange(t.expectedStart, t.expectedEnd || t.expectedStart)}
            </span>
          )}
        </div>
      </td>
      <td style={{ padding: '7px 8px', width: 170, fontFamily: MONO, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: t.actualStart ? T.green : T.textFaint }}>
          <span>{short(t.actualStart) || '—'}</span>
          <span style={{ color: T.textFaint }}>→</span>
          <span style={{ fontWeight: t.actualEnd ? 600 : 400 }}>{short(t.actualEnd) || '—'}</span>
          {t.actualStart && (
            <span style={{
              marginLeft: 'auto', fontSize: 9.5, color: T.textDim,
              border: `1px solid ${T.border}`, background: T.surface2,
              padding: '1px 4px', borderRadius: 3, letterSpacing: 0.3,
            }}>
              {weekCodeRange(t.actualStart, t.actualEnd || t.actualStart)}
            </span>
          )}
        </div>
      </td>
      <td style={{ padding: '7px 8px', width: 60, textAlign: 'right', color: T.textDim }}>
        <button
          onClick={() => onSelectTask?.(t)}
          title="View task details"
          style={{
            width: 22, height: 22, border: 'none', background: 'transparent',
            color: T.textDim, cursor: 'pointer', borderRadius: 3,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = T.text; e.currentTarget.style.background = T.surface2; }}
          onMouseOut={(e) => { e.currentTarget.style.color = T.textDim; e.currentTarget.style.background = 'transparent'; }}
        >
          <I d={ICON.more} size={14} />
        </button>
      </td>
    </tr>
  );
}

export function TaskTable({ tasks, onUpdateProgress, onToggleShowLabel, onSelectTask, onAddTask, onToggleHideDone, hideDone }) {
  const visible = hideDone ? tasks.filter(t => !t.actualEnd) : tasks;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: `1px solid ${T.divider}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Tasks</h2>
          <span style={{ fontSize: 11, color: T.textDim, fontFamily: MONO }}>{visible.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Btn variant="ghost" icon="eye" onClick={onToggleHideDone}>
            {hideDone ? 'Show done' : 'Hide done'}
          </Btn>
          <Btn variant="ghost" icon="people">All people</Btn>
          <div style={{ width: 1, height: 16, background: T.border, margin: '0 4px' }} />
          <Btn variant="subtle" icon="plus" onClick={onAddTask}>Add task</Btn>
        </div>
      </div>
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{
              fontSize: 10, color: T.textDim, textTransform: 'uppercase',
              letterSpacing: 0.5, background: T.surface2,
            }}>
              <th style={th} />
              <th style={th} />
              <th style={{ ...th, textAlign: 'left' }}>Name</th>
              <th style={{ ...th, textAlign: 'center' }}>Pts</th>
              <th style={{ ...th, textAlign: 'left' }}>Assignee</th>
              <th style={{ ...th, textAlign: 'left' }}>Added</th>
              <th style={{ ...th, textAlign: 'left' }}>Progress</th>
              <th style={{ ...th, textAlign: 'left', color: T.iris }}>Planned</th>
              <th style={{ ...th, textAlign: 'left', color: T.green }}>Actual</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: T.textDim, fontSize: 12 }}>
                  沒有任務 — 點「Add task」建立第一個
                </td>
              </tr>
            ) : (
              visible.map(t => (
                <TaskRow
                  key={t.id}
                  t={t}
                  onUpdateProgress={onUpdateProgress}
                  onToggleShowLabel={onToggleShowLabel}
                  onSelectTask={onSelectTask}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { padding: '7px 8px', fontWeight: 500 };
