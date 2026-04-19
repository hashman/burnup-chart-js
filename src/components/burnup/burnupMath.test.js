import { describe, test, expect } from 'vitest';
import {
  addDays,
  getDateRange,
  computeScope,
  taskProgressRatio,
  computeCompleted,
  computePlannedToday,
  computeVelocity,
  computeAtRisk,
  annotateOverlap,
  computeBurnupSeries,
} from './burnupMath.js';

const task = (overrides = {}) => ({
  id: 't1',
  name: 'T',
  points: 5,
  people: 'Alice',
  expectedStart: '2026-04-01',
  expectedEnd: '2026-04-05',
  actualStart: '',
  actualEnd: '',
  addedDate: '2026-04-01',
  progress: 0,
  ...overrides,
});

describe('addDays / getDateRange', () => {
  test('addDays forward and backward', () => {
    expect(addDays('2026-04-19', 1)).toBe('2026-04-20');
    expect(addDays('2026-04-01', -1)).toBe('2026-03-31');
  });

  test('getDateRange inclusive', () => {
    expect(getDateRange('2026-04-18', '2026-04-20'))
      .toEqual(['2026-04-18', '2026-04-19', '2026-04-20']);
  });

  test('getDateRange returns [] when endpoints missing', () => {
    expect(getDateRange('', '2026-04-20')).toEqual([]);
    expect(getDateRange('2026-04-18', '')).toEqual([]);
  });
});

describe('computeScope', () => {
  test('sums numeric points', () => {
    expect(computeScope([
      task({ points: 3 }), task({ points: 5 }), task({ points: 8 }),
    ])).toBe(16);
  });

  test('handles string / missing points', () => {
    expect(computeScope([
      task({ points: '5' }), task({ points: null }), task({ points: undefined }),
    ])).toBe(5);
  });
});

describe('taskProgressRatio', () => {
  test('completed task → 1', () => {
    expect(taskProgressRatio(task({ actualEnd: '2026-04-05' }))).toBe(1);
  });

  test('not started → 0', () => {
    expect(taskProgressRatio(task())).toBe(0);
  });

  test('in-progress uses progress field', () => {
    expect(taskProgressRatio(task({ actualStart: '2026-04-01', progress: 50 }))).toBe(0.5);
  });

  test('in-progress prefers todo completion ratio when provided', () => {
    const todoMap = { t1: { total: 4, done: 3 } };
    expect(taskProgressRatio(
      task({ actualStart: '2026-04-01', progress: 50 }), todoMap,
    )).toBe(0.75);
  });

  test('out-of-range progress clamps to [0, 100]', () => {
    expect(taskProgressRatio(task({ actualStart: '2026-04-01', progress: -10 }))).toBe(0);
    expect(taskProgressRatio(task({ actualStart: '2026-04-01', progress: 150 }))).toBe(1);
  });
});

describe('computeCompleted', () => {
  test('mixed completed + in-progress', () => {
    const tasks = [
      task({ id: 'a', points: 4, actualEnd: '2026-04-05' }),                              // full
      task({ id: 'b', points: 8, actualStart: '2026-04-01', progress: 50 }),              // 4
      task({ id: 'c', points: 2 }),                                                       // 0
    ];
    expect(computeCompleted(tasks)).toBe(8);
  });
});

describe('computePlannedToday', () => {
  test('sums points whose expectedEnd <= today', () => {
    const tasks = [
      task({ points: 3, expectedEnd: '2026-04-10' }),
      task({ points: 5, expectedEnd: '2026-04-20' }), // future
      task({ points: 2, expectedEnd: '2026-04-19' }), // equal
    ];
    expect(computePlannedToday(tasks, '2026-04-19')).toBe(5);
  });
});

describe('computeVelocity', () => {
  test('avg completed points / day across last 7 days', () => {
    const today = '2026-04-19';
    const tasks = [
      task({ points: 7, actualEnd: '2026-04-15' }), // within 7d window
      task({ points: 2, actualEnd: '2026-04-19' }), // within
      task({ points: 5, actualEnd: '2026-04-10' }), // outside
    ];
    expect(computeVelocity(tasks, today)).toBeCloseTo(9 / 7, 5);
  });
});

describe('annotateOverlap', () => {
  test('no overlap → _overlap = 1', () => {
    const tasks = annotateOverlap([
      task({ id: '1', expectedStart: '2026-04-01', expectedEnd: '2026-04-02' }),
      task({ id: '2', expectedStart: '2026-04-04', expectedEnd: '2026-04-05' }),
    ]);
    expect(tasks.every(t => t._overlap === 1)).toBe(true);
  });

  test('expected-date overlap detected even when actuals differ', () => {
    const tasks = annotateOverlap([
      task({ id: '1', expectedStart: '2026-04-01', expectedEnd: '2026-04-05' }),
      task({ id: '2', expectedStart: '2026-04-03', expectedEnd: '2026-04-07' }),
    ]);
    expect(tasks[0]._overlap).toBe(2);
    expect(tasks[1]._overlap).toBe(2);
  });

  test('actual-date overlap detected independently', () => {
    const tasks = annotateOverlap([
      task({ id: '1', expectedStart: '2026-04-01', expectedEnd: '2026-04-02',
             actualStart: '2026-04-10', actualEnd: '2026-04-15' }),
      task({ id: '2', expectedStart: '2026-04-20', expectedEnd: '2026-04-25',
             actualStart: '2026-04-12', actualEnd: '2026-04-18' }),
    ]);
    expect(tasks[0]._overlap).toBe(2);
    expect(tasks[1]._overlap).toBe(2);
  });

  test('different assignees never overlap', () => {
    const tasks = annotateOverlap([
      task({ id: '1', people: 'Alice', expectedStart: '2026-04-01', expectedEnd: '2026-04-05' }),
      task({ id: '2', people: 'Bob',   expectedStart: '2026-04-01', expectedEnd: '2026-04-05' }),
    ]);
    expect(tasks[0]._overlap).toBe(1);
    expect(tasks[1]._overlap).toBe(1);
  });

  test('triple overlap → _overlap = 3', () => {
    const tasks = annotateOverlap([
      task({ id: '1', expectedStart: '2026-04-01', expectedEnd: '2026-04-10' }),
      task({ id: '2', expectedStart: '2026-04-02', expectedEnd: '2026-04-09' }),
      task({ id: '3', expectedStart: '2026-04-04', expectedEnd: '2026-04-06' }),
    ]);
    expect(tasks[0]._overlap).toBe(3);
  });

  test('unassigned tasks get _overlap = 1', () => {
    const tasks = annotateOverlap([
      task({ id: '1', people: '' }),
      task({ id: '2', people: '' }),
    ]);
    expect(tasks.every(t => t._overlap === 1)).toBe(true);
  });
});

describe('computeAtRisk', () => {
  test('counts tasks with _overlap >= 2', () => {
    const tasks = [
      { _overlap: 1 }, { _overlap: 2 }, { _overlap: 3 }, { _overlap: 1 },
    ];
    expect(computeAtRisk(tasks)).toBe(2);
  });
});

describe('computeBurnupSeries', () => {
  test('returns empty when no tasks', () => {
    expect(computeBurnupSeries([], {}, '2026-04-19')).toEqual({ data: [], minDate: '', maxDate: '' });
  });

  test('basic two-task burnup', () => {
    const tasks = [
      task({ id: 'a', points: 10, expectedStart: '2026-04-01', expectedEnd: '2026-04-03',
             actualStart: '2026-04-01', actualEnd: '2026-04-03' }),
      task({ id: 'b', points: 10, expectedStart: '2026-04-04', expectedEnd: '2026-04-07' }),
    ];
    const result = computeBurnupSeries(tasks, {}, '2026-04-05');
    expect(result.minDate).toBe('2026-04-01');
    expect(result.maxDate).toBe('2026-04-07');
    // On 2026-04-03 (task A done): exp=50, act=50
    const d3 = result.data.find(p => p.d === '2026-04-03');
    expect(d3.exp).toBeCloseTo(50, 1);
    expect(d3.act).toBeCloseTo(50, 1);
    // On 2026-04-05 (today): exp still 50 (b not done), act also 50
    const d5 = result.data.find(p => p.d === '2026-04-05');
    expect(d5.exp).toBeCloseTo(50, 1);
    // On 2026-04-07 (b's expected end): exp should be 100, but act is null (past today)
    const d7 = result.data.find(p => p.d === '2026-04-07');
    expect(d7.exp).toBeCloseTo(100, 1);
    expect(d7.act).toBeNull();
  });

  test('in-progress task contributes partial points to actual', () => {
    const tasks = [
      task({ id: 'a', points: 10, expectedStart: '2026-04-01', expectedEnd: '2026-04-05',
             actualStart: '2026-04-01', progress: 40 }),
    ];
    const result = computeBurnupSeries(tasks, {}, '2026-04-03');
    const d3 = result.data.find(p => p.d === '2026-04-03');
    // progress 40% of 10 points → 4 / 10 = 40%
    expect(d3.act).toBeCloseTo(40, 1);
  });

  test('annotations emitted for showLabel tasks', () => {
    const tasks = [
      task({ id: 'a', points: 3, showLabel: true, expectedEnd: '2026-04-05',
             actualStart: '2026-04-01', actualEnd: '2026-04-05' }),
    ];
    const result = computeBurnupSeries(tasks, {}, '2026-04-06');
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].name).toBe('T');
    expect(result.annotations[0].isActual).toBe(true);
  });
});
