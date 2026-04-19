import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T, FONT, MONO, weekCode } from '../../design/tokens.js';
import { Avatar, Badge, Btn, I, ICON } from '../../design/primitives.jsx';
import { packLanes } from './packLanes.js';
import { addDays, getDateRange } from '../burnup/burnupMath.js';

// Gantt chart — resource rows with lane-packing + drag/resize + hover tooltip
// + click-to-inspect popover + zoom + person filter + read-only mode.

const UNASSIGNED = '__unassigned__';
const LANE_H = 16;
const LANE_GAP = 2;
const ACTUAL_GAP = 3;
const BAND_H = LANE_H * 2 + ACTUAL_GAP;

const ZOOM_PX = { day: 44, week: 14, month: 5 };

function computeTimeline(tasks) {
  if (tasks.length === 0) return [];
  let min = '9999-12-31';
  let max = '0000-01-01';
  tasks.forEach(t => {
    [t.expectedStart, t.actualStart, t.addedDate].forEach(d => { if (d && d < min) min = d; });
    [t.expectedEnd, t.actualEnd].forEach(d => { if (d && d > max) max = d; });
  });
  if (min === '9999-12-31' || max === '0000-01-01') return [];
  return getDateRange(addDays(min, -1), addDays(max, 1));
}

function dateToIndex(dateStr, days) {
  if (!dateStr) return null;
  const i = days.indexOf(dateStr);
  if (i >= 0) return i;
  if (days.length > 0 && dateStr < days[0]) return 0;
  if (days.length > 0 && dateStr > days[days.length - 1]) return days.length - 1;
  return null;
}

function groupByAssignee(bars) {
  const groups = new Map();
  bars.forEach(b => {
    const key = b.person || UNASSIGNED;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  });
  return groups;
}

export function GanttChart({
  tasks,
  today,
  height = 480,
  readOnly = false,
  onUpdateTask,
  onSelectTask,
}) {
  const [zoom, setZoom] = useState('day');
  const [filterPerson, setFilterPerson] = useState('');
  const [hover, setHover] = useState(null); // {task, x, y}
  const [selected, setSelected] = useState(null); // {task, x, y}
  const [drag, setDrag] = useState(null); // {taskId, barType, startX, deltaDays, isResize}
  const timelineRef = useRef(null);
  const dragRef = useRef(null);

  const DAY_W = ZOOM_PX[zoom];

  const filteredTasks = useMemo(
    () => filterPerson
      ? tasks.filter(t => (t.people?.trim() || '') === filterPerson)
      : tasks,
    [tasks, filterPerson]
  );

  const days = useMemo(() => computeTimeline(filteredTasks), [filteredTasks]);
  const todayIdx = useMemo(() => today ? dateToIndex(today, days) : null, [today, days]);

  const bars = useMemo(() => filteredTasks.map(t => {
    let eS = dateToIndex(t.expectedStart, days);
    let eE = dateToIndex(t.expectedEnd, days);
    let aS = dateToIndex(t.actualStart, days);
    let aE = dateToIndex(t.actualEnd, days);

    // apply drag preview (only for the task being dragged)
    if (drag && drag.taskId === t.id && drag.deltaDays !== 0) {
      if (drag.barType === 'plan') {
        if (drag.isResize) {
          eE = eE != null ? Math.max(eS ?? eE, eE + drag.deltaDays) : eE;
        } else {
          eS = eS != null ? eS + drag.deltaDays : eS;
          eE = eE != null ? eE + drag.deltaDays : eE;
        }
      } else if (drag.barType === 'actual') {
        if (drag.isResize) {
          aE = aE != null ? Math.max(aS ?? aE, aE + drag.deltaDays) : aE;
        } else {
          aS = aS != null ? aS + drag.deltaDays : aS;
          aE = aE != null ? aE + drag.deltaDays : aE;
        }
      }
    }

    const plannedStart = eS;
    const plannedEnd = eE != null ? eE + 1 : (eS != null ? eS + 1 : null);
    const overlapCount = t._overlap || 1;
    return {
      id: t.id,
      raw: t,
      name: t.name,
      person: t.people?.trim() || UNASSIGNED,
      progress: t.progress ?? 0,
      overlap: overlapCount,
      done: !!t.actualEnd,
      eS: plannedStart,
      eE: plannedEnd,
      aS,
      aE: aE != null ? aE + 1 : aS != null ? (todayIdx ?? aS) + 0.3 : null,
    };
  }).filter(b => b.eS != null || b.aS != null),
    [filteredTasks, days, drag, todayIdx]
  );

  const rowInfo = useMemo(() => {
    const grouped = groupByAssignee(bars.map(b => ({
      ...b,
      start: b.eS ?? b.aS,
      end: b.eE ?? b.aE ?? (b.eS ?? b.aS) + 1,
    })));
    const info = new Map();
    for (const [person, rowBars] of grouped) {
      const { lanes, laneCount } = packLanes(rowBars);
      info.set(person, { bars: rowBars, lanes, laneCount });
    }
    return info;
  }, [bars]);

  const people = useMemo(() => Array.from(rowInfo.keys()).sort((a, b) => {
    if (a === UNASSIGNED) return 1;
    if (b === UNASSIGNED) return -1;
    return a.localeCompare(b);
  }), [rowInfo]);

  const uniquePeople = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => { const p = t.people?.trim(); if (p) set.add(p); });
    return Array.from(set).sort();
  }, [tasks]);

  const rowHeightFor = (p) => Math.max(48, 12 + rowInfo.get(p).laneCount * (BAND_H + LANE_GAP));

  // -----------------------------------------------------------------------
  // Drag handling
  // -----------------------------------------------------------------------
  const startDrag = useCallback((e, task, barType, isResize) => {
    if (readOnly) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      taskId: task.id,
      barType,
      startX: e.clientX,
      deltaDays: 0,
      isResize,
      pxPerDay: DAY_W,
      raw: task,
      moved: false,
    };
    setDrag({ taskId: task.id, barType, deltaDays: 0, isResize });
    document.body.style.cursor = isResize ? 'ew-resize' : 'grabbing';
    document.body.style.userSelect = 'none';
  }, [readOnly, DAY_W]);

  useEffect(() => {
    const onMove = (e) => {
      const s = dragRef.current;
      if (!s) return;
      const dpx = e.clientX - s.startX;
      const deltaDays = Math.round(dpx / s.pxPerDay);
      if (deltaDays !== s.deltaDays) {
        s.deltaDays = deltaDays;
        s.moved = true;
        setDrag({ taskId: s.taskId, barType: s.barType, deltaDays, isResize: s.isResize });
      }
    };
    const onUp = async () => {
      const s = dragRef.current;
      if (!s) return;
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (s.moved && s.deltaDays !== 0 && onUpdateTask) {
        const task = s.raw;
        const patch = {};
        if (s.barType === 'plan') {
          if (s.isResize) {
            if (task.expectedEnd) patch.expectedEnd = addDays(task.expectedEnd, s.deltaDays);
          } else {
            if (task.expectedStart) patch.expectedStart = addDays(task.expectedStart, s.deltaDays);
            if (task.expectedEnd) patch.expectedEnd = addDays(task.expectedEnd, s.deltaDays);
          }
        } else if (s.barType === 'actual') {
          if (s.isResize) {
            if (task.actualEnd) patch.actualEnd = addDays(task.actualEnd, s.deltaDays);
          } else {
            if (task.actualStart) patch.actualStart = addDays(task.actualStart, s.deltaDays);
            if (task.actualEnd) patch.actualEnd = addDays(task.actualEnd, s.deltaDays);
          }
        }
        if (Object.keys(patch).length > 0) await onUpdateTask(task.id, patch);
      }
      setDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onUpdateTask]);

  // -----------------------------------------------------------------------
  // Scroll to today
  // -----------------------------------------------------------------------
  const scrollToToday = useCallback(() => {
    const el = timelineRef.current;
    if (!el || todayIdx == null) return;
    const x = todayIdx * DAY_W - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, x), behavior: 'smooth' });
  }, [todayIdx, DAY_W]);

  // Auto scroll to today on first mount when today is within range.
  useEffect(() => {
    if (todayIdx == null) return;
    const el = timelineRef.current;
    if (!el) return;
    const x = todayIdx * DAY_W - el.clientWidth / 2;
    el.scrollLeft = Math.max(0, x);
    // run once when timeline changes width
  }, [todayIdx, DAY_W, days.length]);

  // -----------------------------------------------------------------------
  // Header rendering per zoom level
  // -----------------------------------------------------------------------
  const header = useMemo(() => renderHeader(days, zoom, DAY_W, todayIdx), [days, zoom, DAY_W, todayIdx]);

  if (days.length === 0) {
    return (
      <div style={{
        height, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.textDim, fontSize: 12,
      }}>
        No tasks with dates to display.
      </div>
    );
  }

  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
      overflow: 'hidden', height, display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <div style={{
        padding: '8px 12px', borderBottom: `1px solid ${T.divider}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>Resource Gantt</div>
        <Badge tone="neutral" size="sm">by assignee · lane-packed</Badge>
        {readOnly && (
          <Badge tone="neutral" size="sm">
            <I d={ICON.lock} size={9} style={{ marginRight: 3 }} />read-only
          </Badge>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            value={filterPerson}
            onChange={(e) => setFilterPerson(e.target.value)}
            style={selectStyle}
            title="Filter by assignee"
          >
            <option value="">All people</option>
            {uniquePeople.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 2, border: `1px solid ${T.border}`, borderRadius: 4, padding: 2, background: T.surface2 }}>
            {['day', 'week', 'month'].map(z => (
              <button key={z} onClick={() => setZoom(z)} style={{
                padding: '2px 8px', fontSize: 11,
                background: zoom === z ? T.surface : 'transparent',
                color: zoom === z ? T.text : T.textMute,
                border: 'none', borderRadius: 3, cursor: 'pointer',
                fontWeight: zoom === z ? 500 : 400, textTransform: 'capitalize',
                fontFamily: FONT,
              }}>{z}</button>
            ))}
          </div>
          <Btn variant="ghost" onClick={scrollToToday} title="Scroll timeline to today">Today</Btn>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Assignee column */}
        <div style={{
          width: 160, borderRight: `1px solid ${T.border}`,
          background: T.bg, flexShrink: 0, overflow: 'hidden',
        }}>
          <div style={{
            height: 44, borderBottom: `1px solid ${T.border}`, padding: '0 12px',
            display: 'flex', alignItems: 'center',
            fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.6,
          }}>
            Assignee
          </div>
          {people.map(p => {
            const { bars: rb, laneCount } = rowInfo.get(p);
            return (
              <div key={p} style={{
                height: rowHeightFor(p), padding: '0 12px',
                borderBottom: `1px solid ${T.divider}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {p !== UNASSIGNED
                  ? <Avatar name={p} size={20} />
                  : <div style={{ width: 20, height: 20, borderRadius: 20, border: `1px dashed ${T.borderStrong}` }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: p === UNASSIGNED ? T.textDim : T.text }}>
                    {p === UNASSIGNED ? 'Unassigned' : p}
                  </div>
                  <div style={{ fontSize: 10, color: T.textDim, fontFamily: MONO }}>
                    {rb.length} tasks
                    {laneCount > 1 && <span style={{ color: T.warn }}> · {laneCount} lanes</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        <div ref={timelineRef} style={{ flex: 1, overflow: 'auto', minWidth: 0, position: 'relative' }}>
          <div style={{ minWidth: days.length * DAY_W, position: 'relative' }}>
            {/* day header */}
            <div style={{
              display: 'flex', height: 44, borderBottom: `1px solid ${T.border}`,
              position: 'sticky', top: 0, background: T.bg, zIndex: 2,
            }}>
              {header}
            </div>

            {/* rows */}
            {people.map(p => {
              const rH = rowHeightFor(p);
              const { bars: rowBars, lanes, laneCount } = rowInfo.get(p);
              return (
                <div key={p} style={{
                  position: 'relative', height: rH,
                  borderBottom: `1px solid ${T.divider}`,
                  backgroundImage: DAY_W >= 24
                    ? `repeating-linear-gradient(90deg, transparent 0 ${DAY_W - 1}px, ${T.divider} ${DAY_W - 1}px ${DAY_W}px)`
                    : undefined,
                }}>
                  {todayIdx != null && (
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: todayIdx * DAY_W + DAY_W / 2, width: 1,
                      borderLeft: `1px dashed ${T.today}`, pointerEvents: 'none',
                    }} />
                  )}
                  {rowBars.map((b, i) => {
                    const lane = lanes[i];
                    const top = 6 + lane * (BAND_H + LANE_GAP);
                    const isBeingDragged = drag?.taskId === b.id;
                    const overlapStyle = getOverlapStyle(b.overlap);
                    const plannedBar = (b.eS != null && b.eE != null) && (
                      <div
                        key={`p${b.id}`}
                        onMouseDown={(e) => startDrag(e, b.raw, 'plan', false)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (dragRef.current) return;
                          setSelected({ task: b.raw, x: e.clientX, y: e.clientY });
                          onSelectTask?.(b.raw);
                        }}
                        onMouseMove={(e) => { if (!drag) setHover({ task: b.raw, x: e.clientX, y: e.clientY, type: 'plan' }); }}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          position: 'absolute', top, left: b.eS * DAY_W + 3,
                          width: Math.max(20, (b.eE - b.eS) * DAY_W - 6), height: LANE_H,
                          background: overlapStyle.bg,
                          border: `1px solid ${overlapStyle.border}`,
                          borderRadius: 3, display: 'flex', alignItems: 'center', padding: '0 6px',
                          fontSize: 10, color: overlapStyle.fg, fontWeight: 500,
                          whiteSpace: 'nowrap', overflow: 'hidden',
                          cursor: readOnly ? 'default' : (isBeingDragged && !drag?.isResize) ? 'grabbing' : 'grab',
                          opacity: isBeingDragged ? 0.85 : 1,
                          boxShadow: isBeingDragged ? `0 2px 6px rgba(0,0,0,0.15)` : undefined,
                          userSelect: 'none',
                        }}
                      >
                        {b.overlap >= 2 && <span style={{ marginRight: 3, fontSize: 9 }}>⚠</span>}
                        {b.name}
                        {!readOnly && (b.eE - b.eS) * DAY_W >= 24 && (
                          <div
                            onMouseDown={(e) => startDrag(e, b.raw, 'plan', true)}
                            style={{
                              position: 'absolute', right: 0, top: 0, bottom: 0, width: 5,
                              cursor: 'ew-resize',
                            }}
                          />
                        )}
                      </div>
                    );
                    const actualBar = (b.aS != null) && (
                      <div
                        key={`a${b.id}`}
                        onMouseDown={(e) => startDrag(e, b.raw, 'actual', false)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (dragRef.current) return;
                          setSelected({ task: b.raw, x: e.clientX, y: e.clientY });
                          onSelectTask?.(b.raw);
                        }}
                        onMouseMove={(e) => { if (!drag) setHover({ task: b.raw, x: e.clientX, y: e.clientY, type: 'actual' }); }}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          position: 'absolute', top: top + LANE_H + ACTUAL_GAP,
                          left: b.aS * DAY_W + 3,
                          width: Math.max(20, ((b.aE ?? b.aS + 0.3) - b.aS) * DAY_W - 6),
                          height: LANE_H,
                          background: b.done
                            ? T.green
                            : `repeating-linear-gradient(135deg, ${T.green}, ${T.green} 4px, #68C07F 4px, #68C07F 8px)`,
                          borderRadius: 3, padding: '0 6px',
                          display: 'flex', alignItems: 'center',
                          fontSize: 10, color: '#fff', fontWeight: 500,
                          whiteSpace: 'nowrap', overflow: 'hidden',
                          cursor: readOnly ? 'default' : 'grab',
                          opacity: isBeingDragged ? 0.85 : 1,
                          boxShadow: isBeingDragged ? `0 2px 6px rgba(0,0,0,0.15)` : undefined,
                          userSelect: 'none',
                        }}
                      >
                        {b.done ? '✓ done' : `${b.progress}%`}
                        {!readOnly && b.aE != null && ((b.aE - b.aS) * DAY_W) >= 24 && (
                          <div
                            onMouseDown={(e) => startDrag(e, b.raw, 'actual', true)}
                            style={{
                              position: 'absolute', right: 0, top: 0, bottom: 0, width: 5,
                              cursor: 'ew-resize',
                            }}
                          />
                        )}
                      </div>
                    );
                    return (
                      <React.Fragment key={b.id}>
                        {plannedBar}
                        {actualBar}
                      </React.Fragment>
                    );
                  })}
                  {laneCount > 1 && (
                    <div style={{
                      position: 'absolute', right: 6, top: 4,
                      fontSize: 9, color: T.textDim, fontFamily: MONO,
                      pointerEvents: 'none',
                    }}>
                      {laneCount}L
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hover && !drag && <HoverTooltip info={hover} />}

      {/* Click popover */}
      {selected && !drag && (
        <SelectedPopover info={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header per zoom level
// ---------------------------------------------------------------------------
function renderHeader(days, zoom, DAY_W, todayIdx) {
  if (zoom === 'day') {
    return days.map((d, i) => {
      const wc = weekCode(d);
      const prevWc = i > 0 ? weekCode(days[i - 1]) : null;
      const showWeek = wc !== prevWc;
      return (
        <div key={d} style={{
          width: DAY_W, flexShrink: 0, textAlign: 'center',
          fontFamily: MONO, padding: '5px 0',
          borderRight: i < days.length - 1 ? `1px solid ${T.divider}` : 'none',
          borderLeft: showWeek && i > 0 ? `1px solid ${T.border}` : 'none',
          position: 'relative',
        }}>
          {showWeek && (
            <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 0.3, lineHeight: 1 }}>
              {wc}
            </div>
          )}
          <div style={{
            fontSize: 10,
            color: i === todayIdx ? T.today : T.textDim,
            fontWeight: i === todayIdx ? 600 : 400,
            marginTop: showWeek ? 3 : 14,
          }}>
            {d.slice(5)}
          </div>
        </div>
      );
    });
  }

  if (zoom === 'week') {
    // Group indices by ISO week.
    const groups = [];
    for (let i = 0; i < days.length; i++) {
      const wc = weekCode(days[i]);
      if (groups.length === 0 || groups[groups.length - 1].wc !== wc) {
        groups.push({ wc, startIdx: i, endIdx: i });
      } else {
        groups[groups.length - 1].endIdx = i;
      }
    }
    return groups.map((g) => {
      const width = (g.endIdx - g.startIdx + 1) * DAY_W;
      const hasToday = todayIdx != null && todayIdx >= g.startIdx && todayIdx <= g.endIdx;
      return (
        <div key={g.wc + g.startIdx} style={{
          width, flexShrink: 0, textAlign: 'center',
          fontFamily: MONO, padding: '5px 0',
          borderRight: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: 10, color: hasToday ? T.today : T.textDim, fontWeight: hasToday ? 600 : 500 }}>
            {g.wc}
          </div>
          <div style={{ fontSize: 9, color: T.textDim, marginTop: 2 }}>
            {days[g.startIdx].slice(5)}
          </div>
        </div>
      );
    });
  }

  // month
  const groups = [];
  for (let i = 0; i < days.length; i++) {
    const month = days[i].slice(0, 7);
    if (groups.length === 0 || groups[groups.length - 1].month !== month) {
      groups.push({ month, startIdx: i, endIdx: i });
    } else {
      groups[groups.length - 1].endIdx = i;
    }
  }
  return groups.map((g) => {
    const width = (g.endIdx - g.startIdx + 1) * DAY_W;
    const hasToday = todayIdx != null && todayIdx >= g.startIdx && todayIdx <= g.endIdx;
    return (
      <div key={g.month} style={{
        width, flexShrink: 0, textAlign: 'center',
        fontFamily: MONO, padding: '5px 0',
        borderRight: `1px solid ${T.border}`,
      }}>
        <div style={{ fontSize: 11, color: hasToday ? T.today : T.text, fontWeight: 600 }}>
          {g.month}
        </div>
      </div>
    );
  });
}

// ---------------------------------------------------------------------------
// Tooltip / popover
// ---------------------------------------------------------------------------
function HoverTooltip({ info }) {
  const { task, x, y, type } = info;
  const isPlan = type === 'plan';
  const startDate = isPlan ? task.expectedStart : task.actualStart;
  const endDate = isPlan ? task.expectedEnd : task.actualEnd;
  return (
    <div style={{
      position: 'fixed', left: x + 14, top: y + 14, zIndex: 50,
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 6, padding: '8px 10px',
      fontFamily: FONT, fontSize: 11, pointerEvents: 'none',
      minWidth: 200, maxWidth: 280,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: T.text }}>{task.name}</div>
      <div style={{ color: T.textMute, fontSize: 10, marginBottom: 6 }}>
        {task.people || 'Unassigned'} · {task.points}pt
      </div>
      <Row label={isPlan ? 'Planned' : 'Actual'} color={isPlan ? T.iris : T.green}>
        {startDate || '—'} <span style={{ color: T.textFaint }}>→</span> {endDate || '—'}
      </Row>
      {!isPlan && (
        <Row label="Progress" color={T.textMute}>
          {task.actualEnd ? '100% · done' : `${task.progress ?? 0}%`}
        </Row>
      )}
    </div>
  );
}

function SelectedPopover({ info, onClose }) {
  const { task, x, y } = info;
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
      />
      <div style={{
        position: 'fixed',
        left: Math.min(x + 14, window.innerWidth - 320),
        top: Math.min(y + 14, window.innerHeight - 260),
        zIndex: 50,
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 8, padding: 14, width: 300,
        fontFamily: FONT,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>{task.name}</div>
            <div style={{ fontSize: 11, color: T.textMute }}>
              {task.people || 'Unassigned'} · {task.points}pt
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 24, height: 24, border: 'none', background: 'transparent',
              cursor: 'pointer', color: T.textDim, borderRadius: 4,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Close"
          >
            <I d={ICON.x} size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Row label="Planned" color={T.iris}>
            {task.expectedStart || '—'} <span style={{ color: T.textFaint }}>→</span> {task.expectedEnd || '—'}
          </Row>
          <Row label="Actual" color={T.green}>
            {task.actualStart || '—'} <span style={{ color: T.textFaint }}>→</span> {task.actualEnd || '—'}
          </Row>
          <Row label="Progress" color={T.textMute}>
            {task.actualEnd ? '100% · done' : `${task.progress ?? 0}%`}
          </Row>
          <Row label="Added" color={T.textMute}>{task.addedDate || '—'}</Row>
          {(task._overlap || 1) >= 2 && (
            <Row label="Overlap" color={T.warn}>
              {task._overlap} concurrent tasks
            </Row>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
      <span style={{
        fontSize: 10, color: T.textDim, textTransform: 'uppercase',
        letterSpacing: 0.5, minWidth: 64,
      }}>{label}</span>
      <span style={{ color, fontFamily: MONO, fontSize: 11 }}>{children}</span>
    </div>
  );
}

// Tier the overlap visual based on the same-assignee concurrent count.
// 1 (no overlap) → iris · 2 → amber · 3+ → red.
function getOverlapStyle(count) {
  if (count >= 3) {
    return {
      bg: `repeating-linear-gradient(135deg, ${T.dangerSoft}, ${T.dangerSoft} 6px, rgba(220,38,38,0.18) 6px, rgba(220,38,38,0.18) 12px)`,
      border: T.danger,
      fg: T.danger,
    };
  }
  if (count >= 2) {
    return {
      bg: `repeating-linear-gradient(135deg, ${T.warnSoft}, ${T.warnSoft} 6px, rgba(217,119,6,0.22) 6px, rgba(217,119,6,0.22) 12px)`,
      border: T.warn,
      fg: T.warn,
    };
  }
  return { bg: T.irisSoft, border: T.irisDim, fg: T.iris };
}

const selectStyle = {
  height: 26, padding: '0 22px 0 8px', fontFamily: FONT, fontSize: 11,
  color: T.text, background: T.surface, border: `1px solid ${T.border}`,
  borderRadius: 4, cursor: 'pointer', appearance: 'none',
  backgroundImage: `linear-gradient(45deg, transparent 50%, ${T.textDim} 50%), linear-gradient(135deg, ${T.textDim} 50%, transparent 50%)`,
  backgroundPosition: `right 9px top 11px, right 5px top 11px`,
  backgroundSize: '4px 4px, 4px 4px',
  backgroundRepeat: 'no-repeat',
};
