import React, { useMemo, useState } from 'react';
import { T, FONT } from '../design/tokens.js';
import { KpiStrip } from '../components/burnup/KpiStrip.jsx';
import { BurnupChart } from '../components/burnup/BurnupChart.jsx';
import { ActivityRail } from '../components/burnup/ActivityRail.jsx';
import { TaskTable } from '../components/burnup/TaskTable.jsx';
import {
  annotateOverlap,
  computeScope,
  computeCompleted,
  computePlannedToday,
  computeVelocity,
  computeAtRisk,
  computeBurnupSeries,
} from '../components/burnup/burnupMath.js';

export function BurnupPage({ data }) {
  const {
    activeProject,
    allTasks,
    todoProgressByTask,
    today,
    updateTask,
    activity,
    activityLoading,
    onSelectTask,
  } = data;

  const [chartStyle, setChartStyle] = useState('curve');
  const [hideDone, setHideDone] = useState(false);

  const tasksWithOverlap = useMemo(() => annotateOverlap(allTasks), [allTasks]);

  const scope = useMemo(() => computeScope(tasksWithOverlap), [tasksWithOverlap]);
  const completed = useMemo(() => computeCompleted(tasksWithOverlap, todoProgressByTask), [tasksWithOverlap, todoProgressByTask]);
  const planned = useMemo(() => computePlannedToday(tasksWithOverlap, today), [tasksWithOverlap, today]);
  const velocity = useMemo(() => computeVelocity(tasksWithOverlap, today), [tasksWithOverlap, today]);
  const atRisk = useMemo(() => computeAtRisk(tasksWithOverlap), [tasksWithOverlap]);

  const burnup = useMemo(
    () => computeBurnupSeries(tasksWithOverlap, todoProgressByTask, today),
    [tasksWithOverlap, todoProgressByTask, today]
  );

  const headlineHint = (() => {
    if (scope === 0) return '尚無任務';
    const pctDone = (completed / scope) * 100;
    const pctPlanned = (planned / scope) * 100;
    const diff = pctDone - pctPlanned;
    if (Math.abs(diff) < 2) return 'on track';
    return diff < 0
      ? `behind by ~${Math.abs(Math.round(diff))}%`
      : `ahead by ~${Math.round(diff)}%`;
  })();
  const headlineTone = headlineHint.startsWith('behind') ? T.warn : headlineHint.startsWith('ahead') ? T.green : T.textMute;

  const handleProgressChange = async (taskId, value) => {
    await updateTask(taskId, { progress: value });
  };

  const handleToggleShowLabel = async (taskId, next) => {
    await updateTask(taskId, { showLabel: next });
  };

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto', background: T.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, margin: 0 }}>
            {activeProject?.name || 'Burnup'}
          </h1>
          <div style={{ fontSize: 12, color: T.textMute, marginTop: 2 }}>
            {allTasks.length} tasks ·{' '}
            <span style={{ color: headlineTone, fontWeight: 500 }}>{headlineHint}</span>
          </div>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.textMute }}>
          Chart style
          <select
            value={chartStyle}
            onChange={(e) => setChartStyle(e.target.value)}
            style={{
              height: 26, padding: '0 22px 0 8px', fontFamily: FONT, fontSize: 12,
              color: T.text, background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 4, cursor: 'pointer', appearance: 'none',
              backgroundImage: `linear-gradient(45deg, transparent 50%, ${T.textDim} 50%), linear-gradient(135deg, ${T.textDim} 50%, transparent 50%)`,
              backgroundPosition: `right 9px top 11px, right 5px top 11px`,
              backgroundSize: '4px 4px, 4px 4px',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <option value="curve">Curve</option>
            <option value="step">Step</option>
            <option value="area">Area</option>
          </select>
        </label>
      </div>

      <KpiStrip
        scope={scope}
        completed={completed}
        planned={planned}
        velocity={velocity}
        atRisk={atRisk}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, marginBottom: 12,
        height: 340, minHeight: 340,
      }}>
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
          padding: 14, display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: T.textMute }}>
              <Legend color={T.iris} dashed label="Planned" />
              <Legend color={T.green} label="Actual" />
              <Legend color={T.today} vertical label={`Today · ${today.slice(5)}`} />
            </div>
            <div style={{ fontSize: 10, color: T.textDim }}>
              {burnup.minDate && burnup.maxDate && `${burnup.minDate.slice(5)} → ${burnup.maxDate.slice(5)}`}
            </div>
          </div>
          <BurnupChart data={burnup.data} annotations={burnup.annotations} style={chartStyle} today={today} />
        </div>
        <ActivityRail items={activity} loading={activityLoading} />
      </div>

      <TaskTable
        tasks={tasksWithOverlap}
        onUpdateProgress={handleProgressChange}
        onToggleShowLabel={handleToggleShowLabel}
        onSelectTask={onSelectTask}
        hideDone={hideDone}
        onToggleHideDone={() => setHideDone(v => !v)}
      />
    </div>
  );
}

function Legend({ color, dashed, vertical, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: vertical ? 2 : 12,
        height: vertical ? 10 : 2,
        background: color,
        borderRadius: 1,
        backgroundImage: dashed
          ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)`
          : undefined,
      }} />
      {label}
    </span>
  );
}
