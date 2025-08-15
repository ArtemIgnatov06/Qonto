// client/src/components/Header.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import ReactLogo from './logo192.png'; // путь к логотипу React

const Header = () => {
  const { user, refresh } = useAuth();

  const handleLogout = async () => {
    await fetch('http://localhost:5050/api/logout', {
      method: 'POST',
      credentials: 'include'
    });
    await refresh();
    window.location.href = '/';
  };

  return (
    <header
      className="header-bar"
      style={{
        display: 'flex',
        justifyContent: 'space-between', // распределяем левый и правый блоки по краям
        alignItems: 'center',
        padding: '12px 24px',
        background: '#f2f6fc',
        gap: 16,
      }}
    >
      {/* Левый блок: логотип React + меню + (если есть) аватар */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexGrow: 1, // занимает максимум слева
          minWidth: 0,  // чтобы не ломать layout при переполнении
        }}
      >
        <img
          src={ReactLogo}
          alt="React Logo"
          style={{ width: 36, height: 36, display: 'block', flexShrink: 0 }}
        />
        <NavLink to="/" end className={({ isActive }) => `brow-link${isActive ? ' active' : ''}`}>
          Домой
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => `brow-link${isActive ? ' active' : ''}`}>
          О нас
        </NavLink>
        <NavLink to="/contacts" className={({ isActive }) => `brow-link${isActive ? ' active' : ''}`}>
          Контакты
        </NavLink>
        {user && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              marginLeft: '24px',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: 14,
                userSelect: 'none',
              }}
              onClick={() => (window.location.href = '/profile')}
              title="Профиль"
            >
              {user.first_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase()}
            </div>
          </div>
        )}
      </nav>

      {/* Правый блок: кнопка Войти или Выйти */}
      <div
        style={{
          flexShrink: 0, // не сжимать
        }}
      >
        {user ? (
          <button onClick={handleLogout} className="btn-login" style={{ padding: '6px 12px' }}>
            Выйти
          </button>
        ) : (
          <NavLink to="/auth">
            <button className="btn-login">Войти</button>
          </NavLink>
        )}
      </div>
    </header>
  );
};

export default Header;
