// client/src/Pages/Profile.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../Styles/profile.css';
import { useAuth } from '../Hooks/useAuth';
import PhoneBinder from '../Components/PhoneBinder';
import { useNavigate } from 'react-router-dom';
import UserProducts from '../Components/UserProducts'; // 👈 подключаем компонент

const Profile = () => {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  if (!user) return <div className="profile-page">Не авторизован</div>;

  const handleLogout = async () => {
    await fetch('http://localhost:5050/api/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  };

  const saveProfile = async () => {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const { data } = await axios.post('/api/me/update-profile', form, { withCredentials: true });
      if (data.ok) { setMsg('Данные профиля сохранены'); await refresh(); }
      else setErr(data.error || 'Не удалось сохранить профиль');
    } catch (e) {
      setErr(e?.response?.data?.error || 'Не удалось сохранить профиль');
    } finally { setSaving(false); }
  };

  const goApply = () => navigate('/seller/apply');

  return (
    <div className="profile-page">
      <h2>Профиль</h2>

      {/* двухколоночная сетка */}
      <div className="profile-grid">
        {/* левая колонка — профиль + выход */}
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

          <div className="profile-actions">
            <button className="btn-primary" onClick={saveProfile} disabled={saving}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
            <button className="btn-logout" onClick={handleLogout}>
              Выйти
            </button>
          </div>

          {msg && <div className="msg success">{msg}</div>}
          {err && <div className="msg error">{err}</div>}
        </div>

        {/* правая колонка — телефон → статус → CTA */}
        <div className="profile-right-col">
          <PhoneBinder />

          {['pending', 'approved', 'rejected'].includes(user?.seller_status) && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Статус заявки продавца</h3>

              {user.seller_status === 'pending' && (
                <>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>⏳ Заявка на рассмотрении</div>
                  <p className="muted" style={{ marginTop: 4 }}>
                    Мы уведомим вас, как только решение будет принято.
                  </p>
                </>
              )}

              {user.seller_status === 'approved' && (
                <>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>✅ Ваша заявка принята</div>
                  <p className="muted" style={{ marginTop: 4 }}>
                    Теперь вы можете выставлять свои товары на продажу.
                  </p>
                  {/* КНОПКА ДОБАВЛЕНИЯ ТОВАРА */}
                  <div style={{ marginTop: 8 }}>
                    <button className="btn-primary" onClick={() => navigate('/products/new')}>
                      Добавить товар
                    </button>
                  </div>
                </>
              )}

              {user.seller_status === 'rejected' && (
                <>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>❌ Заявка отклонена</div>
                  {user.seller_rejection_reason && (
                    <p className="muted" style={{ marginTop: 4 }}>
                      Причина: {user.seller_rejection_reason}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                    <button className="btn-primary" onClick={goApply}>
                      Подать заявку заново
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {user?.seller_status !== 'approved' && (
            <div className="card">
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

          {/* 👇 Блок "Мои товары" — только если продавец одобрен */}
          {user?.seller_status === 'approved' && (
            <div className="card" style={{ marginTop: 20 }}>
              <h3 style={{ marginTop: 0 }}>Мои товары</h3>
              <UserProducts />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
