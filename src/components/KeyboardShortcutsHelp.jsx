import React, { useState, useRef, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl';

const shortcuts = [
  { keys: [`${modKey}`, 'K'], description: '開啟搜尋' },
  { keys: ['↑', '↓'], description: '搜尋結果上下選取' },
  { keys: ['Enter'], description: '開啟選中結果' },
  { keys: ['Esc'], description: '關閉彈窗 / 搜尋' },
];

export default function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="absolute bottom-14 right-0 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-600">快捷鍵</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-200 transition">
              <X size={14} />
            </button>
          </div>
          <div className="p-3 space-y-2">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{s.description}</span>
                <div className="flex items-center gap-0.5">
                  {s.keys.map((k, j) => (
                    <React.Fragment key={j}>
                      {j > 0 && <span className="text-[10px] text-gray-300 mx-0.5">+</span>}
                      <kbd className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded shadow-sm">
                        {k}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${
          open
            ? 'bg-indigo-600 text-white shadow-indigo-200'
            : 'bg-white text-gray-500 hover:text-indigo-600 hover:shadow-xl border border-gray-200'
        }`}
        title="快捷鍵說明"
      >
        <Keyboard size={18} />
      </button>
    </div>
  );
}
