import React, { useState } from 'react';
import { T, FONT } from '../../design/tokens.js';
import { Btn } from '../../design/primitives.jsx';

// Composer for posting sub-project events. Three types map directly to
// the backend's sub_project_events.type column: note / waiting / decision.

const TYPES = [
  { value: 'note', label: 'Note' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'decision', label: 'Decision' },
];

export function ActivityComposer({ onPost, disabled }) {
  const [type, setType] = useState('note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [waitingOn, setWaitingOn] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim() && !submitting;

  const reset = () => {
    setTitle('');
    setBody('');
    setWaitingOn('');
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      type, title: title.trim(),
      body: body.trim() || null,
      waitingOn: type === 'waiting' ? (waitingOn.trim() || null) : null,
    };
    const ok = await onPost?.(payload);
    setSubmitting(false);
    if (ok) reset();
  };

  return (
    <div style={{
      marginTop: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
      border: `1px solid ${T.border}`, borderRadius: 6, background: T.surface,
    }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            disabled={disabled || submitting}
            style={{
              padding: '3px 8px', fontSize: 11, fontFamily: FONT, cursor: 'pointer',
              background: type === t.value ? T.surface2 : 'transparent',
              color: type === t.value ? T.text : T.textMute,
              border: `1px solid ${type === t.value ? T.border : 'transparent'}`,
              borderRadius: 3, fontWeight: type === t.value ? 500 : 400,
            }}
          >{t.label}</button>
        ))}
        <span style={{ fontSize: 10, color: T.textDim, marginLeft: 'auto' }}>
          {type === 'waiting' && 'Who are we blocked on?'}
          {type === 'decision' && 'Record a decision, rationale optional'}
          {type === 'note' && 'General update or log entry'}
        </span>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={type === 'waiting' ? 'What are you waiting for?' : type === 'decision' ? 'The decision' : 'Title'}
        disabled={disabled || submitting}
        style={input}
      />
      {type === 'waiting' && (
        <input
          type="text"
          value={waitingOn}
          onChange={(e) => setWaitingOn(e.target.value)}
          placeholder="Waiting on… (e.g. @devops, Alice)"
          disabled={disabled || submitting}
          style={input}
        />
      )}
      <textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Details (optional)…"
        disabled={disabled || submitting}
        style={{ ...input, resize: 'vertical', minHeight: 40, fontFamily: FONT }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn variant="iris" icon="send" onClick={submit} disabled={!canSubmit}>
          {submitting ? 'Posting…' : 'Post'}
        </Btn>
      </div>
    </div>
  );
}

const input = {
  padding: '6px 8px', fontSize: 12, fontFamily: FONT, color: T.text,
  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};
