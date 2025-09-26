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
    <div className="profilecard-wrap">
      <div className="card card-large">
        <h3 className="mt-0">{t('profile.title')}</h3>

        <div className="form-grid">
          <input
            placeholder={t('forms.firstName')}
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            className="text-input"
            aria-label={t('forms.firstName')}
          />
          <input
            placeholder={t('forms.lastName')}
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            className="text-input"
            aria-label={t('forms.lastName')}
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="text-input"
            aria-label="Email"
          />

          <button
            onClick={saveProfile}
            disabled={saving}
            className="btn-save"
            aria-busy={saving}
            aria-label={saving ? t('profile.saving') : t('profile.save')}
            title={saving ? t('profile.saving') : t('profile.save')}
          >
            {saving ? t('profile.saving') : t('profile.save')}
          </button>

          {msg && <div className="msg-ok" role="status">{msg}</div>}
          {err && <div className="msg-err" role="alert">{err}</div>}
        </div>
      </div>

      {/* Блок привязки телефона и пароля для входа по телефону */}
      <div className="card card-large">
        <PhoneBinder />
      </div>
    </div>
  );
}
