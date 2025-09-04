import React, { useEffect, useState } from 'react';
import i18n from '../i18n';

const langs = [
  { code: 'uk', label: 'UA' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' } // добавим позже тексты — кнопка уже есть
];

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [lng, setLng] = useState(i18n.language || 'ru');

  useEffect(() => {
    const onChange = (l) => setLng(l);
    i18n.on('languageChanged', onChange);
    return () => i18n.off('languageChanged', onChange);
  }, []);

  const change = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem('lang', code);
    setOpen(false);
  };

  return (
    <div style={{
      position: 'fixed',
      left: 16, bottom: 16, zIndex: 9999
    }}>
      {/* меню */}
      {open && (
        <div style={{
          marginBottom: 8,
          background: '#fff',
          border: '1px solid rgba(31,45,58,0.15)',
          boxShadow: '0 8px 24px rgba(31,45,58,0.12)',
          borderRadius: 12,
          overflow: 'hidden',
          minWidth: 120
        }}>
          {langs.map(x => (
            <button key={x.code}
              onClick={() => change(x.code)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                textAlign: 'left',
                background: lng === x.code ? '#f2f6fc' : '#fff',
                border: 'none',
                cursor: 'pointer'
              }}>
              {x.label}
            </button>
          ))}
        </div>
      )}

      {/* кнопка */}
      <button
        aria-label="Change language"
        onClick={() => setOpen(v => !v)}
        style={{
          width: 56, height: 56, borderRadius: 14,
          background: '#1f2d3a', color: '#fff',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(31,45,58,0.18)'
        }}
        title="Язык / Language"
      >
        {/* простая иконка переводчика */}
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
          <path d="M3 5h8a1 1 0 0 1 1 1v4h2V6a3 3 0 0 0-3-3H3a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h6v-2H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>
          <path d="M14 11h7a1 1 0 0 1 1 1v7c0 .55-.45 1-1 1h-7a1 1 0 0 1-1-1v-7c0-.55.45-1 1-1zm2.1 6.2h3.8l-1.9-5.1-1.9 5.1zM8 7h2v2H8v2H6V9H4V7h2V5h2v2z"/>
        </svg>
      </button>
    </div>
  );
}
