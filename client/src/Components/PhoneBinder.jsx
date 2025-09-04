// client/src/Components/PhoneBinder.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

export default function PhoneBinder() {
  const { t } = useTranslation();
  const [me, setMe] = useState(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get('/api/me', { withCredentials: true })
      .then(({ data }) => {
        setMe(data.user);
        setPhone(data.user?.phone || '');
      });
  }, []);

  if (me === null) return null;

  async function save() {
    setMsg(null); setErr(null); setLoading(true);
    try {
      const { data } = await axios.post(
        '/api/me/update-phone',
        { phone, password },
        { withCredentials: true }
      );
      if (data.ok) {
        setMsg(t('phoneBinder.saved'));
        setPassword('');
      } else {
        setErr(data.error || t('phoneBinder.saveFailed'));
      }
    } catch (e) {
      setErr(e?.response?.data?.error || t('phoneBinder.saveFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card phone-card" aria-label={t('phoneBinder.cardAria')}>
      <h3 style={{ marginTop: 0 }}>{t('phoneBinder.title')}</h3>

      <input
        type="tel"
        placeholder={t('phoneBinder.phonePlaceholder')}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: 10, marginBottom: 8 }}
        aria-label={t('phoneBinder.phonePlaceholder')}
      />

      <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
        {t('phoneBinder.hint')}
      </div>

      <input
        type="password"
        placeholder={t('phoneBinder.passwordPlaceholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: 10 }}
        aria-label={t('phoneBinder.passwordPlaceholder')}
      />

      <button
        onClick={save}
        disabled={loading}
        style={{ marginTop: 10, width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer' }}
        aria-busy={loading}
        aria-label={loading ? t('phoneBinder.saving') : t('phoneBinder.save')}
        title={loading ? t('phoneBinder.saving') : t('phoneBinder.save')}
      >
        {loading ? t('phoneBinder.saving') : t('phoneBinder.save')}
      </button>

      {msg && <div style={{ color: '#0a7d16', marginTop: 8 }} role="status">{msg}</div>}
      {err && <div style={{ color: '#b00020', marginTop: 8 }} role="alert">{err}</div>}
    </div>
  );
}
