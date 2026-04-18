import React, { useState, useMemo, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'active', label: '進行中' },
  { value: 'paused', label: '暫停' },
  { value: 'done', label: '完成' },
  { value: 'cancelled', label: '取消' },
];

export default function SubProjectFormModal({
  subProject,
  tasks,
  onSave,
  onDelete,
  onClose,
}) {
  const isEdit = !!subProject;

  const initialForm = useMemo(() => ({
    name: subProject?.name || '',
    description: subProject?.description || '',
    status: subProject?.status || 'active',
    owner: subProject?.owner || '',
    dueDate: subProject?.dueDate || '',
    priority: subProject?.priority || 'medium',
    tags: subProject?.tags || [],
    tagInput: '',
    linkedTaskIds: subProject?.linkedTaskIds || [],
  }), [subProject]);

  const [form, setForm] = useState(initialForm);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addTag = (value) => {
    const tag = value.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm(f => ({ ...f, tags: [...f.tags, tag], tagInput: '' }));
    } else {
      setForm(f => ({ ...f, tagInput: '' }));
    }
  };
  const removeTag = (tag) => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));

  const toggleTask = (taskId) => {
    setForm(f => ({
      ...f,
      linkedTaskIds: f.linkedTaskIds.includes(taskId)
        ? f.linkedTaskIds.filter(id => id !== taskId)
        : [...f.linkedTaskIds, taskId],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const finalTags = [...form.tags];
    if (form.tagInput.trim() && !finalTags.includes(form.tagInput.trim())) {
      finalTags.push(form.tagInput.trim());
    }
    onSave({
      ...(subProject ? { id: subProject.id } : {}),
      name: form.name.trim(),
      description: form.description || null,
      status: form.status,
      owner: form.owner || null,
      dueDate: form.dueDate || null,
      priority: form.priority,
      tags: finalTags,
      linkedTaskIds: form.linkedTaskIds,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base font-bold text-gray-800">{isEdit ? '編輯 Sub-project' : '新增 Sub-project'}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Name */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">名稱 *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                placeholder="例：登入改版"
                autoFocus
                data-1p-ignore
                autoComplete="off"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">描述</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none resize-none"
                rows={2}
                placeholder="簡短描述..."
                data-1p-ignore
              />
            </div>

            {/* Status + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">狀態</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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

            {/* Owner + Due date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">負責人</label>
                <input
                  type="text"
                  value={form.owner}
                  onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                  placeholder="例：Alice"
                  data-1p-ignore
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">目標完成日</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">標籤</label>
              <div className="flex flex-wrap gap-1 mb-1">
                {form.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-500"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={form.tagInput}
                onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag(form.tagInput); }
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                placeholder="輸入標籤後按 Enter"
                data-1p-ignore
                autoComplete="off"
              />
            </div>

            {/* Linked tasks */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">關聯任務</label>
              {tasks.length === 0 ? (
                <p className="text-xs text-gray-400">此專案尚無任務可關聯</p>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto divide-y divide-gray-100">
                  {tasks.map(task => (
                    <label key={task.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.linkedTaskIds.includes(task.id)}
                        onChange={() => toggleTask(task.id)}
                        className="rounded"
                      />
                      <span className="text-gray-700">{task.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="border-t border-gray-100 p-3 flex justify-between items-center shrink-0 bg-white">
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
                <button type="button" onClick={() => onDelete(subProject.id)} className="text-red-600 font-bold hover:underline">是</button>
                <button type="button" onClick={() => setShowDeleteConfirm(false)} className="text-gray-500 hover:underline">否</button>
              </div>
            )}
            {!isEdit && <div />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                取消
              </button>
              <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-40" disabled={!form.name.trim()}>
                {isEdit ? '儲存' : '新增'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
