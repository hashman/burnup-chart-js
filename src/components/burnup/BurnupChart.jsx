import React, { useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { T, MONO, FONT, weekCode } from '../../design/tokens.js';

// SVG burnup chart — curve | step | area styles.
// Adapts the design bundle's BurnupChart to real data shape.

export function BurnupChart({ data, annotations = [], style = 'curve', height = 260, today }) {
  const h = height;
  const padL = 32, padR = 12, padT = 10, padB = 22;

  const wrapRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(-1);
  // The SVG viewBox width tracks the wrapper's actual pixel width so that
  // 1 viewBox unit == 1 rendered pixel. Without this the default
  // `preserveAspectRatio="xMidYMid meet"` letterboxes the chart inside
  // the container and breaks mouse→data-point coordinate mapping.
  const [w, setW] = useState(640);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const sync = () => setW(Math.max(320, Math.floor(el.clientWidth || 640)));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const xs = useMemo(
    () => data && data.length > 0
      ? data.map((_, i) => padL + (i / Math.max(1, data.length - 1)) * innerW)
      : [],
    [data, padL, innerW],
  );

  const onMouseMove = useCallback((e) => {
    const el = wrapRef.current;
    if (!el || xs.length === 0) return;
    const rect = el.getBoundingClientRect();
    // Map mouse X (pixels) back to viewBox coords.
    const vx = ((e.clientX - rect.left) / rect.width) * w;
    // Find nearest data index.
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const d = Math.abs(xs[i] - vx);
      if (d < bestDist) { best = i; bestDist = d; }
    }
    setHoverIdx(best);
  }, [xs]);

  const onMouseLeave = useCallback(() => setHoverIdx(-1), []);

  if (!data || data.length === 0) {
    return (
      <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textDim, fontSize: 12 }}>
        No data yet — add a task with dates to see the chart.
      </div>
    );
  }

  const y = v => padT + innerH - (v / 100) * innerH;

  const build = (key, stepped) => {
    const pts = data.map((d, i) => d[key] != null ? [xs[i], y(d[key])] : null).filter(Boolean);
    if (!pts.length) return '';
    if (stepped) {
      let p = `M${pts[0][0]},${pts[0][1]}`;
      for (let i = 1; i < pts.length; i++) {
        p += ` L${pts[i][0]},${pts[i - 1][1]} L${pts[i][0]},${pts[i][1]}`;
      }
      return p;
    }
    let p = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      p += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return p;
  };

  const stepped = style === 'step';
  const area = style === 'area';
  const expPath = build('exp', stepped);
  const actPath = build('act', stepped);

  let actAreaPath = '';
  if (area && actPath) {
    const lastIdx = (() => {
      for (let i = data.length - 1; i >= 0; i--) if (data[i].act != null) return i;
      return -1;
    })();
    if (lastIdx >= 0) {
      actAreaPath = actPath + ` L${xs[lastIdx]},${y(0)} L${xs[0]},${y(0)} Z`;
    }
  }

  const todayIdx = today ? data.findIndex(d => d.d === today) : -1;
  const todayX = todayIdx >= 0 ? xs[todayIdx] : null;

  const labelEvery = Math.max(1, Math.floor(data.length / 8));
  const hoverX = hoverIdx >= 0 ? xs[hoverIdx] : null;
  const hoverPoint = hoverIdx >= 0 ? data[hoverIdx] : null;

  // Tooltip positioning: in container % (clamped so it doesn't escape right edge).
  const tooltipLeftPct = hoverX != null ? Math.max(2, Math.min(100, (hoverX / w) * 100)) : 0;
  const flipRight = tooltipLeftPct > 65;

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ position: 'relative', width: '100%', height: h, cursor: 'crosshair' }}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {/* gridlines */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke={T.divider} strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 3} fontSize="9" fill={T.textDim} fontFamily={MONO} textAnchor="end">{v}</text>
          </g>
        ))}
        {/* x labels */}
        {data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1) && (
          <text key={i} x={xs[i]} y={h - 6} fontSize="9" fill={T.textDim} fontFamily={MONO} textAnchor="middle">
            {d.d.slice(5)}
          </text>
        ))}

        {/* today line */}
        {todayX != null && (
          <g>
            <line x1={todayX} x2={todayX} y1={padT} y2={h - padB} stroke={T.today} strokeWidth="1" strokeDasharray="3 3" />
            <rect x={todayX - 16} y={padT - 2} width="32" height="12" rx="2" fill={T.today} />
            <text x={todayX} y={padT + 7} fontSize="9" fontWeight="600" fill="#fff" textAnchor="middle">TODAY</text>
          </g>
        )}

        {/* hover indicator */}
        {hoverX != null && (
          <line
            x1={hoverX} x2={hoverX} y1={padT} y2={h - padB}
            stroke={T.textDim} strokeWidth="1" strokeDasharray="2 2"
          />
        )}

        {/* expected (dashed iris) */}
        <path d={expPath} fill="none" stroke={T.iris} strokeWidth="1.5" strokeDasharray="4 3" />

        {/* actual */}
        {area && actAreaPath && <path d={actAreaPath} fill={T.green} fillOpacity="0.08" />}
        <path d={actPath} fill="none" stroke={T.green} strokeWidth="2" />

        {/* actual dots */}
        {data.map((d, i) => d.act != null && (
          <circle
            key={i}
            cx={xs[i]}
            cy={y(d.act)}
            r={i === hoverIdx ? 4 : i === todayIdx ? 3.5 : 2.5}
            fill={T.surface}
            stroke={T.green}
            strokeWidth={i === hoverIdx ? 2 : 1.5}
          />
        ))}

        {/* hovered expected point (highlight) */}
        {hoverIdx >= 0 && hoverPoint?.exp != null && (
          <circle
            cx={xs[hoverIdx]}
            cy={y(hoverPoint.exp)}
            r={3}
            fill={T.surface}
            stroke={T.iris}
            strokeWidth="1.5"
          />
        )}

        {/* task labels (annotations) */}
        {annotations.map((a, i) => {
          const ax = xs[data.findIndex(d => d.d === a.date)];
          if (ax == null) return null;
          const ay = y(a.value);
          const stroke = a.isActual ? T.green : T.iris;
          const label = `${a.name} · ${a.points}pt`;
          // Approximate character width for placement (mono 9px ~ 5px per char).
          const textLen = Math.min(180, Math.max(60, label.length * 5.4));
          // Alternate above/below by index to reduce overlap on dense dates.
          const above = i % 2 === 0;
          const boxH = 14;
          const gap = 12;
          const boxY = above ? Math.max(padT, ay - gap - boxH) : Math.min(h - padB - boxH, ay + gap);
          // Keep box within horizontal chart bounds.
          const boxX = Math.max(padL, Math.min(w - padR - textLen, ax - textLen / 2));
          const stickY1 = above ? ay - 1 : ay + 1;
          const stickY2 = above ? boxY + boxH : boxY;
          return (
            <g key={a.id} style={{ pointerEvents: 'none' }}>
              <line x1={ax} y1={stickY1} x2={ax} y2={stickY2} stroke={T.textDim} strokeWidth="0.5" />
              <rect
                x={boxX} y={boxY} width={textLen} height={boxH} rx="2"
                fill={T.surface} stroke={stroke} strokeWidth="0.8" strokeOpacity="0.6"
              />
              <text
                x={boxX + 4} y={boxY + 10}
                fontSize="9" fontFamily={FONT} fill={T.textMute}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* HTML tooltip floating above SVG */}
      {hoverPoint && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltipLeftPct}%`,
            top: 8,
            transform: flipRight ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
            pointerEvents: 'none',
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: '8px 10px',
            fontFamily: FONT,
            fontSize: 11,
            minWidth: 148,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, gap: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: T.text, fontWeight: 600 }}>
              {hoverPoint.d}
            </span>
            <span style={{ fontSize: 9.5, color: T.textDim, fontFamily: MONO, letterSpacing: 0.3 }}>
              {weekCode(hoverPoint.d)}
            </span>
          </div>
          <Row color={T.iris} label="Planned" value={hoverPoint.exp} dashed />
          <Row color={T.green} label="Actual" value={hoverPoint.act} />
          {hoverPoint.exp != null && hoverPoint.act != null && (
            <div style={{
              marginTop: 5, paddingTop: 5, borderTop: `1px solid ${T.divider}`,
              fontSize: 10, color: T.textDim, display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Δ</span>
              <DeltaValue delta={hoverPoint.act - hoverPoint.exp} />
            </div>
          )}
          {hoverPoint.d === today && (
            <div style={{
              marginTop: 4, fontSize: 10, color: T.today, fontWeight: 600,
              letterSpacing: 0.4, textTransform: 'uppercase',
            }}>· Today</div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ color, label, value, dashed }) {
  const display = value == null ? '—' : `${value.toFixed(1)}%`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.textMute }}>
        <span style={{
          width: 10, height: 2, background: color, borderRadius: 1,
          backgroundImage: dashed ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)` : undefined,
        }} />
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: value == null ? T.textDim : T.text, fontWeight: 500 }}>
        {display}
      </span>
    </div>
  );
}

function DeltaValue({ delta }) {
  const rounded = +delta.toFixed(1);
  const color = Math.abs(rounded) < 0.5 ? T.textMute : rounded > 0 ? T.green : T.warn;
  const sign = rounded > 0 ? '+' : '';
  return (
    <span style={{ fontFamily: MONO, color, fontWeight: 500 }}>
      {sign}{rounded}%
    </span>
  );
}
