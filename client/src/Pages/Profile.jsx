// client/src/Pages/Profile.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../Styles/profile.css';
import { useAuth } from '../Hooks/useAuth';
import PhoneBinder from '../Components/PhoneBinder';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Profile = () => {
  const { t } = useTranslation();
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

  useEffect(() => {
    document.title = t('meta.title.profile');
  }, [t]);

  if (!user) return <div className="profile-page">{t('auth.required')}</div>;

  const handleLogout = async () => {
    await fetch('http://localhost:5050/api/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  };

  const saveProfile = async () => {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const { data } = await axios.post('/api/me/update-profile', form, { withCredentials: true });
      if (data.ok) { setMsg(t('profile.saved')); await refresh(); }
      else setErr(data.error || t('profile.saveFailed'));
    } catch (e) {
      setErr(e?.response?.data?.error || t('profile.saveFailed'));
    } finally { setSaving(false); }
  };

  const goApply = () => navigate('/seller/apply');

  return (
    <div className="profile-page">
      <h2>{t('profile.title')}</h2>

      {/* двухколоночная сетка */}
      <div className="profile-grid">
        {/* левая колонка — профиль + выход */}
        <div className="card profile-card">
          <div className="form-row">
            <label>{t('forms.firstName')}</label>
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              placeholder={t('forms.firstName')}
              aria-label={t('forms.firstName')}
            />
          </div>
          <div className="form-row">
            <label>{t('forms.lastName')}</label>
            <input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              placeholder={t('forms.lastName')}
              aria-label={t('forms.lastName')}
            />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              aria-label="Email"
            />
          </div>

          <div className="profile-actions">
            <button className="btn-primary" onClick={saveProfile} disabled={saving} aria-busy={saving}>
              {saving ? t('profile.saving') : t('profile.save')}
            </button>
            <button className="btn-logout" onClick={handleLogout}>
              {t('auth.logout')}
            </button>
          </div>

          {msg && <div className="msg success" role="status">{msg}</div>}
          {err && <div className="msg error" role="alert">{err}</div>}
        </div>

        {/* правая колонка — телефон → статус → CTA */}
        <div className="profile-right-col">
          <PhoneBinder />

          {['pending', 'approved', 'rejected'].includes(user?.seller_status) && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>{t('seller.status.title')}</h3>

              {user.seller_status === 'pending' && (
                <>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>⏳ {t('seller.status.pending')}</div>
                  <p className="muted" style={{ marginTop: 4 }}>
                    {t('seller.status.pendingHint')}
                  </p>
                </>
              )}

              {user.seller_status === 'approved' && (
                <>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>✅ {t('seller.status.approved')}</div>
                  <p className="muted" style={{ marginTop: 4 }}>
                    {t('seller.status.approvedHint')}
                  </p>
                  <div style={{ marginTop: 8 }}>
                    {/* исправлено: путь формы добавления товара */}
                    <button className="btn-primary" onClick={() => navigate('/product/new')}>
                      {t('seller.actions.addProduct')}
                    </button>
                  </div>
                </>
              )}

              {user.seller_status === 'rejected' && (
                <>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>❌ {t('seller.status.rejected')}</div>
                  {user.seller_rejection_reason && (
                    <p className="muted" style={{ marginTop: 4 }}>
                      {t('seller.status.reason')}: {user.seller_rejection_reason}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                    <button className="btn-primary" onClick={goApply}>
                      {t('seller.actions.applyAgain')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {user?.seller_status !== 'approved' && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>{t('seller.become.title')}</h3>
              <p className="muted" style={{ marginTop: 4 }}>
                {t('seller.become.text')}
              </p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <button
                  className="btn-primary"
                  onClick={goApply}
                  disabled={user?.seller_status === 'pending'}
                >
                  {user?.seller_status === 'pending'
                    ? t('seller.actions.pending')
                    : t('seller.actions.become')}
                </button>
                {user?.seller_status === 'rejected' && (
                  <span style={{ color: '#6b7280' }}>
                    {t('seller.become.rejectedNote')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Заменили длинный список на одну кнопку */}
          {user?.seller_status === 'approved' && (
            <div className="card" style={{ marginTop: 20 }}>
              <h3 style={{ marginTop: 0 }}>
                {t('profile.myProducts.title', { defaultValue: 'Мои товары' })}
              </h3>
              <p className="muted" style={{ marginTop: 4 }}>
                {t('profile.myProducts.hint', {
                  defaultValue: 'Смотрите и редактируйте ваши товары на отдельной странице.'
                })}
              </p>
              <Link className="btn-primary" to="/my/products">
                {t('profile.myProducts.open', { defaultValue: 'Открыть список' })}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
