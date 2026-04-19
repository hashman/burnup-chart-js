import React from 'react';
import { T, MONO } from '../../design/tokens.js';
import { I, ICON, Avatar, Badge, Dot } from '../../design/primitives.jsx';

const STATUS_META = {
  active:    { tone: 'iris',    label: 'Active',    color: (t) => t.iris },
  paused:    { tone: 'warn',    label: 'Paused',    color: (t) => t.warn },
  done:      { tone: 'green',   label: 'Done',      color: (t) => t.green },
  cancelled: { tone: 'neutral', label: 'Cancelled', color: (t) => t.textDim },
};

const PRIO_META = {
  high:   { tone: 'danger', label: 'high' },
  medium: { tone: 'warn',   label: 'medium' },
  low:    { tone: 'neutral', label: 'low' },
};

export function SubProjectCard({ sp, selected, onClick, onEdit, onDelete }) {
  const s = STATUS_META[sp.status] || STATUS_META.active;
  const p = PRIO_META[sp.priority] || PRIO_META.medium;
  const waiting = sp.activeWaitingCount || 0;
  const tasks = (sp.linkedTaskIds || []).length;
  const tags = Array.isArray(sp.tags) ? sp.tags : [];

  return (
    <div
      onClick={onClick}
      style={{
        background: T.surface,
        border: `1px solid ${selected ? T.iris : T.border}`,
        boxShadow: selected ? `0 0 0 2px ${T.irisSoft}` : 'none',
        borderRadius: 6, padding: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
        cursor: 'pointer',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Dot color={s.color(T)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>{sp.name}</span>
            <Badge tone={s.tone} size="sm">{s.label}</Badge>
            <Badge tone={p.tone} size="sm">P · {p.label}</Badge>
          </div>
          {sp.description && (
            <div style={{ fontSize: 11, color: T.textMute, wordBreak: 'break-word' }}>
              {sp.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2, color: T.textDim }}>
          <button
            style={iconBtn}
            onClick={(e) => { e.stopPropagation(); onEdit?.(sp); }}
            title="Edit"
          ><I d={ICON.pencil} size={12} /></button>
          <button
            style={iconBtn}
            onClick={(e) => { e.stopPropagation(); onDelete?.(sp); }}
            title="Delete"
          ><I d={ICON.trash} size={12} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.textMute, flexWrap: 'wrap' }}>
        {sp.owner && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Avatar name={sp.owner} size={14} />{sp.owner}
          </span>
        )}
        {sp.dueDate && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO }}>
            <I d={ICON.calendar} size={11} />{sp.dueDate}
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <I d={ICON.folder} size={11} />{tasks} linked task{tasks === 1 ? '' : 's'}
        </span>
        {waiting > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.warn }}>
            <I d={ICON.clock} size={11} />{waiting} waiting
          </span>
        )}
      </div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tags.map(t => <Badge key={t} tone="neutral" size="sm">#{t}</Badge>)}
        </div>
      )}
    </div>
  );
}

const iconBtn = {
  width: 22, height: 22, border: 'none', background: 'transparent',
  cursor: 'pointer', color: T.textDim, borderRadius: 3,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
