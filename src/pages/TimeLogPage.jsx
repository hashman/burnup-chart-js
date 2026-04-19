import React, { useEffect, useMemo, useState } from 'react';
import { T, FONT, MONO } from '../design/tokens.js';
import { Btn, Badge, I, ICON } from '../design/primitives.jsx';

// Personal time log page: quick-entry form + grouped entry list +
// summary by period (day / week / month) with percent breakdown.

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function weekdayIso(date) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

const SERIES_COLORS = [T.iris, T.green, T.violet, T.warn, T.danger, '#0891B2', '#DB2777', '#52525B'];

function pickColor(i) {
  return SERIES_COLORS[i % SERIES_COLORS.length];
}

export function TimeLogPage({ data }) {
  const {
    timeEntries,
    createTimeEntry, updateTimeEntry, deleteTimeEntry,
    refreshTimeEntries, fetchTimeEntrySummary,
  } = data;

  const [period, setPeriod] = useState('day');
  const [summary, setSummary] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const knownItems = useMemo(() => {
    const s = new Set();
    timeEntries.forEach(e => { if (e.item) s.add(e.item); });
    return Array.from(s).sort();
  }, [timeEntries]);

  // Build a colour map keyed by item, stable across renders.
  const itemColor = useMemo(() => {
    const entries = [...new Set(timeEntries.map(e => e.item))].sort();
    const map = new Map();
    entries.forEach((name, i) => map.set(name, pickColor(i)));
    return map;
  }, [timeEntries]);

  useEffect(() => {
    let cancelled = false;
    fetchTimeEntrySummary(period).then(r => { if (!cancelled && r) setSummary(r); });
    return () => { cancelled = true; };
  }, [period, timeEntries.length, fetchTimeEntrySummary]);

  const groupedByDate = useMemo(() => {
    const map = new Map();
    timeEntries.forEach(e => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    });
    const keys = Array.from(map.keys()).sort().reverse();
    return keys.map(date => ({
      date,
      entries: map.get(date).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
      total: map.get(date).reduce((s, e) => s + (e.hours || 0), 0),
    }));
  }, [timeEntries]);

  return (
    <div style={{
      padding: 16, height: '100%', overflow: 'auto', background: T.bg, fontFamily: FONT,
    }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, margin: 0 }}>Time log</h1>
          <div style={{ fontSize: 12, color: T.textMute, marginTop: 2 }}>
            {timeEntries.length} entries · {summary?.overall?.total ?? 0} hours total
          </div>
        </div>
        <Btn variant="ghost" onClick={refreshTimeEntries}>Refresh</Btn>
      </header>

      <QuickEntryForm
        knownItems={knownItems}
        onSubmit={async (payload) => { await createTimeEntry(payload); }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, alignItems: 'flex-start', marginTop: 12 }}>
        {/* Left: entries grouped by date */}
        <section>
          {groupedByDate.length === 0 ? (
            <EmptyState />
          ) : groupedByDate.map(group => (
            <DateGroup
              key={group.date}
              group={group}
              itemColor={itemColor}
              editingId={editingId}
              setEditingId={setEditingId}
              onUpdate={updateTimeEntry}
              onDelete={deleteTimeEntry}
            />
          ))}
        </section>

        {/* Right: summary */}
        <aside style={{
          position: 'sticky', top: 0,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
          padding: 12,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Summary</div>
            <div style={{
              display: 'flex', gap: 2, padding: 2,
              background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 4,
            }}>
              {['day', 'week', 'month'].map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '2px 8px', fontSize: 10, fontFamily: FONT,
                  background: period === p ? T.surface : 'transparent',
                  color: period === p ? T.text : T.textMute,
                  border: 'none', borderRadius: 3, cursor: 'pointer',
                  fontWeight: period === p ? 500 : 400, textTransform: 'capitalize',
                }}>{p}</button>
              ))}
            </div>
          </div>

          {!summary || summary.buckets.length === 0 ? (
            <div style={{ fontSize: 11, color: T.textDim, padding: 12, textAlign: 'center' }}>
              無資料
            </div>
          ) : (
            <>
              <OverallBlock overall={summary.overall} itemColor={itemColor} />
              <div style={{
                fontSize: 10, color: T.textDim, textTransform: 'uppercase',
                letterSpacing: 0.5, fontWeight: 600, marginTop: 14, marginBottom: 6,
              }}>
                Per {period}
              </div>
              <div style={{ maxHeight: 360, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {summary.buckets.map(b => (
                  <BucketBlock key={b.key} bucket={b} period={period} itemColor={itemColor} />
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function QuickEntryForm({ knownItems, onSubmit }) {
  const [item, setItem] = useState('');
  const [hours, setHours] = useState('1');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = item.trim() && parseFloat(hours) > 0 && date && !submitting;

  const submit = async (e) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit?.({
      item: item.trim(),
      hours: parseFloat(hours),
      date,
      note: note.trim() || null,
    });
    setSubmitting(false);
    setItem('');
    setNote('');
    setHours('1');
  };

  return (
    <form onSubmit={submit} style={{
      display: 'grid',
      gridTemplateColumns: '1fr 110px 150px auto',
      gap: 6, padding: 10,
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
    }}>
      <input
        type="text"
        value={item}
        onChange={(e) => setItem(e.target.value)}
        placeholder="花時間在什麼上面？"
        list="time-log-items"
        disabled={submitting}
        style={input}
      />
      <input
        type="number"
        min="0.25"
        step="0.25"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        disabled={submitting}
        style={{ ...input, fontFamily: MONO }}
        title="Hours (0.25 step)"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={submitting}
        style={{ ...input, fontFamily: MONO }}
      />
      <Btn variant="primary" type="submit" icon="plus" disabled={!canSubmit}>Log</Btn>
      <textarea
        rows={1}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="備註（可留空）"
        disabled={submitting}
        style={{
          ...input, gridColumn: '1 / -1',
          resize: 'vertical', minHeight: 28, fontFamily: FONT,
        }}
      />
      <datalist id="time-log-items">
        {knownItems.map(it => <option key={it} value={it} />)}
      </datalist>
    </form>
  );
}

function EmptyState() {
  return (
    <div style={{
      padding: 32, textAlign: 'center',
      background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 6,
    }}>
      <I d={ICON.clock} size={28} style={{ color: T.textFaint, marginBottom: 8 }} />
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>還沒有任何紀錄</div>
      <div style={{ fontSize: 11, color: T.textMute }}>
        用上方表單記錄今天花時間做了什麼。自由文字，之後可以自動帶出。
      </div>
    </div>
  );
}

function DateGroup({ group, itemColor, editingId, setEditingId, onUpdate, onDelete }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '4px 2px', fontSize: 11, color: T.textMute,
        borderBottom: `1px solid ${T.divider}`, marginBottom: 6,
      }}>
        <span>
          <span style={{ fontFamily: MONO, fontWeight: 600, color: T.text }}>{group.date}</span>
          <span style={{ marginLeft: 6, color: T.textDim }}>{weekdayIso(group.date)}</span>
        </span>
        <span style={{ fontFamily: MONO, color: T.textMute }}>
          {group.total.toFixed(2)}h total
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {group.entries.map(e => (
          <EntryRow
            key={e.id}
            entry={e}
            color={itemColor.get(e.item)}
            editing={editingId === e.id}
            onStartEdit={() => setEditingId(e.id)}
            onCancelEdit={() => setEditingId(null)}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function EntryRow({ entry, color, editing, onStartEdit, onCancelEdit, onUpdate, onDelete }) {
  const [draft, setDraft] = useState({
    item: entry.item, hours: String(entry.hours), date: entry.date, note: entry.note || '',
  });
  // Re-sync the draft whenever the backing entry changes (e.g. after a
  // successful update). Render-time prop sync avoids setState-in-effect.
  const [lastEntry, setLastEntry] = useState(entry);
  if (entry !== lastEntry) {
    setLastEntry(entry);
    setDraft({ item: entry.item, hours: String(entry.hours), date: entry.date, note: entry.note || '' });
  }

  const save = async () => {
    const patch = {
      item: draft.item.trim() || entry.item,
      hours: parseFloat(draft.hours) || entry.hours,
      date: draft.date || entry.date,
      note: draft.note.trim() || null,
    };
    await onUpdate(entry.id, patch);
    onCancelEdit();
  };

  if (editing) {
    return (
      <div style={{
        padding: 8, background: T.irisSoft, border: `1px solid #D7DAFF`, borderRadius: 5,
        display: 'grid', gridTemplateColumns: '1fr 80px 120px auto auto', gap: 6,
      }}>
        <input value={draft.item} onChange={(e) => setDraft({ ...draft, item: e.target.value })} style={input} />
        <input type="number" min="0.25" step="0.25" value={draft.hours}
          onChange={(e) => setDraft({ ...draft, hours: e.target.value })} style={{ ...input, fontFamily: MONO }} />
        <input type="date" value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={{ ...input, fontFamily: MONO }} />
        <Btn variant="primary" onClick={save}>Save</Btn>
        <Btn variant="ghost" onClick={onCancelEdit}>Cancel</Btn>
        <input
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          placeholder="Notes"
          style={{ ...input, gridColumn: '1 / -1' }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '10px 1fr 70px auto',
        gap: 8, alignItems: 'center', padding: '6px 8px',
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 5,
        fontSize: 12,
      }}
    >
      <span style={{ width: 4, height: 18, background: color || T.textDim, borderRadius: 2 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.item}
        </div>
        {entry.note && (
          <div style={{ fontSize: 11, color: T.textMute, marginTop: 2, wordBreak: 'break-word' }}>
            {entry.note}
          </div>
        )}
      </div>
      <span style={{ fontFamily: MONO, color: T.textMute, textAlign: 'right' }}>
        {entry.hours.toFixed(2)}h
      </span>
      <span style={{ display: 'flex', gap: 2 }}>
        <button style={iconBtn} onClick={onStartEdit} title="Edit">
          <I d={ICON.pencil} size={12} />
        </button>
        <button
          style={iconBtn}
          onClick={() => confirm('Delete this entry?') && onDelete(entry.id)}
          title="Delete"
        >
          <I d={ICON.trash} size={12} />
        </button>
      </span>
    </div>
  );
}

function OverallBlock({ overall, itemColor }) {
  return (
    <div>
      <div style={{
        fontSize: 10, color: T.textDim, textTransform: 'uppercase',
        letterSpacing: 0.5, fontWeight: 600, marginBottom: 4,
      }}>
        Overall · {overall.total.toFixed(2)}h
      </div>
      <StackedBar items={overall.items} itemColor={itemColor} />
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {overall.items.slice(0, 8).map(it => (
          <LegendRow key={it.item} it={it} color={itemColor.get(it.item)} />
        ))}
        {overall.items.length > 8 && (
          <div style={{ fontSize: 10, color: T.textDim }}>
            +{overall.items.length - 8} more
          </div>
        )}
      </div>
    </div>
  );
}

function BucketBlock({ bucket, period, itemColor }) {
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        fontSize: 11, marginBottom: 4,
      }}>
        <span style={{ fontFamily: MONO, color: T.text, fontWeight: 500 }}>
          {period === 'month' ? bucket.key.slice(0, 7) : bucket.key}
        </span>
        <span style={{ fontFamily: MONO, color: T.textMute }}>{bucket.total.toFixed(2)}h</span>
      </div>
      <StackedBar items={bucket.items} itemColor={itemColor} thin />
      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {bucket.items.slice(0, 4).map(it => (
          <Badge key={it.item} tone="neutral" size="sm">
            <span style={{
              width: 6, height: 6, borderRadius: 6,
              background: itemColor.get(it.item), display: 'inline-block', marginRight: 4,
            }} />
            {it.item} · {it.percent}%
          </Badge>
        ))}
      </div>
    </div>
  );
}

function StackedBar({ items, itemColor, thin }) {
  return (
    <div style={{
      height: thin ? 5 : 8, background: T.surface2,
      borderRadius: 3, overflow: 'hidden', display: 'flex',
    }}>
      {items.map(it => (
        <div
          key={it.item}
          title={`${it.item} · ${it.hours}h · ${it.percent}%`}
          style={{ width: `${it.percent}%`, background: itemColor.get(it.item) || T.textDim }}
        />
      ))}
    </div>
  );
}

function LegendRow({ it, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 11, color: T.textMute,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: color || T.textDim, flexShrink: 0 }} />
      <span style={{
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text,
      }}>{it.item}</span>
      <span style={{ fontFamily: MONO, color: T.textMute }}>
        {it.hours}h
      </span>
      <span style={{ fontFamily: MONO, color: T.textDim, minWidth: 40, textAlign: 'right' }}>
        {it.percent}%
      </span>
    </div>
  );
}

const input = {
  padding: '6px 8px', fontSize: 12, fontFamily: FONT, color: T.text,
  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4,
  outline: 'none', minWidth: 0,
};
const iconBtn = {
  width: 22, height: 22, border: 'none', background: 'transparent',
  color: T.textDim, cursor: 'pointer', borderRadius: 3,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
