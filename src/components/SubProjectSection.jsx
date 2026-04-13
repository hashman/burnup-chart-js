import React, { useState, useMemo, useCallback } from 'react';
import { Plus, ChevronDown, ChevronRight, Clock, Send, CheckCircle2, Trash2, Pencil, MessageSquare, AlertCircle, FileText } from 'lucide-react';
import { requestJson } from '../api';
import SubProjectFormModal from './SubProjectFormModal';

const STATUS_STYLES = {
  active:    { label: '進行中', chip: 'bg-blue-50 text-blue-600 border-blue-200' },
  paused:    { label: '暫停',   chip: 'bg-amber-50 text-amber-600 border-amber-200' },
  done:      { label: '完成',   chip: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  cancelled: { label: '取消',   chip: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const PRIORITY_STYLES = {
  high:   { label: '高', chip: 'bg-red-50 text-red-600' },
  medium: { label: '中', chip: 'bg-amber-50 text-amber-600' },
  low:    { label: '低', chip: 'bg-gray-100 text-gray-500' },
};

const EVENT_TYPE_STYLES = {
  waiting:  { label: '等待', icon: Clock,       bg: 'bg-amber-50 border-amber-200' },
  note:     { label: '記事', icon: FileText,    bg: 'bg-gray-50 border-gray-200' },
  decision: { label: '決策', icon: AlertCircle, bg: 'bg-violet-50 border-violet-200' },
};

function daysBetween(isoStart, isoEnd) {
  const start = new Date(isoStart).getTime();
  const end = isoEnd ? new Date(isoEnd).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

function SubProjectCard({ subProject, tasks, onEdit, onReload }) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newType, setNewType] = useState('waiting');
  const [newTitle, setNewTitle] = useState('');
  const [newWaitingOn, setNewWaitingOn] = useState('');

  const statusStyle = STATUS_STYLES[subProject.status] || STATUS_STYLES.active;
  const priorityStyle = PRIORITY_STYLES[subProject.priority] || PRIORITY_STYLES.medium;

  const linkedTasks = useMemo(
    () => (subProject.linkedTaskIds || []).map(id => tasks.find(t => t.id === id)).filter(Boolean),
    [subProject.linkedTaskIds, tasks]
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson(`/api/sub-projects/${subProject.id}/events`);
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [subProject.id]);

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && events === null) loadEvents();
  };

  const handleAddEvent = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const payload = { type: newType, title };
      if (newType === 'waiting' && newWaitingOn.trim()) payload.waitingOn = newWaitingOn.trim();
      const created = await requestJson(`/api/sub-projects/${subProject.id}/events`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setEvents(prev => [created, ...(prev || [])]);
      setNewTitle('');
      setNewWaitingOn('');
      if (newType === 'waiting') onReload();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolve = async (event) => {
    try {
      const now = new Date().toISOString();
      const updated = await requestJson(`/api/events/${event.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ resolvedAt: now }),
      });
      setEvents(prev => (prev || []).map(e => e.id === event.id ? updated : e));
      onReload();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvent = async (event) => {
    if (!window.confirm('確定刪除此事件？')) return;
    try {
      await requestJson(`/api/events/${event.id}`, { method: 'DELETE' });
      setEvents(prev => (prev || []).filter(e => e.id !== event.id));
      if (event.type === 'waiting' && !event.resolvedAt) onReload();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={`border rounded-lg bg-white shadow-sm overflow-hidden ${statusStyle.chip.includes('gray') ? 'opacity-75' : ''}`}>
      {/* Card header */}
      <div className="flex items-start gap-2 p-3">
        <button
          onClick={toggleExpand}
          className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0"
          title={expanded ? '收合' : '展開 timeline'}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-gray-800 text-sm truncate">{subProject.name}</h4>
            <span className={`text-[11px] px-1.5 py-0.5 rounded border ${statusStyle.chip}`}>
              {statusStyle.label}
            </span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${priorityStyle.chip}`}>
              {priorityStyle.label}
            </span>
            {subProject.activeWaitingCount > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold flex items-center gap-0.5">
                <Clock size={10} /> {subProject.activeWaitingCount}
              </span>
            )}
          </div>
          {subProject.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{subProject.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            {subProject.owner && <span>👤 {subProject.owner}</span>}
            {subProject.dueDate && <span>📅 {subProject.dueDate}</span>}
            {linkedTasks.length > 0 && (
              <span>🔗 {linkedTasks.map(t => t.name).join(', ')}</span>
            )}
          </div>
          {subProject.tags && subProject.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1">
              {subProject.tags.map(t => (
                <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onEdit(subProject)}
          className="text-gray-400 hover:text-indigo-600 p-1 shrink-0"
          title="編輯"
        >
          <Pencil size={14} />
        </button>
      </div>

      {/* Timeline + add form */}
      {expanded && (
        <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
          {/* Add event form */}
          <div className="bg-white border border-gray-200 rounded-lg p-2 space-y-2">
            <div className="flex gap-1">
              {Object.entries(EVENT_TYPE_STYLES).map(([value, { label, icon: Icon }]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setNewType(value)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition ${
                    newType === value
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Icon size={11} /> {label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEvent(); } }}
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-indigo-400"
              placeholder={newType === 'waiting' ? '在等什麼？' : newType === 'decision' ? '做了什麼決策？' : '記一下'}
            />
            {newType === 'waiting' && (
              <input
                type="text"
                value={newWaitingOn}
                onChange={e => setNewWaitingOn(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEvent(); } }}
                className="w-full border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-indigo-400"
                placeholder="在等誰？例：PM / DevOps / User"
              />
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddEvent}
                disabled={!newTitle.trim()}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:text-gray-300 font-semibold px-2 py-1"
              >
                <Send size={12} /> 新增事件
              </button>
            </div>
          </div>

          {/* Timeline */}
          {loading && <p className="text-xs text-gray-400 text-center py-2">載入中...</p>}
          {!loading && events && events.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">尚無事件</p>
          )}
          {!loading && events && events.length > 0 && (
            <div className="space-y-2">
              {events.map(event => {
                const style = EVENT_TYPE_STYLES[event.type] || EVENT_TYPE_STYLES.note;
                const Icon = style.icon;
                const isActive = event.type === 'waiting' && !event.resolvedAt;
                const days = daysBetween(event.startedAt, event.resolvedAt);
                return (
                  <div key={event.id} className={`border rounded-lg p-2 text-sm ${style.bg} group`}>
                    <div className="flex items-start gap-2">
                      <Icon size={14} className="mt-0.5 shrink-0 text-gray-600" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-800">{event.title}</span>
                          {event.type === 'waiting' && event.waitingOn && (
                            <span className="text-[11px] bg-white text-gray-600 px-1.5 py-0.5 rounded border">
                              在等 {event.waitingOn}
                            </span>
                          )}
                          {isActive && (
                            <span className="text-[11px] text-amber-700 font-semibold">已卡 {days} 天</span>
                          )}
                          {!isActive && event.type === 'waiting' && (
                            <span className="text-[11px] text-gray-500">共卡 {days} 天 ✓</span>
                          )}
                        </div>
                        {event.body && <p className="text-xs text-gray-600 mt-0.5">{event.body}</p>}
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(event.startedAt).toLocaleString('zh-TW')}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                        {isActive && (
                          <button
                            onClick={() => handleResolve(event)}
                            className="text-emerald-500 hover:text-emerald-700 p-1"
                            title="標記為已解除"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteEvent(event)}
                          className="text-gray-400 hover:text-red-500 p-1"
                          title="刪除"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SubProjectSection({
  burnupProjectId,
  subProjects,
  tasks,
  onCreate,
  onUpdate,
  onDelete,
  onReload,
}) {
  const [showFormModal, setShowFormModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showDoneCancelled, setShowDoneCancelled] = useState(false);

  const projectSubProjects = useMemo(
    () => subProjects.filter(sp => sp.burnupProjectId === burnupProjectId),
    [subProjects, burnupProjectId]
  );

  const activeOnes = projectSubProjects.filter(sp => sp.status !== 'done' && sp.status !== 'cancelled');
  const doneOnes = projectSubProjects.filter(sp => sp.status === 'done' || sp.status === 'cancelled');

  const openCreate = () => { setEditing(null); setShowFormModal(true); };
  const openEdit = (sp) => { setEditing(sp); setShowFormModal(true); };

  const handleSave = async (data) => {
    if (data.id) {
      await onUpdate(data.id, data);
    } else {
      await onCreate(burnupProjectId, data);
    }
    setShowFormModal(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    await onDelete(id);
    setShowFormModal(false);
    setEditing(null);
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-indigo-500" />
          <h3 className="text-base font-bold text-gray-800">Sub-projects / 工作追蹤</h3>
          <span className="text-xs text-gray-400">({projectSubProjects.length})</span>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
        >
          <Plus size={14} /> 新增 Sub-project
        </button>
      </div>

      {projectSubProjects.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">尚無 sub-project，點右上角新增</p>
      ) : (
        <div className="space-y-2">
          {activeOnes.map(sp => (
            <SubProjectCard key={sp.id} subProject={sp} tasks={tasks} onEdit={openEdit} onReload={onReload} />
          ))}
          {doneOnes.length > 0 && (
            <div>
              <button
                onClick={() => setShowDoneCancelled(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mt-2"
              >
                {showDoneCancelled ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                已完成 / 已取消 ({doneOnes.length})
              </button>
              {showDoneCancelled && (
                <div className="space-y-2 mt-2">
                  {doneOnes.map(sp => (
                    <SubProjectCard key={sp.id} subProject={sp} tasks={tasks} onEdit={openEdit} onReload={onReload} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showFormModal && (
        <SubProjectFormModal
          subProject={editing}
          tasks={tasks}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setShowFormModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
