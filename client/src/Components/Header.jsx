// client/src/Components/Header.jsx
import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import ReactLogo from './logo192.png';
import CartBadge from '../Components/CartBadge';
import { useTranslation } from 'react-i18next';
import { useCurrency, SUPPORTED } from '../contexts/CurrencyContext.jsx';
import { flagByCurrency, flagByLang } from './Flag';
import { authSocket } from '../lib/socket';

import TranslateIcon from '../assets/translator.png';
import '../Styles/Header.css';

const langs = [
  { code: 'uk', labelKey: 'lang.uk' },
  { code: 'ru', labelKey: 'lang.ru' },
  { code: 'en', labelKey: 'lang.en' },
];

function LanguageButton({ i18n, t, onChange }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      const path = e.composedPath?.() || [];
      if (!path.includes(menuRef.current) && !path.includes(btnRef.current)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="lang-wrap">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Change language"
        title={t('nav.profile')}
        className="lang-btn"
      >
        <img src={TranslateIcon} alt="" width={20} height={20} className="lang-icon" />
      </button>

      {open && (
        <div ref={menuRef} role="menu" className="lang-menu">
          {langs.map(({ code, labelKey }) => (
            <button
              key={code}
              onClick={() => {
                onChange(code);
                setOpen(false);
              }}
              role="menuitem"
              className={`lang-item ${i18n.language.startsWith(code) ? 'active' : ''}`}
            >
              <span className="flag-14">{flagByLang(code)}</span>
              {t(labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Селектор валют
function CurrencySelect({ t }) {
  const { currency, setCurrency, isLoading, error } = useCurrency();

  return (
    <div className="currency-switcher" title={t('currency.change') || 'Сменить валюту'}>
      <label htmlFor="currency-select" className="currency-label">
        {t('currency.label') || 'Валюта'}
      </label>

      <span aria-hidden="true" className="currency-flag">
        {flagByCurrency(currency)}
      </span>

      <select
        id="currency-select"
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="currency-select"
      >
        {SUPPORTED.map((v) => (
          <option key={v.code} value={v.code}>
            {v.label}
          </option>
        ))}
      </select>
      {isLoading && <span className="currency-loading">…</span>}
      {error && (
        <span className="currency-error" title={error}>
          !
        </span>
      )}
    </div>
  );
}

const Header = () => {
  const { t, i18n } = useTranslation();
  const { user, refresh } = useAuth();
  const [unread, setUnread] = useState(0);

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
    window.location.href = '/';
  };

  // heartbeat
  useEffect(() => {
    if (!user) return;
    const tick = () =>
      fetch('http://localhost:5050/api/heartbeat', { method: 'POST', credentials: 'include' }).catch(() => {});
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, [user]);

  // unread via socket
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    fetch('http://localhost:5050/api/chats/unread-count', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setUnread(d.count || 0))
      .catch(() => {});
    const s = authSocket(user.id);
    const onAdd = (p) => setUnread((x) => Math.max(0, x + (p?.delta || 0)));
    const onReplace = (p) => setUnread(p?.total ?? 0);
    s.on('chat:unread', onAdd);
    s.on('chat:unread:replace', onReplace);
    return () => {
      s.off('chat:unread', onAdd);
      s.off('chat:unread:replace', onReplace);
    };
  }, [user]);

  const avatarUrl = user?.avatar_url
    ? (String(user.avatar_url).startsWith('http') ? user.avatar_url : `http://localhost:5050${user.avatar_url}`)
    : null;

  const userLetter =
    user?.first_name?.[0]?.toUpperCase() ||
    user?.username?.[0]?.toUpperCase() ||
    'U';

  return (
    <header className="header-bar">
      {/* Левый блок: логотип + меню */}
      <nav className="row-center gap-16">
        <img src={ReactLogo} alt="Logo" className="logo" />

        <NavLink to="/" end className={({ isActive }) => `brow-link${isActive ? ' active' : ''}`}>
          {t('nav.home')}
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => `brow-link${isActive ? ' active' : ''}`}>
          {t('nav.about')}
        </NavLink>
        <NavLink to="/contacts" className={({ isActive }) => `brow-link${isActive ? ' active' : ''}`}>
          {t('nav.contacts')}
        </NavLink>

        {user && (
          <NavLink to="/chats" className={({ isActive }) => `brow-link${isActive ? ' active' : ''}`}>
            {(t('chat.chats') || 'Чаты')}{unread > 0 ? ` (${unread})` : ''}
          </NavLink>
        )}

        <NavLink
          to="/cart"
          className={({ isActive }) => `brow-link${isActive ? ' active' : ''}`}
          title={t('cart.cart')}
        >
          <CartBadge />
        </NavLink>

        {user?.role === 'admin' && (
          <>
            <NavLink to="/admin/applications" className={({ isActive }) => `brow-link${isActive ? ' active' : ''}`}>
              {t('nav.adminApplications')}
            </NavLink>
            <NavLink to="/admin/product-deletions" className={({ isActive }) => `brow-link${isActive ? ' active' : ''}`}>
              {t('nav.adminDeletions')}
            </NavLink>
          </>
        )}

        {user && (
          <div className="user-box">
            <CurrencySelect t={t} />
            <LanguageButton i18n={i18n} t={t} onChange={changeLang} />
            <div
              onClick={() => (window.location.href = '/profile')}
              title={t('nav.profile')}
              className="avatar-btn"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="avatar-img" />
              ) : (
                userLetter
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Правый блок: Войти/Выйти */}
      <div className="row-center gap-10">
        {!user && (
          <>
            <CurrencySelect t={t} />
            <LanguageButton i18n={i18n} t={t} onChange={changeLang} />
          </>
        )}

        {user ? (
          <button onClick={handleLogout} className="btn-login pad-6-12">
            {t('auth.logout')}
          </button>
        ) : (
          <NavLink to="/auth">
            <button className="btn-login">{t('auth.login')}</button>
          </NavLink>
        )}
      </div>
    </header>
  );
};

export default Header;
