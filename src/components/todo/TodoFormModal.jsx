import React, { useEffect, useMemo, useState } from 'react';
import { T, FONT, MONO } from '../../design/tokens.js';
import { I, ICON, Avatar, Badge, Btn } from '../../design/primitives.jsx';

// Modal / drawer for creating or editing a todo. Ports the legacy
// TodoFormModal into the new design system (inline styles + tokens).

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderInline(text) {
  if (!text) return null;
  const parts = String(text).split(URL_REGEX);
  return parts.map((part, i) => i % 2 === 1
    ? <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        style={{ color: T.iris, wordBreak: 'break-all' }}>{part}</a>
    : <React.Fragment key={i}>{part}</React.Fragment>);
}

export function TodoFormModal({
  todo,
  statuses,
  allTasks,
  subProjects,
  allTags,
  allAssignees,
  onSave,
  onDelete,
  onClose,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
}) {
  const isEdit = !!todo?.id;
  const startStatus = statuses.find(s => s.isDefaultStart);

  const [form, setForm] = useState(() => ({
    title: todo?.title || '',
    status: todo?.status || (startStatus ? startStatus.id : ''),
    priority: todo?.priority || 'medium',
    dueDate: todo?.dueDate || '',
    assignee: todo?.assignee || '',
    tags: todo?.tags || [],
    tagInput: '',
    note: todo?.note || '',
    linkedTaskId: todo?.linkedTaskId || '',
    subProjectId: todo?.subProjectId || '',
  }));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (patch) => setForm(prev => ({ ...prev, ...patch }));

  const addTag = () => {
    const v = form.tagInput.trim();
    if (!v) return;
    if (!form.tags.includes(v)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, v], tagInput: '' }));
    } else {
      setForm(prev => ({ ...prev, tagInput: '' }));
    }
  };
  const removeTag = (t) => setForm(prev => ({ ...prev, tags: prev.tags.filter(x => x !== t) }));

  const taskOptions = useMemo(() => allTasks.map(t => ({
    value: t.id, label: t.name,
  })), [allTasks]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      assignee: form.assignee || null,
      tags: form.tags,
      note: form.note || null,
      linkedTaskId: form.linkedTaskId || null,
      subProjectId: form.subProjectId || null,
    };
    if (isEdit) payload.id = todo.id;
    onSave?.(payload);
  };

  const comments = (todo && todo.comments) || [];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: `1px solid ${T.divider}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {isEdit ? 'Edit todo' : 'New todo'}
            </div>
            {isEdit && <Badge tone="neutral" size="sm" style={{ fontFamily: MONO }}>{todo.id.slice(-6)}</Badge>}
          </div>
          <button style={iconBtn} onClick={onClose} title="Close (Esc)">
            <I d={ICON.x} size={14} />
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'auto', minHeight: 0 }}>
          {/* Title */}
          <Field label="Title" required>
            <input
              type="text"
              autoFocus
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="What needs to get done?"
              style={{ ...input, fontSize: 14, fontWeight: 500 }}
            />
          </Field>

          {/* Row: status + priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Status">
              <select value={form.status} onChange={(e) => update({ status: e.target.value })} style={select}>
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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

          {/* Row: assignee + due */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Assignee">
              <input
                type="text"
                list="new-ui-assignee-list"
                value={form.assignee}
                onChange={(e) => update({ assignee: e.target.value })}
                placeholder="Who owns this?"
                style={input}
              />
              <datalist id="new-ui-assignee-list">
                {allAssignees.map(a => <option key={a} value={a} />)}
              </datalist>
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => update({ dueDate: e.target.value })}
                style={input}
              />
            </Field>
          </div>

          {/* Tags */}
          <Field label="Tags">
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 5, padding: 6,
              border: `1px solid ${T.border}`, borderRadius: 4, background: T.surface,
              minHeight: 32, alignItems: 'center',
            }}>
              {form.tags.map(t => (
                <span key={t} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 6px', background: T.irisSoft, color: T.iris,
                  fontSize: 11, borderRadius: 3, border: `1px solid #D7DAFF`,
                }}>
                  #{t}
                  <button type="button" onClick={() => removeTag(t)} style={{
                    ...iconBtn, width: 14, height: 14, color: T.iris,
                  }}><I d={ICON.x} size={9} /></button>
                </span>
              ))}
              <input
                type="text"
                value={form.tagInput}
                onChange={(e) => update({ tagInput: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                list="new-ui-tag-list"
                placeholder={form.tags.length ? '' : 'Type a tag + Enter'}
                style={{
                  border: 'none', outline: 'none', flex: 1, minWidth: 80,
                  fontFamily: FONT, fontSize: 12, background: 'transparent',
                }}
              />
              <datalist id="new-ui-tag-list">
                {allTags.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
          </Field>

          {/* Row: sub-project + linked task */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Sub-project">
              <select value={form.subProjectId} onChange={(e) => update({ subProjectId: e.target.value })} style={select}>
                <option value="">—</option>
                {subProjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Linked task">
              <select value={form.linkedTaskId} onChange={(e) => update({ linkedTaskId: e.target.value })} style={select}>
                <option value="">—</option>
                {taskOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Note */}
          <Field label="Notes">
            <textarea
              rows={3}
              value={form.note}
              onChange={(e) => update({ note: e.target.value })}
              placeholder="Additional context…"
              style={{ ...input, resize: 'vertical', minHeight: 60, fontFamily: FONT }}
            />
          </Field>

          {/* Comments */}
          {isEdit && (
            <Field label="Comments">
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                border: `1px solid ${T.border}`, borderRadius: 4,
                background: T.surface, padding: 8, maxHeight: 240, overflow: 'auto',
              }}>
                {comments.length === 0 && (
                  <div style={{ fontSize: 11, color: T.textDim, textAlign: 'center', padding: 8 }}>
                    No comments yet
                  </div>
                )}
                {comments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    {c.author ? (
                      <Avatar name={c.author} size={20} />
                    ) : (
                      <div style={{
                        width: 20, height: 20, borderRadius: 20,
                        background: T.surface2, color: T.textDim,
                        border: `1px solid ${T.border}`,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }} title="Author not recorded">
                        <I d={ICON.user} size={11} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: c.author ? T.text : T.textDim }}>
                          {c.author || 'Unknown'}
                        </span>
                        <span style={{ fontSize: 10, color: T.textDim }}>
                          {c.createdAt ? c.createdAt.slice(0, 16).replace('T', ' ') : ''}
                        </span>
                        {editingCommentId !== c.id && (
                          <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                            <button type="button" style={iconBtn} title="Edit" onClick={() => {
                              setEditingCommentId(c.id);
                              setEditingCommentContent(c.content);
                            }}>
                              <I d={ICON.pencil} size={11} />
                            </button>
                            <button type="button" style={iconBtn} title="Delete" onClick={() => onDeleteComment?.(c.id)}>
                              <I d={ICON.trash} size={11} />
                            </button>
                          </span>
                        )}
                      </div>
                      {editingCommentId === c.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            value={editingCommentContent}
                            onChange={(e) => setEditingCommentContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onUpdateComment?.(c.id, editingCommentContent.trim());
                                setEditingCommentId(null);
                              }
                              if (e.key === 'Escape') setEditingCommentId(null);
                            }}
                            style={{ ...input, fontSize: 12, flex: 1, minWidth: 0 }}
                          />
                          <Btn variant="primary" type="button" onClick={() => {
                            onUpdateComment?.(c.id, editingCommentContent.trim());
                            setEditingCommentId(null);
                          }}>Save</Btn>
                          <Btn variant="ghost" type="button" onClick={() => setEditingCommentId(null)}>Cancel</Btn>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: T.textMute, lineHeight: 1.5, wordBreak: 'break-word' }}>
                          {renderInline(c.content)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, paddingTop: 6, borderTop: `1px solid ${T.divider}`, marginTop: 2 }}>
                  <input
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && commentInput.trim()) {
                        onCreateComment?.(todo.id, commentInput.trim());
                        setCommentInput('');
                      }
                    }}
                    placeholder="Add a comment…"
                    style={{ ...input, fontSize: 12, flex: 1, minWidth: 0 }}
                  />
                  <Btn
                    variant="iris"
                    type="button"
                    icon="send"
                    disabled={!commentInput.trim()}
                    onClick={() => {
                      if (!commentInput.trim()) return;
                      onCreateComment?.(todo.id, commentInput.trim());
                      setCommentInput('');
                    }}
                  />
                </div>
              </div>
            </Field>
          )}
        </form>

        <footer style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 16px', borderTop: `1px solid ${T.divider}`, background: T.surface2,
        }}>
          <div>
            {isEdit && (
              showDeleteConfirm ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: T.danger }}>Delete this todo?</span>
                  <Btn
                    variant="danger"
                    type="button"
                    style={{ background: T.danger, color: '#fff', borderColor: T.danger }}
                    onClick={() => onDelete?.(todo.id)}
                  >
                    Delete
                  </Btn>
                  <Btn variant="ghost" type="button" onClick={() => setShowDeleteConfirm(false)}>Cancel</Btn>
                </div>
              ) : (
                <Btn
                  variant="ghost"
                  type="button"
                  icon="trash"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ color: T.danger }}
                >
                  Delete
                </Btn>
              )
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" type="button" onClick={handleSubmit}>
              {isEdit ? 'Save' : 'Create'}
            </Btn>
          </div>
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
  width: 560, maxWidth: '100%', maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 12px 36px rgba(0,0,0,0.14)',
};
const input = {
  padding: '6px 8px', fontSize: 12, fontFamily: FONT, color: T.text,
  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4,
  outline: 'none',
};
const select = {
  ...input, cursor: 'pointer', appearance: 'none',
  paddingRight: 24,
  backgroundImage: `linear-gradient(45deg, transparent 50%, ${T.textDim} 50%), linear-gradient(135deg, ${T.textDim} 50%, transparent 50%)`,
  backgroundPosition: `right 10px top 13px, right 6px top 13px`,
  backgroundSize: '4px 4px, 4px 4px',
  backgroundRepeat: 'no-repeat',
};
const iconBtn = {
  width: 22, height: 22, border: 'none', background: 'transparent',
  color: T.textDim, cursor: 'pointer', borderRadius: 3,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
