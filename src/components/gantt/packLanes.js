// Pack bars into lanes: each bar gets the lowest lane index where it
// doesn't overlap any other bar already placed on that lane.
// Bars carry `start` and `end` indices (day integers). Returns
// { lanes: number[] (same length as bars), laneCount }.

export function packLanes(bars) {
  const sorted = bars.map((b, i) => ({ ...b, _i: i })).sort((a, b) => a.start - b.start);
  const laneEnds = [];
  const out = bars.map(() => 0);
  for (const b of sorted) {
    let lane = laneEnds.findIndex(end => end <= b.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = b.end;
    out[b._i] = lane;
  }
  return { lanes: out, laneCount: laneEnds.length };
}
