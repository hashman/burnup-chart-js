// App shell — left sidebar + topbar. Ported from new-burnup-design/project/screens/shell.jsx.
// Page-agnostic; receives active page key and a project label.

import React from 'react';
import { T, FONT, MONO } from '../tokens.js';
import { I, ICON, Avatar, Kbd, Dot } from '../primitives.jsx';

export function Shell({ active = 'burnup', project = 'Untitled', children, onNavigate, user, projects = [], activeProjectId, onSelectProject, onOpenSearch }) {
  return (
    <div style={{
      width: '100%', height: '100vh', background: T.bg, color: T.text,
      fontFamily: FONT, fontSize: 13, lineHeight: 1.45,
      display: 'flex', overflow: 'hidden',
      letterSpacing: -0.01,
    }}>
      <Sidebar
        active={active}
        onNavigate={onNavigate}
        user={user}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={onSelectProject}
        onOpenSearch={onOpenSearch}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Topbar project={project} active={active} />
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );
}

export function Sidebar({ active, onNavigate, user, projects, activeProjectId, onSelectProject, onOpenSearch }) {
  const items = [
    { key: 'burnup', label: 'Burnup',       icon: 'trend' },
    { key: 'gantt',  label: 'Gantt',        icon: 'gantt' },
    { key: 'todos',  label: 'Todos',        icon: 'kanban' },
    { key: 'subs',   label: 'Sub-projects', icon: 'merge' },
    { key: 'merged', label: 'Merged',       icon: 'chart' },
    { key: 'timelog', label: 'Time log',    icon: 'clock' },
  ];
  return (
    <aside style={{
      width: 212, flexShrink: 0, background: T.surface,
      borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${T.divider}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 4 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 4, background: T.text,
            color: '#fff', fontSize: 11, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>B</div>
          <div style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>Burnup</div>
          <I d={ICON.chevD} size={12} style={{ color: T.textDim }} />
        </div>
        <button
          onClick={onOpenSearch}
          style={{
            marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 8px', background: T.surface2, border: `1px solid ${T.border}`,
            borderRadius: 4, color: T.textDim, fontSize: 12, width: '100%',
            fontFamily: FONT, cursor: 'pointer',
          }}
        >
          <I d={ICON.search} size={12} />
          <span>Search…</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            <Kbd>⌘</Kbd><Kbd>K</Kbd>
          </span>
        </button>
      </div>

      <nav style={{ padding: 8, overflow: 'auto', flex: 1, minHeight: 0 }}>
        <SideGroup title="Workflow">
          {items.map(it => (
            <SideItem
              key={it.key}
              active={active === it.key}
              icon={it.icon}
              label={it.label}
              onClick={() => onNavigate?.(it.key)}
            />
          ))}
        </SideGroup>

        <SideGroup title="Projects">
          {projects.length === 0 && (
            <div style={{ fontSize: 11, color: T.textDim, padding: '4px 8px' }}>—</div>
          )}
          {projects.map(p => (
            <SideProject
              key={p.id}
              name={p.name}
              count={p.count}
              active={p.id === activeProjectId}
              onClick={() => onSelectProject?.(p.id)}
            />
          ))}
        </SideGroup>
      </nav>

      <div style={{
        marginTop: 'auto', padding: '10px 12px', borderTop: `1px solid ${T.divider}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Avatar name={user?.displayName || user?.username || 'User'} size={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.displayName || user?.username || 'Guest'}
          </div>
          <div style={{ fontSize: 10, color: T.textDim }}>{user?.role || 'viewer'}</div>
        </div>
        <I d={ICON.settings} size={14} style={{ color: T.textDim }} />
      </div>
    </aside>
  );
}

function SideGroup({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 8px', fontSize: 10, fontWeight: 600,
        color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.6,
      }}>
        <span>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SideItem({ icon, label, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
        background: active ? T.surface2 : 'transparent',
        color: active ? T.text : T.textMute,
        fontSize: 13, fontWeight: active ? 500 : 400,
      }}
    >
      <I d={ICON[icon]} size={13} style={{ color: active ? T.text : T.textDim }} />
      <span>{label}</span>
    </div>
  );
}

function SideProject({ name, count, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
        background: active ? T.surface2 : 'transparent',
        color: active ? T.text : T.textMute,
        fontSize: 13, fontWeight: active ? 500 : 400,
      }}
    >
      <Dot color={active ? T.iris : T.textDim} size={6} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {count != null && <span style={{ fontSize: 11, color: T.textDim, fontFamily: MONO }}>{count}</span>}
    </div>
  );
}

export function Topbar({ project, active }) {
  const labels = {
    burnup: 'Burnup', gantt: 'Gantt', tasks: 'Tasks',
    todos: 'Todos', subs: 'Sub-projects', merged: 'Merged',
    timelog: 'Time log',
  };
  return (
    <header style={{
      height: 44, flexShrink: 0, background: T.surface,
      borderBottom: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textMute }}>
        <I d={ICON.folder} size={12} />
        <span>{project}</span>
        <I d={ICON.chevR} size={11} style={{ color: T.textDim }} />
        <span style={{ color: T.text, fontWeight: 500 }}>{labels[active] || active}</span>
      </div>
    </header>
  );
}
