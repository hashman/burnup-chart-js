import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Shield, UserCheck, Eye } from 'lucide-react';
import { requestJson } from '../api';

const ROLE_OPTIONS = [
  { value: 'admin', label: '管理員', icon: Shield, color: 'text-red-600' },
  { value: 'member', label: '成員', icon: UserCheck, color: 'text-blue-600' },
  { value: 'viewer', label: '檢視者', icon: Eye, color: 'text-gray-600' },
];

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', display_name: '', password: '', role: 'member' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const data = await requestJson('/api/auth/users');
      setUsers(data);
    } catch (e) {
      console.error('Failed to load users', e);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestJson('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowCreate(false);
      setForm({ username: '', display_name: '', password: '', role: 'member' });
      loadUsers();
    } catch (err) {
      try {
        const detail = JSON.parse(err.message)?.detail;
        setError(detail || '建立失敗');
      } catch {
        setError('建立失敗');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await requestJson(`/api/auth/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      loadUsers();
    } catch (e) {
      console.error('Failed to update role', e);
    }
  };

  const handleToggleActive = async (userId, isActive) => {
    try {
      await requestJson(`/api/auth/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !isActive }),
      });
      loadUsers();
    } catch (e) {
      console.error('Failed to toggle user status', e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">使用者管理</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* User list */}
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  u.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div>
                  <div className="font-medium text-gray-800">{u.displayName}</div>
                  <div className="text-sm text-gray-500">@{u.username}</div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleToggleActive(u.id, u.isActive)}
                    className={`text-xs px-2 py-1 rounded ${
                      u.isActive
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {u.isActive ? '啟用中' : '已停用'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Create user form */}
          {showCreate ? (
            <form onSubmit={handleCreate} className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">帳號</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    minLength={3}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">顯示名稱</label>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">密碼</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">角色</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {error && (
                <div className="text-red-600 text-sm bg-red-50 rounded px-3 py-2">{error}</div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setError(''); }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? '建立中...' : '建立'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
            >
              <Plus size={16} />
              新增使用者
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
