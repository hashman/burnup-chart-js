import React, { useState, useMemo } from 'react';
import { X, Trash2, Send, Pencil } from 'lucide-react';

export default function TodoFormModal({ todo, statuses, allTasks: _allTasks, projects, allTags, allAssignees, onSave, onDelete, onClose, onCreateComment, onUpdateComment, onDeleteComment }) {
  const isEdit = !!todo;
  const startStatus = statuses.find(s => s.isDefaultStart);

  const initialForm = useMemo(() => ({
    title: todo?.title || '',
    status: todo?.status || (startStatus ? startStatus.id : ''),
    priority: todo?.priority || 'medium',
    dueDate: todo?.dueDate || '',
    assignee: todo?.assignee || '',
    tags: todo?.tags || [],
    tagInput: '',
    note: todo?.note || '',
    linkedTaskId: todo?.linkedTaskId || '',
  }), [todo, startStatus]);

  const [form, setForm] = useState(initialForm);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  const comments = (todo && todo.comments) || [];

  const handleAddComment = () => {
    if (!commentInput.trim() || !todo) return;
    onCreateComment(todo.id, commentInput.trim());
    setCommentInput('');
  };

  const handleSaveEditComment = (commentId) => {
    if (!editingCommentContent.trim() || !todo) return;
    onUpdateComment(todo.id, commentId, editingCommentContent.trim());
    setEditingCommentId(null);
    setEditingCommentContent('');
  };

  const taskOptions = useMemo(() => {
    const options = [];
    projects.forEach(p => {
      p.tasks.forEach(t => {
        options.push({ id: t.id, label: `${p.name} / ${t.name}` });
      });
    });
    return options;
  }, [projects]);

  const addTag = (value) => {
    const tag = value.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm(f => ({ ...f, tags: [...f.tags, tag], tagInput: '' }));
    } else {
      setForm(f => ({ ...f, tagInput: '' }));
    }
  };

  const removeTag = (tag) => {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    // Include any pending tag input
    const finalTags = [...form.tags];
    if (form.tagInput.trim() && !finalTags.includes(form.tagInput.trim())) {
      finalTags.push(form.tagInput.trim());
    }
    onSave({
      ...(todo ? { id: todo.id } : {}),
      title: form.title.trim(),
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      assignee: form.assignee || null,
      tags: finalTags,
      note: form.note || null,
      linkedTaskId: form.linkedTaskId || null,
    });
  };

  const tagSuggestions = useMemo(() => {
    return (allTags || []).filter(t => !form.tags.includes(t));
  }, [allTags, form.tags]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">{isEdit ? '編輯 Todo' : '新增 Todo'}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">標題 *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              placeholder="輸入待辦事項"
              autoFocus
              data-1p-ignore
              autoComplete="off"
            />
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">狀態</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              >
                {statuses.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">優先級</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
          </div>

          {/* Due Date + Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">到期日</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                data-1p-ignore
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">指派人</label>
              <input
                type="text"
                value={form.assignee}
                onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                placeholder="名稱"
                list="assignee-suggestions"
                data-1p-ignore
                autoComplete="off"
              />
              <datalist id="assignee-suggestions">
                {(allAssignees || []).map(a => <option key={a} value={a} />)}
              </datalist>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">標籤</label>
            <div className="flex flex-wrap gap-1.5 border border-gray-300 rounded-lg px-2 py-1.5 focus-within:border-indigo-500 min-h-[38px] items-center">
              {form.tags.map(tag => (
                <span key={tag} className="flex items-center gap-0.5 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-md">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-indigo-400 hover:text-indigo-700 ml-0.5">&times;</button>
                </span>
              ))}
              <input
                type="text"
                value={form.tagInput}
                onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && form.tagInput.trim()) {
                    e.preventDefault();
                    addTag(form.tagInput);
                  }
                  if (e.key === 'Backspace' && !form.tagInput && form.tags.length > 0) {
                    removeTag(form.tags[form.tags.length - 1]);
                  }
                }}
                onBlur={() => { if (form.tagInput.trim()) addTag(form.tagInput); }}
                className="flex-1 min-w-[80px] text-sm outline-none bg-transparent py-0.5"
                placeholder={form.tags.length === 0 ? '輸入標籤後按 Enter' : ''}
                list="tag-suggestions"
                data-1p-ignore
                autoComplete="off"
              />
            </div>
            <datalist id="tag-suggestions">
              {tagSuggestions.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          {/* Linked Task */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">關聯任務</label>
            <select
              value={form.linkedTaskId}
              onChange={e => setForm(f => ({ ...f, linkedTaskId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            >
              <option value="">無</option>
              {taskOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">備註</label>
            <textarea
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none resize-none"
              rows={3}
              placeholder="備註..."
              data-1p-ignore
            />
          </div>

          {/* Comments (edit mode only) */}
          {isEdit && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">留言紀錄</label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                {comments.length > 0 && (
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {comments.map(c => (
                      <div key={c.id} className="px-3 py-2 text-sm group hover:bg-gray-50">
                        {editingCommentId === c.id ? (
                          <div className="space-y-1">
                            <textarea
                              value={editingCommentContent}
                              onChange={e => setEditingCommentContent(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Escape') setEditingCommentId(null); }}
                              className="w-full border border-indigo-300 rounded px-2 py-1 text-sm outline-none resize-none"
                              rows={2}
                              autoFocus
                              data-1p-ignore
                            />
                            <div className="flex justify-end gap-1">
                              <button type="button" onClick={() => setEditingCommentId(null)} className="text-gray-400 hover:text-gray-600 p-1 text-xs">取消</button>
                              <button type="button" onClick={() => handleSaveEditComment(c.id)} className="text-indigo-500 hover:text-indigo-700 p-1 text-xs font-semibold">儲存</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-gray-700">{c.content}</p>
                              <span className="text-[10px] text-gray-400">
                                {new Date(c.createdAt).toLocaleString('zh-TW')}
                                {c.updatedAt !== c.createdAt && ' (已編輯)'}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                              <button type="button" onClick={() => { setEditingCommentId(c.id); setEditingCommentContent(c.content); }} className="text-gray-400 hover:text-indigo-600 p-1"><Pencil size={12} /></button>
                              <button type="button" onClick={() => onDeleteComment(todo.id, c.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-gray-200 px-2 py-1.5 space-y-1">
                  <textarea
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    className="w-full text-sm outline-none bg-transparent resize-none"
                    rows={2}
                    placeholder="輸入留言..."
                    data-1p-ignore
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={!commentInput.trim()}
                      className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 disabled:text-gray-300 font-semibold px-2 py-1"
                    >
                      <Send size={12} /> 送出
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-between items-center pt-2">
            {isEdit && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 size={14} /> 刪除
              </button>
            )}
            {isEdit && showDeleteConfirm && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-red-600">確定刪除？</span>
                <button type="button" onClick={() => onDelete(todo.id)} className="text-red-600 font-bold hover:underline">是</button>
                <button type="button" onClick={() => setShowDeleteConfirm(false)} className="text-gray-500 hover:underline">否</button>
              </div>
            )}
            {!isEdit && <div />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                取消
              </button>
              <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-40" disabled={!form.title.trim()}>
                {isEdit ? '儲存' : '新增'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
