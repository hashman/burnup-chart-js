import React, { useEffect, useState } from 'react';
import { T, FONT } from '../../design/tokens.js';
import { I, ICON, Btn, Badge } from '../../design/primitives.jsx';

// Minimal modal for creating / editing a sub-project.

export function SubProjectFormModal({ subProject, allTasks, onSave, onClose }) {
  const isEdit = !!subProject?.id;
  const [form, setForm] = useState(() => ({
    name: subProject?.name || '',
    description: subProject?.description || '',
    status: subProject?.status || 'active',
    priority: subProject?.priority || 'medium',
    owner: subProject?.owner || '',
    dueDate: subProject?.dueDate || '',
    tags: subProject?.tags || [],
    tagInput: '',
    linkedTaskIds: subProject?.linkedTaskIds || [],
  }));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (p) => setForm(prev => ({ ...prev, ...p }));
  const addTag = () => {
    const v = form.tagInput.trim();
    if (!v) return;
    if (!form.tags.includes(v)) update({ tags: [...form.tags, v], tagInput: '' });
    else update({ tagInput: '' });
  };
  const removeTag = (t) => update({ tags: form.tags.filter(x => x !== t) });
  const toggleTask = (id) => update({
    linkedTaskIds: form.linkedTaskIds.includes(id)
      ? form.linkedTaskIds.filter(x => x !== id)
      : [...form.linkedTaskIds, id],
  });

  const submit = (e) => {
    e?.preventDefault();
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      owner: form.owner.trim() || null,
      dueDate: form.dueDate || null,
      tags: form.tags,
      linkedTaskIds: form.linkedTaskIds,
    };
    if (isEdit) payload.id = subProject.id;
    onSave?.(payload);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: `1px solid ${T.divider}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {isEdit ? 'Edit sub-project' : 'New sub-project'}
            </div>
            {isEdit && <Badge tone="neutral" size="sm">{subProject.id.slice(-6)}</Badge>}
          </div>
          <button style={iconBtn} onClick={onClose}><I d={ICON.x} size={14} /></button>
        </header>
        <form onSubmit={submit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', flex: 1, minHeight: 0 }}>
          <Field label="Name" required>
            <input type="text" autoFocus value={form.name} onChange={(e) => update({ name: e.target.value })} style={{ ...input, fontSize: 14, fontWeight: 500 }} />
          </Field>
          <Field label="Description">
            <textarea rows={2} value={form.description} onChange={(e) => update({ description: e.target.value })} style={{ ...input, resize: 'vertical', minHeight: 44, fontFamily: FONT }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Status">
              <select value={form.status} onChange={(e) => update({ status: e.target.value })} style={select}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={(e) => update({ priority: e.target.value })} style={select}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Owner">
              <input type="text" value={form.owner} onChange={(e) => update({ owner: e.target.value })} style={input} />
            </Field>
            <Field label="Due date">
              <input type="date" value={form.dueDate} onChange={(e) => update({ dueDate: e.target.value })} style={input} />
            </Field>
          </div>
          <Field label="Tags">
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 5, padding: 6,
              border: `1px solid ${T.border}`, borderRadius: 4, background: T.surface, minHeight: 32, alignItems: 'center',
            }}>
              {form.tags.map(t => (
                <span key={t} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 6px', background: T.irisSoft, color: T.iris,
                  fontSize: 11, borderRadius: 3, border: '1px solid #D7DAFF',
                }}>
                  #{t}
                  <button type="button" onClick={() => removeTag(t)} style={{ ...iconBtn, width: 14, height: 14, color: T.iris }}>
                    <I d={ICON.x} size={9} />
                  </button>
                </span>
              ))}
              <input
                type="text" value={form.tagInput}
                onChange={(e) => update({ tagInput: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder={form.tags.length ? '' : 'Type a tag + Enter'}
                style={{ border: 'none', outline: 'none', flex: 1, minWidth: 80, fontFamily: FONT, fontSize: 12, background: 'transparent' }}
              />
            </div>
          </Field>
          {allTasks.length > 0 && (
            <Field label={`Linked tasks (${form.linkedTaskIds.length})`}>
              <div style={{
                maxHeight: 160, overflow: 'auto', border: `1px solid ${T.border}`,
                borderRadius: 4, padding: 4, display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                {allTasks.map(t => (
                  <label key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px',
                    fontSize: 12, borderRadius: 3, cursor: 'pointer',
                    background: form.linkedTaskIds.includes(t.id) ? T.irisSoft : 'transparent',
                  }}>
                    <input type="checkbox" checked={form.linkedTaskIds.includes(t.id)}
                      onChange={() => toggleTask(t.id)} style={{ accentColor: T.iris }} />
                    <span style={{ color: T.text }}>{t.name}</span>
                    <span style={{ marginLeft: 'auto', color: T.textDim, fontSize: 10 }}>{t.people || '—'}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}
        </form>
        <footer style={{
          display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '10px 16px',
          borderTop: `1px solid ${T.divider}`, background: T.surface2,
        }}>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" type="button" onClick={submit}>{isEdit ? 'Save' : 'Create'}</Btn>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: FONT }}>
      <span style={{
        fontSize: 10, color: T.textDim, textTransform: 'uppercase',
        letterSpacing: 0.5, fontWeight: 600,
      }}>
        {label}{required && <span style={{ color: T.danger, marginLeft: 2 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 200, padding: 20,
};
const modal = {
  background: T.surface, color: T.text, fontFamily: FONT,
  border: `1px solid ${T.border}`, borderRadius: 8,
  width: 540, maxWidth: '100%', maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 12px 36px rgba(0,0,0,0.14)',
};
const input = {
  padding: '6px 8px', fontSize: 12, fontFamily: FONT, color: T.text,
  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, outline: 'none',
};
const select = {
  ...input, cursor: 'pointer', appearance: 'none', paddingRight: 24,
  backgroundImage: `linear-gradient(45deg, transparent 50%, ${T.textDim} 50%), linear-gradient(135deg, ${T.textDim} 50%, transparent 50%)`,
  backgroundPosition: `right 10px top 13px, right 6px top 13px`,
  backgroundSize: '4px 4px, 4px 4px', backgroundRepeat: 'no-repeat',
};
const iconBtn = {
  width: 22, height: 22, border: 'none', background: 'transparent',
  color: T.textDim, cursor: 'pointer', borderRadius: 3,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
