import React, { useRef, useState } from 'react';
import { T, MONO } from '../../design/tokens.js';

// Drag to set + click-to-type percentage cell.
// Ports design bundle's ProgressCell verbatim behaviour, with an onCommit
// callback that persists the value to the backend.

export function ProgressCell({ value, onCommit, done, disabled }) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState(String(value ?? 0));
  const [drafting, setDrafting] = useState(false);
  const [dragValue, setDragValue] = useState(value ?? 0);
  const barRef = useRef(null);

  // Sync the local typed draft when the committed value changes via
  // render-time state update (instead of useEffect+setState).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setTyped(String(value ?? 0));
  }

  const commitFromMouse = (e) => {
    const el = barRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = Math.round(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)) / 5) * 5;
    setDragValue(pct);
  };

  const onDown = (e) => {
    if (done || disabled) return;
    setDrafting(true);
    commitFromMouse(e);
    const move = (ev) => commitFromMouse(ev);
    const up = (ev) => {
      commitFromMouse(ev);
      setDrafting(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      // Commit on release using the latest drag value.
      const el = barRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const pct = Math.round(Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100)) / 5) * 5;
        if (pct !== value) onCommit?.(pct);
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const displayValue = drafting ? dragValue : (value ?? 0);

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          autoFocus
          type="number"
          min={0}
          max={100}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          onBlur={() => {
            const n = Math.max(0, Math.min(100, parseInt(typed || '0', 10) || 0));
            if (n !== value) onCommit?.(n);
            setEditing(false);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { setTyped(String(value ?? 0)); setEditing(false); }
          }}
          style={{
            width: 50, padding: '2px 5px', fontFamily: MONO, fontSize: 11,
            border: `1px solid ${T.iris}`, borderRadius: 4, outline: 'none',
            boxShadow: `0 0 0 2px ${T.irisSoft}`,
          }}
        />
        <span style={{ fontFamily: MONO, fontSize: 10, color: T.textMute }}>%</span>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => !drafting && setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        cursor: (done || disabled) ? 'not-allowed' : 'pointer',
      }}
      title={done ? 'Task completed — locked at 100%' : 'Drag to set · click number to type'}
    >
      <div
        ref={barRef}
        onMouseDown={onDown}
        style={{
          position: 'relative', flex: 1,
          height: hover && !done && !disabled ? 8 : 4,
          background: T.surface2, borderRadius: 4, overflow: 'hidden',
          transition: 'height 100ms ease',
          border: hover && !done && !disabled ? `1px solid ${T.borderStrong}` : '1px solid transparent',
        }}
      >
        <div style={{
          width: `${displayValue}%`, height: '100%',
          background: done ? T.green : displayValue > 0 ? T.iris : 'transparent',
          transition: drafting ? 'none' : 'width 120ms ease',
        }} />
        {hover && !done && !disabled && (
          <div style={{
            position: 'absolute', top: '50%', left: `${displayValue}%`,
            transform: 'translate(-50%, -50%)', width: 10, height: 10,
            borderRadius: 10, background: '#fff', border: `2px solid ${T.iris}`,
            pointerEvents: 'none',
          }} />
        )}
      </div>
      <span
        onClick={(e) => { if (!done && !disabled) { e.stopPropagation(); setEditing(true); } }}
        style={{
          fontFamily: MONO, fontSize: 10,
          color: hover && !done && !disabled ? T.iris : T.textMute,
          minWidth: 28, textAlign: 'right',
          textDecoration: hover && !done && !disabled ? 'underline dotted' : 'none',
          textUnderlineOffset: 2,
        }}
      >{displayValue}%</span>
    </div>
  );
}
