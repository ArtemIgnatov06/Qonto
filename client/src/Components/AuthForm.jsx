import React, { useState } from 'react';
import '../Styles/auth.css';

export const AuthForm = () => {
  const [mode, setMode] = useState('login'); // 'login' или 'register'
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    phone: '',
    email: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let endpoint = '';
    let payload = {};

    if (mode === 'login') {
      endpoint = '/api/login';
      if (!form.username || !form.password) {
        setError('Логин и пароль обязательны.');
        setLoading(false);
        return;
      }
      payload = {
        username: form.username,
        password: form.password
      };
    } else {
      endpoint = '/api/register';
      if (!form.firstName || !form.lastName || !form.username || !form.password || !form.phone || !form.email) {
        setError('Все поля для регистрации обязательны.');
        setLoading(false);
        return;
      }
      payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        username: form.username,
        password: form.password,
        phone: form.phone,
        email: form.email
      };
    }

    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        window.location.href = '/';
      }
    } catch (err) {
      setError('Ошибка соединения.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="mode-switch">
        <button
          type="button"
          className={mode === 'login' ? 'active' : ''}
          onClick={() => setMode('login')}
          disabled={mode === 'login'}
        >
          Вход
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'active' : ''}
          onClick={() => setMode('register')}
          disabled={mode === 'register'}
        >
          Регистрация
        </button>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === 'register' && (
          <>
            <input
              required
              name="firstName"
              placeholder="Имя"
              value={form.firstName}
              onChange={handleChange}
            />
            <input
              required
              name="lastName"
              placeholder="Фамилия"
              value={form.lastName}
              onChange={handleChange}
            />
          </>
        )}
        <input
          required
          name="username"
          placeholder="Логин"
          value={form.username}
          onChange={handleChange}
        />
        <input
          required
          type="password"
          name="password"
          placeholder="Пароль"
          value={form.password}
          onChange={handleChange}
        />
        {mode === 'register' && (
          <>
            <input
              required
              name="phone"
              placeholder="Телефон"
              value={form.phone}
              onChange={handleChange}
            />
            <input
              required
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
            />
          </>
        )}
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>
          {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </form>
    </div>
  );
};
