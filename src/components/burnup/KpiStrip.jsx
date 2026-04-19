import React from 'react';
import { T, FONT } from '../../design/tokens.js';

function KPI({ label, value, hint, tone = 'neutral' }) {
  const toneColor = {
    iris: T.iris, green: T.green, warn: T.warn, danger: T.danger, neutral: T.textMute,
  }[tone] || T.textMute;
  return (
    <div style={{
      flex: 1, padding: '10px 14px', background: T.surface,
      border: `1px solid ${T.border}`, borderRadius: 6,
      display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: T.textMute, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 6, background: toneColor, display: 'inline-block' }} />
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, fontFamily: FONT, letterSpacing: -0.5, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: T.textDim }}>{hint}</div>
    </div>
  );
}

export function KpiStrip({ scope, completed, planned, velocity, atRisk, scopeDelta = 0 }) {
  const pctCompleted = scope > 0 ? Math.round((completed / scope) * 100) : 0;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <KPI
        label="Scope"
        value={`${scope} pts`}
        hint={scopeDelta ? `${scopeDelta > 0 ? '+' : ''}${scopeDelta} this week` : 'total points'}
      />
      <KPI
        label="Completed"
        value={`${Math.round(completed)} pts`}
        hint={`${pctCompleted}% of scope`}
        tone="green"
      />
      <KPI
        label="Planned"
        value={`${Math.round(planned)} pts`}
        hint="expected today"
        tone="iris"
      />
      <KPI
        label="Velocity"
        value={`${velocity.toFixed(1)} pt/d`}
        hint="last 7 days"
      />
      <KPI
        label="At risk"
        value={String(atRisk)}
        hint="same-assignee overlap"
        tone={atRisk > 0 ? 'warn' : 'neutral'}
      />
    </div>
  );
}
