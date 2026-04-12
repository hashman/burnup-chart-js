import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { requestJson } from '../api';

const ACTION_LABELS = {
  create: '建立',
  update: '更新',
  delete: '刪除',
};

const ACTION_COLORS = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
};

const ENTITY_LABELS = {
  project: '專案',
  task: '任務',
  log: '紀錄',
  todo: '待辦',
  todo_comment: '留言',
  status: '狀態',
  user: '使用者',
};

function ChangesDetail({ changes }) {
  if (!changes || Object.keys(changes).length === 0) return <span className="text-gray-400">-</span>;

  return (
    <div className="space-y-1">
      {Object.entries(changes).map(([field, diff]) => (
        <div key={field} className="text-xs">
          <span className="font-medium text-gray-600">{field}: </span>
          {diff.old !== undefined && (
            <span className="text-red-500 line-through mr-1">{String(diff.old)}</span>
          )}
          {diff.new !== undefined && (
            <span className="text-green-600">{String(diff.new)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AuditLogPanel({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const data = await requestJson('/api/auth/users');
      setUsers(data);
    } catch (e) {
      console.error('Failed to load users', e);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('pageSize', pageSize);
      if (filterUser) params.set('userId', filterUser);
      if (filterEntityType) params.set('entityType', filterEntityType);
      if (filterAction) params.set('action', filterAction);
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);

      const data = await requestJson(`/api/audit-logs?${params.toString()}`);
      setLogs(data.items);
      setTotal(data.total);
    } catch (e) {
      console.error('Failed to load audit logs', e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterUser, filterEntityType, filterAction, filterStartDate, filterEndDate]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleFilterChange = () => {
    setPage(1);
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">稽核記錄</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b bg-gray-50 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">使用者</label>
            <select
              value={filterUser}
              onChange={(e) => { setFilterUser(e.target.value); handleFilterChange(); }}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全部</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName} (@{u.username})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">實體類型</label>
            <select
              value={filterEntityType}
              onChange={(e) => { setFilterEntityType(e.target.value); handleFilterChange(); }}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全部</option>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">操作</label>
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); handleFilterChange(); }}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全部</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">開始日期</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => { setFilterStartDate(e.target.value); handleFilterChange(); }}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">結束日期</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => { setFilterEndDate(e.target.value); handleFilterChange(); }}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">載入中...</div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">沒有稽核記錄</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 w-8"></th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">時間</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">使用者</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">操作</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">類型</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">名稱</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-2 text-gray-400">
                        {log.changes ? (
                          expandedId === log.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatTime(log.createdAt)}</td>
                      <td className="px-4 py-2 text-gray-700">{log.userDisplay}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {ENTITY_LABELS[log.entityType] || log.entityType}
                      </td>
                      <td className="px-4 py-2 text-gray-700 truncate max-w-[200px]" title={log.entityLabel}>
                        {log.entityLabel || log.entityId}
                      </td>
                    </tr>
                    {expandedId === log.id && log.changes && (
                      <tr className="bg-gray-50">
                        <td></td>
                        <td colSpan={5} className="px-4 py-3">
                          <ChangesDetail changes={log.changes} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-3 border-t text-sm text-gray-500">
          <div>
            共 {total} 筆記錄
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span>{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
