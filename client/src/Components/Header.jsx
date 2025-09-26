// client/src/Components/Header.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { flagByLang } from './Flag';
import TranslateIcon from '../assets/translator.png';

// базовые стили из фигмы
import '../Styles/header.css';

export default function Header() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, refresh } = useAuth();

  const tt = (key, fallback) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  useEffect(() => {
    if (!user) return;
    const ping = () =>
      fetch('http://localhost:5050/api/heartbeat', { method: 'POST', credentials: 'include' }).catch(() => {});
    ping();
    const id = setInterval(ping, 20000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem('i18nextLng');
    if (saved && saved !== i18n.language) i18n.changeLanguage(saved);
  }, [i18n]);

  const changeLang = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
  };

  const handleLogout = async () => {
    await fetch('http://localhost:5050/api/logout', { method: 'POST', credentials: 'include' });
    await refresh();
    navigate('/');
  };

  const [q, setQ] = useState('');
  const onSearch = (e) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const langs = useMemo(
    () => [
      { code: 'uk', label: tt('lang.uk', 'Українська') },
      { code: 'ru', label: tt('lang.ru', 'Русский') },
      { code: 'en', label: tt('lang.en', 'English') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language]
  );

  const langBtnRef = useRef(null);
  const menuRef = useRef(null);            // FIX: ref для поповера
  const [langOpen, setLangOpen] = useState(false);
  const [langPos, setLangPos] = useState({ left: 0, top: 0 });

  const onToggleLang = () => {
    if (!langBtnRef.current) return;
    const r = langBtnRef.current.getBoundingClientRect();
    setLangPos({ left: r.left, top: r.bottom + 8 });
    setLangOpen((v) => !v);
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (!langOpen) return;

      const path =
        (typeof e.composedPath === 'function' && e.composedPath()) ||
        e.path ||
        [];

      // FIX: не закрывать, если клик внутри кнопки ИЛИ внутри поповера
      if (path.includes(langBtnRef.current) || path.includes(menuRef.current)) {
        return;
      }
      setLangOpen(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setLangOpen(false);

    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [langOpen]);

  const avatarUrl = user?.avatar_url
    ? String(user.avatar_url).startsWith('http')
      ? user.avatar_url
      : `http://localhost:5050${user.avatar_url}`
    : null;

  return (
    <div className="hdr-wrap">
      <header className="hdr" role="banner">
        <div className="hdr-bg" />

        {/* LOGO */}
        <NavLink to="/" className="logo" aria-label="Home">
          <span className="logo-text">Qonto</span>
          <span className="logo-dot" aria-hidden="true" />
        </NavLink>

        {/* SEARCH */}
        <form className="search-wrap" onSubmit={onSearch} role="search">
          <input
            className="search-input"
            type="search"
            placeholder={tt('search.placeholder', 'Пошук товарів…')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="search-btn" type="submit" aria-label={tt('search.search', 'Знайти')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </form>

        {/* AI */}
        <button className="btn-ai" type="button" onClick={() => navigate('/ai')} title="AI">
          <span className="ai-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7AD293" strokeWidth="2">
              <rect x="3" y="7" width="18" height="12" rx="3" />
              <circle cx="9" cy="13" r="1.5" />
              <circle cx="15" cy="13" r="1.5" />
              <path d="M12 7V4" />
            </svg>
          </span>
          <span className="ai-label">AI</span>
        </button>

        {/* КАТАЛОГ */}
        <NavLink to="/catalog" className="btn-cat" title={tt('catalog.catalog', 'Каталог')}>
          <span className="cat-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7AD293" strokeWidth="2">
              <rect x="4" y="4" width="6" height="6" rx="1" />
              <rect x="14" y="4" width="6" height="6" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <rect x="14" y="14" width="6" height="6" rx="1" />
            </svg>
          </span>
          <span className="cat-label">{tt('catalog.title', 'Каталог')}</span>
        </NavLink>

        {/* Язык */}
        <button
          ref={langBtnRef}
          className="ico ico-lang"
          type="button"
          onClick={onToggleLang}
          aria-haspopup="menu"
          aria-expanded={langOpen}
          title={tt('currency.change', 'Змінити мову')}
        >
          <img src={TranslateIcon} alt="" width="18" height="18" style={{ display: 'block' }} />
        </button>

        {/* Избранное */}
        <NavLink to="/favorites" className="ico ico-heart" title={tt('favorites', 'Обране')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#ECECEC" strokeWidth="2" aria-hidden="true">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-8.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </NavLink>

        {/* Корзина */}
        <NavLink
          to="/cart"
          className="ico ico-cart"
          aria-label={tt('cart.cart', 'Кошик')}
          title={tt('cart.cart', 'Кошик')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#ECECEC" strokeWidth="2" aria-hidden="true">
            <circle cx="9" cy="21" r="1.5" />
            <circle cx="17" cy="21" r="1.5" />
            <path d="M3 3h2l2.5 12h11l2-8H7" />
          </svg>
        </NavLink>

        {/* Профиль / Вход */}
        {user ? (
          <button className="ico-user" type="button" onClick={() => navigate('/profile')} title={tt('nav.profile', 'Профіль')}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4, display: 'block' }}
              />
            ) : (
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            )}
          </button>
        ) : (
          <NavLink to="/auth" className="ico-user" title={tt('auth.login', 'Увійти')}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </NavLink>
        )}

        {/* Выпадашка языка */}
        {langOpen && (
          <div
            ref={menuRef}                   // FIX: привязка ref к поповеру
            role="menu"
            style={{
              position: 'fixed',
              left: langPos.left,
              top: langPos.top,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 6,
              minWidth: 180,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 9999,
            }}
          >
            {langs.map(({ code, label }) => {
              const active = i18n.language.startsWith(code);
              return (
                <button
                  key={code}
                  onClick={() => {
                    changeLang(code);
                    setLangOpen(false);
                  }}
                  role="menuitem"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    border: 'none',
                    background: active ? '#f3f4f6' : 'transparent',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontWeight: active ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1, transform: 'translateY(1px)' }}>
                    {flagByLang(code)}
                  </span>
                  {label}
                </button>
              );
            })}
            {user && (
              <button
                onClick={handleLogout}
                style={{
                  marginTop: 6,
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 10,
                  cursor: 'pointer',
                  color: '#b91c1c',
                  fontWeight: 600,
                }}
              >
                {tt('auth.logout', 'Вийти')}
              </button>
            )}
          </div>
        )}
      </header>
    </div>
  );
}
