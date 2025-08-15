/* === ORIGINAL (для справки, что было) ===
import React, { useEffect } from 'react';
import '../Styles/profile.css';
import { useAuth } from '../Hooks/useAuth';

const Profile = () => {
  const { user, refresh } = useAuth();

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user) {
    return <div className="profile-page">Не авторизован</div>;
  }

  const handleLogout = async () => {
    await fetch('http://localhost:5000/api/logout', {
      method: 'POST',
      credentials: 'include'
    });
    window.location.href = '/';
  };

  return (
    <div className="profile-page">
      <h2>Профиль</h2>
      <div className="info">
        <p>
          <strong>Имя:</strong> {user.first_name}
        </p>
        <p>
          <strong>Фамилия:</strong> {user.last_name}
        </p>
        <p>
          <strong>Логин:</strong> {user.username}
        </p>
        <p>
          <strong>Телефон:</strong> {user.phone}
        </p>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
      </div>
      <button className="btn-logout" onClick={handleLogout}>
        Выйти
      </button>
    </div>
  );
};

export default Profile;
=== END ORIGINAL === */

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../Styles/profile.css';
import { useAuth } from '../Hooks/useAuth';
import PhoneBinder from '../Components/PhoneBinder';

const Profile = () => {
  const { user, refresh } = useAuth();

  // локальная форма редактирования (без логина)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  if (!user) {
    return <div className="profile-page">Не авторизован</div>;
  }

  const handleLogout = async () => {
    await fetch('http://localhost:5050/api/logout', {
      method: 'POST',
      credentials: 'include'
    });
    window.location.href = '/';
  };

  const saveProfile = async () => {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const { data } = await axios.post('/api/me/update-profile', form, { withCredentials: true });
      if (data.ok) {
        setMsg('Данные профиля сохранены');
        await refresh();
      } else {
        setErr(data.error || 'Не удалось сохранить профиль');
      }
    } catch (e) {
      setErr(e?.response?.data?.error || 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <h2>Профиль</h2>

      {/* Карточка редактирования профиля (ЛОГИН УДАЛЁН) */}
      <div className="card profile-card">
        <div className="form-row">
          <label>Имя</label>
          <input
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            placeholder="Имя"
          />
        </div>
        <div className="form-row">
          <label>Фамилия</label>
          <input
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            placeholder="Фамилия"
          />
        </div>
        <div className="form-row">
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
          />
        </div>

        <button className="btn-primary" onClick={saveProfile} disabled={saving}>
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
        {msg && <div className="msg success">{msg}</div>}
        {err && <div className="msg error">{err}</div>}
      </div>

      {/* Карточка привязки телефона и пароля для входа по телефону */}
      <PhoneBinder />

      <button className="btn-logout" onClick={handleLogout}>
        Выйти
      </button>
    </div>
  );
};

export default Profile;
