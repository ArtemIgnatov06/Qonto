// client/src/Components/PhoneBinder.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import '../Styles/PhoneBinder.css';

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
      <h3 className="mt-0">{t('phoneBinder.title')}</h3>

      <input
        type="tel"
        placeholder={t('phoneBinder.phonePlaceholder')}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="input-full mb-8"
        aria-label={t('phoneBinder.phonePlaceholder')}
      />

      <div className="hint-text mb-6">
        {t('phoneBinder.hint')}
      </div>

      <input
        type="password"
        placeholder={t('phoneBinder.passwordPlaceholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="input-full"
        aria-label={t('phoneBinder.passwordPlaceholder')}
      />

      <button
        onClick={save}
        disabled={loading}
        className="btn-full mt-10"
        aria-busy={loading}
        aria-label={loading ? t('phoneBinder.saving') : t('phoneBinder.save')}
        title={loading ? t('phoneBinder.saving') : t('phoneBinder.save')}
      >
        {loading ? t('phoneBinder.saving') : t('phoneBinder.save')}
      </button>

      {msg && <div className="msg-ok mt-8" role="status">{msg}</div>}
      {err && <div className="msg-err mt-8" role="alert">{err}</div>}
    </div>
  );
}
