// client/src/Pages/Profile.jsx — refined per feedback
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../Styles/Profile.css';
import { useAuth } from '../Hooks/useAuth';
import PhoneBinder from '../Components/PhoneBinder';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Profile = () => {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', contact_email: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [showEdit, setShowEdit] = useState(false); // <-- toggle editor

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name : user.last_name  || '',
        email     : user.email      || '',
        contact_email: user.contact_email || '',
      });
    }
  }, [user]);

  const handleLogout = async () => {
    await fetch('http://localhost:5050/api/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  };

  const saveProfile = async () => {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const { data } = await axios.post('/api/me/update-profile', form, { withCredentials: true });
      if (data.ok) { setMsg(t('profile.saved')); await refresh(); setShowEdit(false); }
      else setErr(data.error || t('profile.saveFailed'));
    } catch (e) {
      setErr(e?.response?.data?.error || t('profile.saveFailed'));
    } finally { setSaving(false); }
  };

  const goApply = () => navigate('/seller/apply');

  if (!user) return <div className="container">...</div>;

  const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ') || t('profile.noName', { defaultValue: 'Без имени' });

  return (
    <main className="container page-grid">
      {/* === Sidebar (left) === */}
      <aside className="sidebar" aria-label="Панель профілю">
        <div className="profile">
          <div className="avatar-lg" aria-hidden="true">👤</div>
          <div className="role">{t('profile.roleBuyer', { defaultValue: 'Покупець' })}</div>
          <h1 className="username">{fullName}</h1>
          <div className="profile-actions">
            <button className="btn btn-primary" type="button" onClick={() => setShowEdit(v => !v)}>
              {showEdit ? (t('common.close', { defaultValue: 'Закрыть' })) : (t('profile.edit', { defaultValue: 'Редагувати профіль' }))}
            </button>
            <Link className="btn btn-ghost" to="/chat">{t('profile.chat', { defaultValue: 'Чати' })}</Link>
          </div>
          <div className="side-links mtop-8">
            <Link to="/cart" className="side-link underlined">{t('profile.cart', { defaultValue: 'Кошик' })}</Link>
            <Link to="/favorites" className="side-link underlined">{t('profile.wishlist', { defaultValue: 'Список бажань' })}</Link>
            <button className="side-link" onClick={handleLogout} style={{ textAlign: 'left', background: 'none', border: 0, padding: 0 }}>
              {t('profile.logout', { defaultValue: 'Вийти з профілю' })}
            </button>
          </div>
        </div>

        <section className="promo" aria-labelledby="promo-title">
          <h2 id="promo-title" className="promo-title">{t('seller.promo.title', { defaultValue: 'Відкрийте свій магазин та почніть свої перші продажі!' })}</h2>
          <div className="promo-illustration" aria-hidden="true"></div>
          {user?.seller_status !== 'approved' ? (
            <button className="btn btn-primary promo-btn" type="button" onClick={goApply} disabled={user?.seller_status === 'pending'}>
              { user?.seller_status === 'pending' ? t('seller.status.pending', { defaultValue: 'Заявка отправлена' }) : t('seller.actions.become', { defaultValue: 'Стати продавцем' }) }
            </button>
          ) : (
            <button className="btn btn-primary promo-btn" type="button" onClick={() => navigate('/product/new')}>
              { t('seller.actions.addProduct', { defaultValue: 'Додати товар' }) }
            </button>
          )}
          {user?.seller_status === 'rejected' && user.seller_rejection_reason && (
            <p className="muted mt-8">{t('seller.status.reason')}: {user.seller_rejection_reason}</p>
          )}
        </section>

        {/* Убрали лишнюю кнопку "Чаты" под промо */}
      </aside>

      {/* === Content (right) === */}
      <section className="content">
        {/* Редактирование профиля (по требованию — здесь же в контенте) */}
        {showEdit && (
          <div className="card mb-16">
            <div className="grid-2 gap-16">
              <div>
                <label className="label">{t('profile.firstName', { defaultValue: 'Имя' })}</label>
                <input className="input" value={form.first_name} onChange={e=>setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('profile.lastName', { defaultValue: 'Фамилия' })}</label>
                <input className="input" value={form.last_name} onChange={e=>setForm({ ...form, last_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={e=>setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('profile.contactEmail', { defaultValue: 'Почта для связи' })}</label>
                <input className="input" type="email" value={form.contact_email} onChange={e=>setForm({ ...form, contact_email: e.target.value })} />
              </div>
            </div>

            {/* Перенёс сюда блок изменения телефона/пароля */}
            <div className="mt-16">
              <PhoneBinder />
            </div>

            <div className="row gap-12 mt-16">
              <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                {saving ? t('common.saving', { defaultValue: 'Сохранение…' }) : t('common.save', { defaultValue: 'Сохранить' })}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>
                {t('common.cancel', { defaultValue: 'Отмена' })}
              </button>
            </div>
            {msg && <div className="msg-ok mt-8" role="status">{msg}</div>}
            {err && <div className="msg-err mt-8" role="alert">{err}</div>}
          </div>
        )}

        <header className="section-head">
          <h2 className="section-title">{t('orders.my', { defaultValue: 'Мої замовлення' })}</h2>
          <Link className="section-link" to="/orders">{t('orders.all', { defaultValue: 'Всі замовлення →' })}</Link>
        </header>

        <div className="card-grid">
          <Link className="order-card order-card--ready" to="/orders?tab=ready">
            <div className="thumb" aria-hidden="true"></div>
            <div className="order-meta">
              <div className="order-status ok">{t('orders.status.ready', { defaultValue: 'Готово' })}</div>
              <div className="order-sub">8 серпня, Пт</div>
              <div className="order-note">{t('orders.pickup', { defaultValue: 'Можна забирати до 16 серпня, Сб' })}</div>
            </div>
          </Link>

          {[1,2,3].map(i => (
            <Link key={i} className="order-card" to="/orders?tab=onway">
              <div className="thumb" aria-hidden="true"></div>
              <div className="order-meta">
                <div className="order-status">{t('orders.status.onway', { defaultValue: 'В дорозі' })}</div>
                <div className="order-sub">{t('orders.expected', { defaultValue: 'Очікується:' })}</div>
                <div className="order-note ok">9 серпня, Сб</div>
              </div>
            </Link>
          ))}
        </div>

        <header className="section-head mt-32">
          <h2 className="section-title">{t('orders.history', { defaultValue: 'Історія замовлень' })}</h2>
          <Link className="section-link" to="/orders/history">{t('orders.allHistory', { defaultValue: 'Вся історія →' })}</Link>
        </header>

        <div className="card-grid card-grid--wrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <Link key={i} className="order-card" to={`/orders/${i+1}`}>
              <div className="thumb" aria-hidden="true"></div>
              <div className="order-meta">
                <div className="order-status">{t('orders.status.delivered', { defaultValue: 'Доставлено' })}</div>
                <div className="order-sub">9 серпня, Сб</div>
                <div className="order-note">{t('orders.deliveredOn', { defaultValue: 'Було забрано 10 серпня, Сб' })}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Profile;
