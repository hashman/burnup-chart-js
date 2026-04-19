// A/B switch wrapper. Renders the legacy <App /> or the new <NewApp />
// based on a persisted `ui_version` preference. Adds a small floating
// toggle pill and a Shift+U keyboard shortcut.

import React, { useState, useEffect, useCallback } from 'react';
import App from './App.jsx';
import NewApp from './NewApp.jsx';

const STORAGE_KEY = 'ui_version';
const VERSIONS = ['legacy', 'next'];

function readInitialVersion() {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('ui');
    if (VERSIONS.includes(q)) return q;
  } catch { /* ignore */ }
  const stored = localStorage.getItem(STORAGE_KEY);
  return VERSIONS.includes(stored) ? stored : 'legacy';
}

export default function AppRoot() {
  const [version, setVersion] = useState(readInitialVersion);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, version);
  }, [version]);

  const toggle = useCallback(() => {
    setVersion(v => (v === 'legacy' ? 'next' : 'legacy'));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'U' && e.key !== 'u') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <>
      {version === 'next' ? <NewApp /> : <App />}
      <UiVersionPill version={version} onToggle={toggle} />
    </>
  );
}

function UiVersionPill({ version, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title="Toggle UI version (Shift+U)"
      style={{
        position: 'fixed', left: 12, bottom: 12, zIndex: 2147483000,
        padding: '5px 10px', fontSize: 11, fontFamily: 'inherit',
        background: 'rgba(24,24,27,0.78)', color: '#fff',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999,
        cursor: 'pointer', backdropFilter: 'blur(6px)',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
        opacity: 0.65, transition: 'opacity 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.65')}
    >
      <span style={{ opacity: 0.7, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' }}>UI</span>
      <span style={{ fontWeight: 600 }}>{version === 'next' ? 'Next' : 'Legacy'}</span>
      <span style={{ opacity: 0.55, fontSize: 10 }}>⇧U</span>
    </button>
  );
}
