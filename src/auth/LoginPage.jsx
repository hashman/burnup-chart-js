import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const { login, bootstrap, initialized } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isBootstrap = initialized === false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isBootstrap) {
        if (username.length < 3) {
          setError('帳號至少需要 3 個字元');
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setError('密碼至少需要 8 個字元');
          setLoading(false);
          return;
        }
        await bootstrap(username, password);
      } else {
        await login(username, password);
      }
    } catch (err) {
      try {
        const detail = JSON.parse(err.message)?.detail;
        setError(detail || '帳號或密碼錯誤');
      } catch {
        setError('帳號或密碼錯誤');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex justify-center mb-4">
          <img src="/logo.svg" alt="Burnup Chart" className="w-20 h-20" />
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          燃盡圖
        </h1>
        <p className="text-center text-gray-500 mb-6 text-sm">
          {isBootstrap ? '建立管理員帳號' : '登入'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              帳號
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密碼
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoComplete={isBootstrap ? 'new-password' : 'current-password'}
              required
            />
            {isBootstrap && (
              <p className="text-xs text-gray-400 mt-1">密碼至少 8 個字元</p>
            )}
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? '處理中...' : isBootstrap ? '建立帳號並登入' : '登入'}
          </button>
        </form>

        {isBootstrap && (
          <p className="text-xs text-gray-400 text-center mt-4">
            這是第一次使用，建立的帳號將成為管理員
          </p>
        )}
      </div>
    </div>
  );
}
