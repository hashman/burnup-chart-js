import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Users } from 'lucide-react';
import { useAuth } from './AuthContext';

const ROLE_LABELS = {
  admin: '管理員',
  member: '成員',
  viewer: '檢視者',
};

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  member: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
};

export default function UserMenu({ onAdminPanel }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors text-sm"
      >
        <User size={16} />
        <span>{user.displayName}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_COLORS[user.role] || ''}`}>
          {ROLE_LABELS[user.role] || user.role}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px] z-50">
          {user.role === 'admin' && onAdminPanel && (
            <button
              onClick={() => { setOpen(false); onAdminPanel(); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <Users size={14} />
              使用者管理
            </button>
          )}
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
          >
            <LogOut size={14} />
            登出
          </button>
        </div>
      )}
    </div>
  );
}
