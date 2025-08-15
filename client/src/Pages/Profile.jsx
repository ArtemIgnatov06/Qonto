// client/src/Pages/Profile.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../Styles/profile.css';
import { useAuth } from '../Hooks/useAuth';
import PhoneBinder from '../Components/PhoneBinder';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

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

  const goApply = () => navigate('/seller/apply');

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

      {/* CTA: Стать продавцом */}
      {user?.seller_status !== 'approved' && (
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Стать продавцом</h3>
          <p className="muted" style={{ marginTop: 4 }}>
            Оформите заявку, чтобы получить доступ к публикации товаров.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
            <button
              className="btn-primary"
              onClick={goApply}
              disabled={user?.seller_status === 'pending'}
            >
              {user?.seller_status === 'pending'
                ? 'Заявка на рассмотрении'
                : 'Стать продавцом'}
            </button>
            {user?.seller_status === 'rejected' && (
              <span style={{ color: '#6b7280' }}>
                Предыдущая заявка была отклонена — вы можете подать заново.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Карточка привязки телефона и пароля для входа по телефону */}
      <PhoneBinder />

      <button className="btn-logout" onClick={handleLogout}>
        Выйти
      </button>
    </div>
  );
};

export default Profile;
