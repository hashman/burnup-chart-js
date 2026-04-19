import React from 'react';
import { T } from '../design/tokens.js';
import { I, ICON, Btn } from '../design/primitives.jsx';

// Empty-state card shown when a project has no tasks.

export function EmptyProject({ projectName, onCreateTask, onImportCsv }) {
  return (
    <div style={{
      padding: 40, height: '100%', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 10, background: T.surface2,
          border: `1px solid ${T.border}`, margin: '0 auto 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.textDim,
        }}>
          <I d={ICON.folder} size={24} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
          {projectName ? `${projectName} is empty` : 'Start a new project'}
        </div>
        <div style={{ fontSize: 12, color: T.textMute, marginBottom: 18, lineHeight: 1.5 }}>
          Projects group tasks into a burnup. Create tasks one by one and let the system auto-plan end dates around Taiwan holidays, or import a CSV.
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {onCreateTask && (
            <Btn variant="primary" icon="plus" onClick={onCreateTask}>Add first task</Btn>
          )}
          {onImportCsv && (
            <Btn variant="subtle" icon="upload" onClick={onImportCsv}>Import CSV</Btn>
          )}
        </div>
      </div>
    </div>
  );
}
