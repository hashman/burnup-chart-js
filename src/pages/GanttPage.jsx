import React, { useMemo } from 'react';
import { T, MONO } from '../design/tokens.js';
import { GanttChart } from '../components/gantt/GanttChart.jsx';
import { annotateOverlap } from '../components/burnup/burnupMath.js';

export function GanttPage({ data }) {
  const { activeProject, allTasks, today, user, updateTask } = data;
  const readOnly = user?.role === 'viewer';

  const tasksWithOverlap = useMemo(() => annotateOverlap(allTasks), [allTasks]);

  const stats = useMemo(() => {
    const byAssignee = new Map();
    tasksWithOverlap.forEach(t => {
      const k = t.people?.trim() || '__u__';
      byAssignee.set(k, (byAssignee.get(k) || 0) + 1);
    });
    const overlapping = tasksWithOverlap.filter(t => (t._overlap || 1) >= 2);
    return {
      peopleCount: byAssignee.size,
      overlapCount: overlapping.length,
    };
  }, [tasksWithOverlap]);

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto', background: T.bg }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, margin: 0 }}>
            {activeProject?.name || 'Gantt'}
          </h1>
          <div style={{ fontSize: 12, color: T.textMute, marginTop: 2 }}>
            {allTasks.length} tasks · {stats.peopleCount} people
            {stats.overlapCount > 0 && (
              <> · <span style={{ color: T.warn, fontWeight: 500, fontFamily: MONO }}>{stats.overlapCount}</span> overlap</>
            )}
          </div>
        </div>
      </div>

      <GanttChart
        tasks={tasksWithOverlap}
        today={today}
        height={520}
        readOnly={readOnly}
        onUpdateTask={updateTask}
      />

      <div style={{
        display: 'flex', gap: 14, fontSize: 11, color: T.textMute,
        marginTop: 10, flexWrap: 'wrap',
      }}>
        <LegendSwatch bg={T.irisSoft} border={T.irisDim}>Planned</LegendSwatch>
        <LegendSwatch bg={T.green}>Actual · done</LegendSwatch>
        <LegendSwatch
          bg={`repeating-linear-gradient(135deg, ${T.green}, ${T.green} 3px, #68C07F 3px, #68C07F 6px)`}
        >
          Actual · in progress
        </LegendSwatch>
        <LegendSwatch
          bg={`repeating-linear-gradient(135deg, ${T.warnSoft}, ${T.warnSoft} 4px, rgba(217,119,6,0.22) 4px, rgba(217,119,6,0.22) 8px)`}
          border={T.warn}
        >
          Overlap · 2 concurrent
        </LegendSwatch>
        <LegendSwatch
          bg={`repeating-linear-gradient(135deg, ${T.dangerSoft}, ${T.dangerSoft} 4px, rgba(220,38,38,0.18) 4px, rgba(220,38,38,0.18) 8px)`}
          border={T.danger}
        >
          Overlap · 3+ concurrent
        </LegendSwatch>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.textDim, fontFamily: MONO }}>
          · 2L = row packed into 2 lanes
        </span>
      </div>
    </div>
  );
}

function LegendSwatch({ bg, border, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 16, height: 10, borderRadius: 2,
        background: bg,
        border: border ? `1px solid ${border}` : undefined,
      }} />
      {children}
    </span>
  );
}
