import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2 } from 'lucide-react';

export default function TodoFormModal({ todo, statuses, allTasks, projects, allTags, onSave, onDelete, onClose }) {
  const isEdit = !!todo;
  const startStatus = statuses.find(s => s.isDefaultStart);

  const [form, setForm] = useState({
    title: '',
    status: startStatus ? startStatus.id : '',
    priority: 'medium',
    dueDate: '',
    assignee: '',
    tagsInput: '',
    note: '',
    linkedTaskId: '',
  });

  useEffect(() => {
    if (todo) {
      setForm({
        title: todo.title || '',
        status: todo.status || (startStatus ? startStatus.id : ''),
        priority: todo.priority || 'medium',
        dueDate: todo.dueDate || '',
        assignee: todo.assignee || '',
        tagsInput: (todo.tags || []).join(', '),
        note: todo.note || '',
        linkedTaskId: todo.linkedTaskId || '',
      });
    }
  }, [todo]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const taskOptions = useMemo(() => {
    const options = [];
    projects.forEach(p => {
      p.tasks.forEach(t => {
        options.push({ id: t.id, label: `${p.name} / ${t.name}` });
      });
    });
    return options;
  }, [projects]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const tags = form.tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    onSave({
      ...(todo ? { id: todo.id } : {}),
      title: form.title.trim(),
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      assignee: form.assignee || null,
      tags,
      note: form.note || null,
      linkedTaskId: form.linkedTaskId || null,
    });
  };

  const tagSuggestions = useMemo(() => {
    const currentTags = form.tagsInput.split(',').map(t => t.trim().toLowerCase());
    return (allTags || []).filter(t => !currentTags.includes(t.toLowerCase()));
  }, [allTags, form.tagsInput]);

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
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">標籤（逗號分隔）</label>
            <input
              type="text"
              value={form.tagsInput}
              onChange={e => setForm(f => ({ ...f, tagsInput: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              placeholder="Frontend, Backend, ..."
              list="tag-suggestions"
            />
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
            />
          </div>

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
