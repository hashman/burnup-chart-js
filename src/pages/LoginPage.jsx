import React, { useState } from 'react';
import { T, FONT } from '../design/tokens.js';
import { I, ICON, Btn } from '../design/primitives.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

// New UI login screen. Bootstrap mode auto-activates when the API
// reports no users exist yet. Uses AuthContext.login / bootstrap.

export function LoginPage() {
  const { login, bootstrap, initialized } = useAuth();
  const bootstrapMode = initialized === false;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    setError('');
    try {
      if (bootstrapMode) {
        await bootstrap(username.trim(), password);
      } else {
        await login(username.trim(), password);
      }
    } catch (err) {
      const msg = err?.message || String(err);
      setError(bootstrapMode
        ? msg.includes('8') ? 'Password must be at least 8 characters' : '建立管理員失敗：' + msg
        : '登入失敗：請確認帳號密碼');
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      width: '100%', height: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
    }}>
      <div style={{
        width: 380, background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 8, padding: 32,
        boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6, background: T.text,
            color: '#fff', fontSize: 16, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>B</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Burnup</div>
            <div style={{ fontSize: 11, color: T.textDim }}>燃盡圖 · task tracker</div>
          </div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3, marginBottom: 4 }}>
          {bootstrapMode ? 'Create admin account' : 'Welcome back'}
        </div>
        <div style={{ fontSize: 12, color: T.textMute, marginBottom: 18 }}>
          {bootstrapMode ? 'First-time setup · this user will be the admin.' : 'Sign in to continue.'}
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>Username</label>
            <input
              autoFocus
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alice"
              disabled={submitting}
              style={input}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              style={input}
            />
            {bootstrapMode && (
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
                At least 8 characters
              </div>
            )}
          </div>

          {error && (
            <div style={{
              marginTop: 10, padding: '8px 10px',
              background: T.dangerSoft, border: '1px solid #FECACA',
              borderRadius: 4, fontSize: 11, color: T.danger,
            }}>
              {error}
            </div>
          )}

          <Btn
            variant="primary"
            type="submit"
            disabled={submitting || !username.trim() || !password}
            style={{
              width: '100%', justifyContent: 'center',
              height: 34, fontSize: 13, marginTop: 14,
            }}
          >
            {submitting ? '…' : bootstrapMode ? 'Create account & sign in' : 'Sign in'}
          </Btn>
        </form>

        <div style={{
          marginTop: 20, padding: '10px 12px',
          background: T.surface2, borderRadius: 5,
          fontSize: 11, color: T.textMute,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <I d={ICON.lock} size={12} style={{ color: T.textDim, marginTop: 1 }} />
          <div>
            JWT · 30 min access · 7 d refresh
            <div style={{ color: T.textDim, marginTop: 2 }}>
              Token rotation · reuse detection auto-logout
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const label = {
  fontSize: 11, color: T.textMute, fontWeight: 500,
  display: 'block', marginBottom: 4,
};
const input = {
  width: '100%', padding: '7px 10px',
  border: `1px solid ${T.border}`, borderRadius: 5,
  fontSize: 13, fontFamily: FONT, outline: 'none',
  boxSizing: 'border-box', color: T.text, background: T.surface,
};
