// Shared primitives for the "next" UI. Ported from design bundle primitives.jsx.
// Pure inline styles + design tokens; no Tailwind.
// Icons are JSX fragments (not HTML strings) so we avoid dangerouslySetInnerHTML.

import React from 'react';
import { T, FONT, MONO } from './tokens.js';

// Icon — any `d` value is a JSX fragment of SVG children (paths, lines, etc.)
export function I({ d, size = 14, stroke = 1.5, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
      strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
      {d}
    </svg>
  );
}

// Lucide-derived icon library (JSX fragments)
export const ICON = {
  plus: (<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>),
  search: (<><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></>),
  chart: (<><line x1="4" y1="20" x2="4" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="20" y1="20" x2="20" y2="14"/></>),
  trend: (<><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></>),
  gantt: (<><rect x="3" y="6" width="10" height="3" rx="0.5"/><rect x="8" y="11" width="10" height="3" rx="0.5"/><rect x="5" y="16" width="8" height="3" rx="0.5"/></>),
  kanban: (<><rect x="3" y="4" width="5" height="16" rx="0.5"/><rect x="10" y="4" width="5" height="10" rx="0.5"/><rect x="17" y="4" width="4" height="13" rx="0.5"/></>),
  merge: (<><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M8 6c4 0 4 6 8 6"/><path d="M8 18c4 0 4-6 8-6"/></>),
  folder: (<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>),
  people: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13A4 4 0 0 1 16 11"/></>),
  user: (<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>),
  settings: (<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>),
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
  clock: (<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>),
  check: (<polyline points="20 6 9 17 4 12"/>),
  x: (<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
  chevR: (<polyline points="9 6 15 12 9 18"/>),
  chevD: (<polyline points="6 9 12 15 18 9"/>),
  more: (<><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>),
  filter: (<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>),
  maximize: (<><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>),
  alert: (<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  cmd: (<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>),
  link: (<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>),
  msg: (<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>),
  trash: (<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>),
  pencil: (<><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></>),
  eye: (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>),
  upload: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>),
  download: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>),
  grip: (<><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></>),
  lock: (<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>),
  arrow: (<><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>),
  inbox: (<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>),
  keyboard: (<><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/></>),
  bell: (<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>),
  send: (<><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>),
  flip: (<><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>),
};

export function hashColor(s) {
  const colors = ['#5B5BD6','#2DA44E','#D97706','#7C3AED','#DC2626','#0891B2','#DB2777'];
  let h = 0; for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

export function Avatar({ name, size = 20 }) {
  if (!name) return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: size,
      background: hashColor(name), color:'#fff',
      fontSize: size*0.45, fontWeight: 600,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      letterSpacing: 0, lineHeight: 1, flexShrink: 0,
    }}>{name[0].toUpperCase()}</div>
  );
}

export function Badge({ children, tone = 'neutral', size = 'md', style }) {
  const tones = {
    neutral: { bg: T.surface2, fg: T.textMute, bd: T.border },
    iris:    { bg: T.irisSoft, fg: T.iris, bd: '#D7DAFF' },
    green:   { bg: T.greenSoft, fg: T.green, bd: '#C6E5CC' },
    warn:    { bg: T.warnSoft, fg: T.warn, bd: '#FDE68A' },
    danger:  { bg: T.dangerSoft, fg: T.danger, bd: '#FECACA' },
    violet:  { bg: T.violetSoft, fg: T.violet, bd: '#E0D4FB' },
    solid:   { bg: T.text, fg: '#fff', bd: T.text },
  };
  const t = tones[tone] || tones.neutral;
  const pad = size === 'sm' ? '1px 5px' : '2px 7px';
  const fs = size === 'sm' ? 10 : 11;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding: pad, fontSize: fs, fontWeight: 500,
      color: t.fg, background: t.bg, border: `1px solid ${t.bd}`,
      borderRadius: 4, lineHeight: 1.4, whiteSpace:'nowrap',
      ...style,
    }}>{children}</span>
  );
}

export function Dot({ color = T.iris, size = 6 }) {
  return <span style={{ width:size, height:size, borderRadius:size, background:color, display:'inline-block', flexShrink:0 }} />;
}

export function Btn({ children, variant = 'ghost', size = 'sm', icon, style, ...rest }) {
  const h = size === 'sm' ? 24 : size === 'md' ? 28 : 32;
  const variants = {
    ghost:   { bg:'transparent', fg: T.textMute, bd:'transparent' },
    subtle:  { bg: T.surface2,   fg: T.text,     bd: T.border },
    primary: { bg: T.text,       fg:'#fff',      bd: T.text },
    iris:    { bg: T.iris,       fg:'#fff',      bd: T.iris },
    danger:  { bg:'transparent', fg: T.danger,   bd:'transparent' },
  };
  const v = variants[variant] || variants.ghost;
  return (
    <button {...rest} style={{
      height: h, padding: `0 ${size==='sm'?8:10}px`,
      background: v.bg, color: v.fg, border:`1px solid ${v.bd}`,
      borderRadius: 4, fontSize: 12, fontWeight: 500,
      display:'inline-flex', alignItems:'center', gap:6,
      cursor:'pointer', fontFamily: FONT, whiteSpace:'nowrap',
      ...style,
    }}>
      {icon && <I d={ICON[icon]} size={13} />}
      {children}
    </button>
  );
}

export function Kbd({ children }) {
  return <span style={{
    padding:'1px 5px', fontSize:10, fontFamily: MONO,
    color: T.textMute, background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 3, minWidth: 16, textAlign:'center', lineHeight: 1.4,
  }}>{children}</span>;
}

export function ActivityGlyph({ kind }) {
  const map = {
    log:      { icon: ICON.pencil,  color: T.textMute },
    comment:  { icon: ICON.msg,     color: T.iris },
    waiting:  { icon: ICON.clock,   color: T.warn },
    decision: { icon: ICON.alert,   color: T.violet },
    note:     { icon: ICON.pencil,  color: T.textMute },
    done:     { icon: ICON.check,   color: T.green },
  };
  const m = map[kind] || map.log;
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 4,
      background: T.surface2, color: m.color,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      border: `1px solid ${T.border}`, flexShrink: 0,
    }}>
      <I d={m.icon} size={11} />
    </div>
  );
}
