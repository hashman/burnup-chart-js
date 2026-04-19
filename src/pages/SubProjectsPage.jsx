import React, { useEffect, useMemo, useState } from 'react';
import { T, MONO, FONT } from '../design/tokens.js';
import { Btn, Badge, ActivityGlyph } from '../design/primitives.jsx';
import { SubProjectCard } from '../components/subs/SubProjectCard.jsx';
import { ActivityComposer } from '../components/subs/ActivityComposer.jsx';
import { SubProjectFormModal } from '../components/subs/SubProjectFormModal.jsx';
import { formatRelative } from '../design/formatTime.js';

function EventItem({ event, onResolve, onDelete }) {
  const { type, title, body, waitingOn, startedAt, resolvedAt } = event;
  const tone = type === 'waiting' ? 'warn' : type === 'decision' ? 'violet' : 'neutral';
  const isResolvedWaiting = type === 'waiting' && resolvedAt;
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: `1px solid ${T.divider}` }}>
      <ActivityGlyph kind={type === 'note' ? 'log' : type} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <Badge tone={tone} size="sm">{type}</Badge>
          <span style={{ fontWeight: 500 }}>{title}</span>
          {isResolvedWaiting && <Badge tone="green" size="sm">resolved</Badge>}
          <span style={{ fontSize: 10, color: T.textDim, marginLeft: 'auto' }}>{formatRelative(startedAt)}</span>
        </div>
        {body && (
          <div style={{ color: T.textMute, lineHeight: 1.5, wordBreak: 'break-word' }}>
            {body}
          </div>
        )}
        {waitingOn && (
          <div style={{ fontSize: 11, color: T.warn, marginTop: 3 }}>↪ {waitingOn}</div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {type === 'waiting' && !resolvedAt && (
            <button onClick={() => onResolve?.(event.id)} style={miniBtn(T.green)}>Resolve</button>
          )}
          <button onClick={() => onDelete?.(event.id)} style={miniBtn(T.danger)}>Delete</button>
        </div>
      </div>
    </div>
  );
}

const miniBtn = (color) => ({
  fontSize: 10, padding: '2px 6px', cursor: 'pointer',
  background: 'transparent', border: `1px solid ${T.border}`,
  borderRadius: 3, color, fontFamily: FONT,
});

export function SubProjectsPage({ data }) {
  const {
    subProjects, activeProjectId, allTasks,
    createSubProject, updateSubProject, deleteSubProject,
    fetchSubProjectEvents, createSubProjectEvent, updateSubProjectEvent, deleteSubProjectEvent,
  } = data;

  const projectSubs = useMemo(
    () => subProjects.filter(s => s.burnupProjectId === activeProjectId),
    [subProjects, activeProjectId]
  );

  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null); // null | {} for new | sub-project obj for edit
  const [events, setEvents] = useState([]);
  const [eventFilter, setEventFilter] = useState('all');
  const [eventsLoading, setEventsLoading] = useState(false);

  const selected = useMemo(
    () => projectSubs.find(s => s.id === selectedId) || projectSubs[0] || null,
    [projectSubs, selectedId]
  );

  const refreshEvents = async (spId) => {
    if (!spId) { setEvents([]); return; }
    setEventsLoading(true);
    const list = await fetchSubProjectEvents(spId);
    setEvents(Array.isArray(list) ? list : []);
    setEventsLoading(false);
  };

  useEffect(() => { refreshEvents(selected?.id); }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const waitingCount = projectSubs.reduce((n, s) => n + (s.activeWaitingCount || 0), 0);

  const handleSave = async (payload) => {
    if (payload.id) {
      const { id, ...patch } = payload;
      await updateSubProject(id, patch);
    } else {
      await createSubProject(activeProjectId, payload);
    }
    setEditing(null);
  };

  const handleDelete = async (sp) => {
    if (!confirm(`Delete sub-project "${sp.name}"?`)) return;
    await deleteSubProject(sp.id);
    if (selectedId === sp.id) setSelectedId(null);
  };

  const handlePost = async (payload) => {
    if (!selected) return false;
    const created = await createSubProjectEvent(selected.id, payload);
    if (created) {
      await refreshEvents(selected.id);
      // refresh waiting count in card
      await updateSubProject(selected.id, {}); // noop patch just to refresh? skip.
      return true;
    }
    return false;
  };

  const handleResolve = async (eventId) => {
    await updateSubProjectEvent(eventId, { resolvedAt: new Date().toISOString() });
    await refreshEvents(selected?.id);
  };

  const handleDeleteEvent = async (eventId) => {
    await deleteSubProjectEvent(eventId);
    await refreshEvents(selected?.id);
  };

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'all') return events;
    return events.filter(e => e.type === eventFilter);
  }, [events, eventFilter]);

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto', background: T.bg }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, margin: 0 }}>Sub-projects</h1>
          <div style={{ fontSize: 12, color: T.textMute, marginTop: 2 }}>
            {projectSubs.length} tracked
            {waitingCount > 0 && <> · <span style={{ color: T.warn, fontWeight: 500 }}>{waitingCount} waiting open</span></>}
          </div>
        </div>
        <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>New sub-project</Btn>
      </div>

      {projectSubs.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center',
          background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 6,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No sub-projects yet</div>
          <div style={{ fontSize: 12, color: T.textMute, marginBottom: 12 }}>
            Group related tasks and track waiting / decisions separately from the main burnup.
          </div>
          <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Create the first one</Btn>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, marginBottom: 14 }}>
            {projectSubs.map(sp => (
              <SubProjectCard
                key={sp.id}
                sp={sp}
                selected={selected?.id === sp.id}
                onClick={() => setSelectedId(sp.id)}
                onEdit={(x) => setEditing(x)}
                onDelete={(x) => handleDelete(x)}
              />
            ))}
          </div>

          {selected && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6 }}>
              <div style={{
                padding: '10px 14px', borderBottom: `1px solid ${T.divider}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    Activity · {selected.name}
                  </div>
                  <span style={{ fontSize: 10, color: T.textDim, fontFamily: MONO }}>
                    {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['all', 'waiting', 'decision', 'note'].map(f => (
                    <Btn
                      key={f}
                      variant={eventFilter === f ? 'subtle' : 'ghost'}
                      onClick={() => setEventFilter(f)}
                    >
                      {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
                    </Btn>
                  ))}
                </div>
              </div>
              <div style={{ padding: '4px 14px 12px' }}>
                {eventsLoading ? (
                  <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: T.textDim }}>Loading…</div>
                ) : filteredEvents.length === 0 ? (
                  <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: T.textDim }}>
                    No events yet
                  </div>
                ) : (
                  filteredEvents.map(e => (
                    <EventItem
                      key={e.id}
                      event={e}
                      onResolve={handleResolve}
                      onDelete={handleDeleteEvent}
                    />
                  ))
                )}
                <ActivityComposer onPost={handlePost} disabled={!selected} />
              </div>
            </div>
          )}
        </>
      )}

      {editing && (
        <SubProjectFormModal
          subProject={editing?.id ? editing : null}
          allTasks={allTasks}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
