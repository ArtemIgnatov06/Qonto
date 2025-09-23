// client/src/Components/ProfileCard.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PhoneBinder from './PhoneBinder';
import { useTranslation } from 'react-i18next';
import '../Styles/ProfileCard.css';

export default function ProfileCard() {
  const { t } = useTranslation();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    axios.get('/api/me', { withCredentials: true }).then(({ data }) => {
      const u = data.user || {};
      setMe(u);
      setForm({
        first_name: u.first_name || '',
        last_name:  u.last_name  || '',
        email:      u.email      || '',
      });
    });
  }, []);

  if (me === null) return null;

  async function saveProfile() {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const { data } = await axios.post('/api/me/update-profile', form, { withCredentials: true });
      if (data.ok) {
        setMsg(t('profile.saved'));
        setMe(data.user);
      } else {
        setErr(data.error || t('profile.saveFailed'));
      }
    } catch (e) {
      setErr(e?.response?.data?.error || t('profile.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr', maxWidth: 980, margin: '0 auto' }}>
      <div className="card" style={{ padding: 20, border: '1px solid #eee', borderRadius: 14 }}>
        <h3 className="mt-0">{t('profile.title')}</h3>

        <div style={{ display: 'grid', gap: 8 }}>
          <input
            placeholder={t('forms.firstName')}
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            style={{ padding: '10px', border: '1px solid #ddd', borderRadius: 10 }}
            aria-label={t('forms.firstName')}
          />
          <input
            placeholder={t('forms.lastName')}
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            style={{ padding: '10px', border: '1px solid #ddd', borderRadius: 10 }}
            aria-label={t('forms.lastName')}
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ padding: '10px', border: '1px solid #ddd', borderRadius: 10 }}
            aria-label="Email"
          />

          <button
            onClick={saveProfile}
            disabled={saving}
            style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer' }}
            aria-busy={saving}
            aria-label={saving ? t('profile.saving') : t('profile.save')}
            title={saving ? t('profile.saving') : t('profile.save')}
          >
            {saving ? t('profile.saving') : t('profile.save')}
          </button>

          {msg && <div style={{ color: '#0a7d16' }} role="status">{msg}</div>}
          {err && <div style={{ color: '#b00020' }} role="alert">{err}</div>}
        </div>
      </div>

      {/* Блок привязки телефона и пароля для входа по телефону */}
      <div className="card" style={{ padding: 20, border: '1px solid #eee', borderRadius: 14 }}>
        <PhoneBinder />
      </div>
    </div>
  );
}