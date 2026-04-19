import React, { useMemo, useState } from 'react';
import { T, MONO, FONT } from '../design/tokens.js';
import { Btn, Badge, Dot, I, ICON } from '../design/primitives.jsx';
import { BurnupChart } from '../components/burnup/BurnupChart.jsx';
import { KpiStrip } from '../components/burnup/KpiStrip.jsx';
import {
  annotateOverlap,
  computeScope,
  computeCompleted,
  computePlannedToday,
  computeVelocity,
  computeAtRisk,
  computeBurnupSeries,
} from '../components/burnup/burnupMath.js';

function normalizeDate(v) {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString().split('T')[0];
}

function normalizeTask(t) {
  return {
    ...t,
    addedDate: normalizeDate(t.addedDate),
    expectedStart: normalizeDate(t.expectedStart),
    expectedEnd: normalizeDate(t.expectedEnd),
    actualStart: normalizeDate(t.actualStart),
    actualEnd: normalizeDate(t.actualEnd),
  };
}

const SERIES_COLORS = [T.iris, T.green, T.violet, T.warn, T.danger, T.today];

export function MergedPage({ data }) {
  const { projects, mergedProjectIds, setMergedProjectIds, today, todoProgressByTask } = data;

  const [showPicker, setShowPicker] = useState(mergedProjectIds.length === 0);

  const selectedProjects = useMemo(
    () => projects.filter(p => mergedProjectIds.includes(p.id)),
    [projects, mergedProjectIds]
  );

  const tasksByProject = useMemo(() => {
    const map = new Map();
    selectedProjects.forEach(p => {
      map.set(p.id, (p.tasks || []).map(normalizeTask));
    });
    return map;
  }, [selectedProjects]);

  const allTasks = useMemo(() => {
    const out = [];
    tasksByProject.forEach(list => list.forEach(t => out.push(t)));
    return out;
  }, [tasksByProject]);

  const tasksWithOverlap = useMemo(() => annotateOverlap(allTasks), [allTasks]);
  const burnup = useMemo(
    () => computeBurnupSeries(tasksWithOverlap, todoProgressByTask, today),
    [tasksWithOverlap, todoProgressByTask, today]
  );

  const scope = useMemo(() => computeScope(tasksWithOverlap), [tasksWithOverlap]);
  const completed = useMemo(() => computeCompleted(tasksWithOverlap, todoProgressByTask), [tasksWithOverlap, todoProgressByTask]);
  const planned = useMemo(() => computePlannedToday(tasksWithOverlap, today), [tasksWithOverlap, today]);
  const velocity = useMemo(() => computeVelocity(tasksWithOverlap, today), [tasksWithOverlap, today]);
  const atRisk = useMemo(() => computeAtRisk(tasksWithOverlap), [tasksWithOverlap]);

  const contributions = useMemo(() => {
    const total = scope || 1;
    return selectedProjects.map((p, i) => {
      const pts = (tasksByProject.get(p.id) || [])
        .reduce((s, t) => s + (parseInt(t.points, 10) || 0), 0);
      return {
        id: p.id,
        name: p.name,
        points: pts,
        pct: (pts / total) * 100,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
      };
    });
  }, [selectedProjects, tasksByProject, scope]);

  const toggleProject = (pid) => {
    if (mergedProjectIds.includes(pid)) {
      setMergedProjectIds(mergedProjectIds.filter(id => id !== pid));
    } else {
      setMergedProjectIds([...mergedProjectIds, pid]);
    }
  };

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto', background: T.bg }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, margin: 0 }}>Merged view</h1>
          <Badge tone="violet">
            <I d={ICON.merge} size={10} />read-only
          </Badge>
        </div>
        <Btn variant="subtle" icon="settings" onClick={() => setShowPicker(true)}>
          Reconfigure merge
        </Btn>
      </div>

      {/* Scope banner */}
      <div style={{
        padding: '8px 12px', background: T.violetSoft, border: '1px solid #E0D4FB',
        borderRadius: 6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, color: T.violet, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Scope
        </span>
        {selectedProjects.length === 0 ? (
          <span style={{ fontSize: 12, color: T.textDim }}>No projects selected</span>
        ) : (
          selectedProjects.map(p => (
            <Badge key={p.id} tone="violet" size="md">
              <Dot color={T.violet} />{p.name} · {(p.tasks || []).length}
            </Badge>
          ))
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMute, fontFamily: MONO }}>
          {allTasks.length} tasks · {scope} pts
        </span>
      </div>

      {selectedProjects.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center',
          background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 6,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Pick projects to merge</div>
          <div style={{ fontSize: 12, color: T.textMute, marginBottom: 12 }}>
            Combined burnup of the selected projects will appear here.
          </div>
          <Btn variant="primary" icon="plus" onClick={() => setShowPicker(true)}>
            Select projects
          </Btn>
        </div>
      ) : (
        <>
          <KpiStrip
            scope={scope}
            completed={completed}
            planned={planned}
            velocity={velocity}
            atRisk={atRisk}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, marginBottom: 12 }}>
            <div style={{
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 14,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Aggregated burnup</div>
              <BurnupChart
                data={burnup.data}
                annotations={burnup.annotations}
                today={today}
                height={260}
              />
            </div>

            <div style={{
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 12,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Per-project contribution</div>
              {contributions.map(c => (
                <div key={c.id} style={{ marginBottom: 10 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 11, marginBottom: 3,
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Dot color={c.color} />{c.name}
                    </span>
                    <span style={{ fontFamily: MONO, color: T.textMute }}>
                      {c.points}pt · {c.pct.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{
                    height: 5, background: T.surface2, borderRadius: 3, overflow: 'hidden',
                  }}>
                    <div style={{ width: `${c.pct}%`, height: '100%', background: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showPicker && (
        <MergePickerModal
          projects={projects}
          selected={new Set(mergedProjectIds)}
          onToggle={toggleProject}
          onClose={() => setShowPicker(false)}
          onConfirm={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function MergePickerModal({ projects, selected, onToggle, onClose, onConfirm }) {
  const totalTasks = projects
    .filter(p => selected.has(p.id))
    .reduce((n, p) => n + (p.tasks || []).length, 0);
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.divider}` }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Select projects to merge</div>
          <div style={{ fontSize: 11, color: T.textMute, marginTop: 2 }}>
            Choice is remembered locally
          </div>
        </div>
        <div style={{ padding: 10, maxHeight: 360, overflow: 'auto' }}>
          {projects.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: T.textDim }}>
              No projects
            </div>
          ) : projects.map(p => {
            const isSel = selected.has(p.id);
            return (
              <label key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 5, cursor: 'pointer',
                background: isSel ? T.violetSoft : 'transparent',
                border: `1px solid ${isSel ? '#E0D4FB' : 'transparent'}`,
                marginBottom: 4,
              }}>
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => onToggle(p.id)}
                  style={{ accentColor: T.violet }}
                />
                <Dot color={isSel ? T.violet : T.textDim} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: isSel ? 500 : 400 }}>{p.name}</div>
                <span style={{ fontSize: 11, color: T.textDim, fontFamily: MONO }}>
                  {(p.tasks || []).length} tasks
                </span>
              </label>
            );
          })}
        </div>
        <div style={{
          padding: '10px 16px', borderTop: `1px solid ${T.divider}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: T.textMute, fontFamily: MONO }}>
            {selected.size} selected · {totalTasks} tasks
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="subtle" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={onConfirm}>Confirm</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 200, padding: 20,
};
const modal = {
  background: T.surface, color: T.text, fontFamily: FONT,
  border: `1px solid ${T.border}`, borderRadius: 8,
  width: 440, maxWidth: '100%', maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 12px 36px rgba(0,0,0,0.14)',
};
