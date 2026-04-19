import { describe, test, expect } from 'vitest';
import { packLanes } from './packLanes.js';

describe('packLanes', () => {
  test('empty input', () => {
    expect(packLanes([])).toEqual({ lanes: [], laneCount: 0 });
  });

  test('single bar uses lane 0', () => {
    const result = packLanes([{ start: 0, end: 5 }]);
    expect(result).toEqual({ lanes: [0], laneCount: 1 });
  });

  test('non-overlapping bars share lane 0', () => {
    const bars = [
      { start: 0, end: 3 },
      { start: 5, end: 8 },
      { start: 10, end: 12 },
    ];
    expect(packLanes(bars)).toEqual({ lanes: [0, 0, 0], laneCount: 1 });
  });

  test('two overlapping bars split into lanes 0 and 1', () => {
    const bars = [
      { start: 0, end: 5 },
      { start: 3, end: 7 },
    ];
    const result = packLanes(bars);
    expect(result.laneCount).toBe(2);
    expect(result.lanes[0]).toBe(0);
    expect(result.lanes[1]).toBe(1);
  });

  test('three-way overlap uses three lanes', () => {
    const bars = [
      { start: 0, end: 5 },
      { start: 1, end: 6 },
      { start: 2, end: 7 },
    ];
    expect(packLanes(bars).laneCount).toBe(3);
  });

  test('bar reuses freed lane', () => {
    // Bar A occupies 0–5, bar B 1–4, bar C starts at 6 (after A released).
    const bars = [
      { start: 0, end: 5 },  // lane 0
      { start: 1, end: 4 },  // lane 1 (overlap)
      { start: 6, end: 9 },  // lane 0 again
    ];
    const result = packLanes(bars);
    expect(result.laneCount).toBe(2);
    expect(result.lanes[0]).toBe(0);
    expect(result.lanes[1]).toBe(1);
    expect(result.lanes[2]).toBe(0);
  });

  test('preserves original ordering in returned lanes array', () => {
    // Input order: late, early, mid. Returned lanes[i] matches input index i.
    const bars = [
      { start: 10, end: 12 }, // index 0
      { start: 0, end: 3 },   // index 1
      { start: 5, end: 8 },   // index 2
    ];
    const result = packLanes(bars);
    expect(result.lanes).toEqual([0, 0, 0]);
  });

  test('touching intervals may share lane (end <= start)', () => {
    // Our algorithm uses `end <= start` so touching intervals fit the same lane.
    const bars = [
      { start: 0, end: 5 },
      { start: 5, end: 10 },
    ];
    expect(packLanes(bars)).toEqual({ lanes: [0, 0], laneCount: 1 });
  });
});
