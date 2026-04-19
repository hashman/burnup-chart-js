import React from 'react';
import { T } from '../../design/tokens.js';
import { ActivityGlyph, Badge } from '../../design/primitives.jsx';
import { formatRelative } from '../../design/formatTime.js';

// Phase 3: consumes the unified /api/activity feed (logs + todo comments +
// sub-project events) via useAppData's `activity` array.

function toneFor(kind) {
  switch (kind) {
    case 'waiting':  return 'warn';
    case 'decision': return 'violet';
    case 'comment':  return 'iris';
    case 'note':     return 'neutral';
    case 'log':
    default:         return 'neutral';
  }
}

function ActivityItem({ a }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: `1px solid ${T.divider}` }}>
      <ActivityGlyph kind={a.kind} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500 }}>{a.who || '—'}</span>
          <Badge tone={toneFor(a.kind)} size="sm">{a.kind}</Badge>
          <span style={{ fontSize: 10, color: T.textDim, marginLeft: 'auto' }}>{formatRelative(a.when)}</span>
        </div>
        {a.text && (
          <div style={{ color: T.textMute, lineHeight: 1.5, wordBreak: 'break-word' }}>
            {a.text}
          </div>
        )}
        {a.context && (
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>↳ {a.context}</div>
        )}
        {a.waitingOn && (
          <div style={{ fontSize: 11, color: T.warn, marginTop: 3 }}>↪ {a.waitingOn}</div>
        )}
      </div>
    </div>
  );
}

export function ActivityRail({ items = [], loading = false }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
      padding: '10px 12px', display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>Activity</div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 10, color: T.textDim,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 6,
            background: loading ? T.today : T.green,
            boxShadow: loading ? 'none' : `0 0 0 2px ${T.greenSoft}`,
            transition: 'background 160ms ease',
          }} />
          {loading ? 'syncing' : 'live'}
        </span>
      </div>
      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4 }}>
        Unified log · comment · event
      </div>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {loading && items.length === 0 ? (
          <div style={{ fontSize: 11, color: T.textDim, padding: '12px 0', textAlign: 'center' }}>
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: 11, color: T.textDim, padding: '12px 0', textAlign: 'center' }}>
            尚無活動紀錄
          </div>
        ) : (
          items.map((a) => <ActivityItem key={a.id} a={a} />)
        )}
      </div>
    </div>
  );
}
