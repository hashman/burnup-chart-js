// Pure helpers for computing Burnup chart and KPI values.
// Shared between KpiStrip, BurnupChart, and the task table.

export function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export function getDateRange(start, end) {
  if (!start || !end) return [];
  const out = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

// Total "scope" = sum of points across all tasks.
export function computeScope(tasks) {
  return tasks.reduce((s, t) => s + (parseInt(t.points, 10) || 0), 0);
}

// Weighted progress ratio for a task:
//   actualEnd set  -> 1 (fully done)
//   actualStart set but no actualEnd -> partial (todo-based if available, else task.progress)
//   neither        -> 0
export function taskProgressRatio(task, todoProgressByTask) {
  if (task.actualEnd) return 1;
  if (!task.actualStart) return 0;
  const tp = todoProgressByTask?.[task.id];
  if (tp && tp.total > 0) return tp.done / tp.total;
  const p = Math.max(0, Math.min(100, task.progress ?? 0));
  return p / 100;
}

// "Completed" = sum of points weighted by current progress ratio.
export function computeCompleted(tasks, todoProgressByTask) {
  return tasks.reduce((s, t) => {
    const pts = parseInt(t.points, 10) || 0;
    return s + pts * taskProgressRatio(t, todoProgressByTask);
  }, 0);
}

// "Planned today" = sum of points whose expectedEnd has passed.
export function computePlannedToday(tasks, today) {
  return tasks.reduce((s, t) => {
    const pts = parseInt(t.points, 10) || 0;
    return t.expectedEnd && t.expectedEnd <= today ? s + pts : s;
  }, 0);
}

// Velocity = avg completed points/day over last N days.
// Only counts tasks whose actualEnd falls in that window.
export function computeVelocity(tasks, today, days = 7) {
  const start = addDays(today, -days + 1);
  let total = 0;
  tasks.forEach(t => {
    if (t.actualEnd && t.actualEnd >= start && t.actualEnd <= today) {
      total += parseInt(t.points, 10) || 0;
    }
  });
  return total / days;
}

// At-risk = count of tasks flagged as warning/danger by assignee overlap.
export function computeAtRisk(tasks) {
  return tasks.reduce((n, t) => (t._overlap >= 2 ? n + 1 : n), 0);
}

// Annotate tasks with an _overlap field = max concurrent same-assignee
// tasks. Expected and actual windows are evaluated independently so a
// planning-time collision still raises a warning even if the actual
// execution didn't end up overlapping (and vice versa).
export function annotateOverlap(tasks) {
  const normPerson = (s) => (s || '').trim().toLowerCase();
  const expectedRange = (t) => t.expectedStart
    ? { start: t.expectedStart, end: t.expectedEnd || t.expectedStart }
    : null;
  const actualRange = (t) => t.actualStart
    ? { start: t.actualStart, end: t.actualEnd || t.actualStart }
    : null;

  const countOn = (date, person, pickRange) => {
    let n = 0;
    for (const o of tasks) {
      if (normPerson(o.people) !== person) continue;
      const or = pickRange(o);
      if (!or) continue;
      if (or.start <= date && or.end >= date) n += 1;
    }
    return n;
  };

  return tasks.map(t => {
    if (!t.people) return { ...t, _overlap: 1 };
    const person = normPerson(t.people);
    let maxOverlap = 1;

    const er = expectedRange(t);
    if (er) {
      for (let d = er.start; d <= er.end; d = addDays(d, 1)) {
        const n = countOn(d, person, expectedRange);
        if (n > maxOverlap) maxOverlap = n;
      }
    }

    const ar = actualRange(t);
    if (ar) {
      for (let d = ar.start; d <= ar.end; d = addDays(d, 1)) {
        const n = countOn(d, person, actualRange);
        if (n > maxOverlap) maxOverlap = n;
      }
    }

    return { ...t, _overlap: maxOverlap };
  });
}

// Build the burnup series in percent units with today marker.
// Returns { data: [{d, exp, act, today?}], minDate, maxDate }.
export function computeBurnupSeries(tasks, todoProgressByTask, today) {
  if (tasks.length === 0) return { data: [], minDate: '', maxDate: '' };

  let minDate = '9999-12-31';
  let maxDate = '0000-01-01';
  tasks.forEach(t => {
    [t.expectedStart, t.actualStart, t.addedDate].forEach(d => { if (d && d < minDate) minDate = d; });
    [t.expectedEnd, t.actualEnd].forEach(d => { if (d && d > maxDate) maxDate = d; });
  });
  if (minDate === '9999-12-31' || maxDate === '0000-01-01') {
    return { data: [], minDate: '', maxDate: '' };
  }

  const timeline = getDateRange(minDate, maxDate);
  const scope = computeScope(tasks) || 1;

  const data = timeline.map(d => {
    let expectedCompleted = 0;
    let actualCompleted = 0;
    tasks.forEach(t => {
      const pts = parseInt(t.points, 10) || 0;
      if (t.expectedEnd && t.expectedEnd <= d) expectedCompleted += pts;
      if (t.actualEnd && t.actualEnd <= d) {
        actualCompleted += pts;
      } else if (t.actualStart && t.actualStart <= d) {
        const ratio = taskProgressRatio(t, todoProgressByTask);
        actualCompleted += pts * ratio;
      }
    });
    const point = {
      d,
      exp: +((expectedCompleted / scope) * 100).toFixed(1),
      act: d <= today ? +((actualCompleted / scope) * 100).toFixed(1) : null,
    };
    if (d === today) point.today = true;
    return point;
  });

  // Annotations: for every task flagged with showLabel, find the target
  // date (actualEnd > expectedEnd > actualStart > expectedStart > addedDate)
  // and attach to the corresponding line at that x.
  const annotations = [];
  tasks.forEach(t => {
    if (!t.showLabel) return;
    const targetDate = t.actualEnd || t.expectedEnd || t.actualStart || t.expectedStart || t.addedDate;
    if (!targetDate) return;
    const pt = data.find(d => d.d === targetDate) || data.find(d => d.d > targetDate) || data[data.length - 1];
    if (!pt) return;
    const isActual = !!t.actualEnd;
    const yVal = isActual ? pt.act : pt.exp;
    if (yVal == null) return;
    annotations.push({
      id: t.id,
      name: t.name,
      points: t.points,
      date: pt.d,
      value: yVal,
      isActual,
    });
  });

  return { data, minDate, maxDate, annotations };
}
