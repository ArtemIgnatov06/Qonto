import React, { useEffect, useState } from 'react';
import i18n from '../i18n';
import '../Styles/LanguageSwitcher.css';

const langs = [
  { code: 'uk', label: 'UA' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
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
    <div className="lang-switcher">
      {open && (
        <div className="lang-switcher__menu" role="menu" aria-label="Language menu">
          {langs.map((x) => (
            <button
              key={x.code}
              onClick={() => change(x.code)}
              className={`lang-switcher__item${lng === x.code ? ' is-active' : ''}`}
              role="menuitem"
            >
              {x.label}
            </button>
          ))}
        </div>
      )}

      <button
        aria-label="Change language"
        title="Язык / Language"
        onClick={() => setOpen((v) => !v)}
        className="lang-switcher__btn"
      >
        <svg
          viewBox="0 0 24 24"
          width="26"
          height="26"
          fill="currentColor"
          aria-hidden="true"
          className="lang-switcher__icon"
        >
          <path d="M3 5h8a1 1 0 0 1 1 1v4h2V6a3 3 0 0 0-3-3H3a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h6v-2H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>
          <path d="M14 11h7a1 1 0 0 1 1 1v7c0 .55-.45 1-1 1h-7a1 1 0 0 1-1-1v-7c0-.55.45-1 1-1zm2.1 6.2h3.8l-1.9-5.1-1.9 5.1zM8 7h2v2H8v2H6V9H4V7h2V5h2v2z"/>
        </svg>
      </button>
    </div>
  );
}
