// client/src/Components/OtpModal.jsx
import React, { useState } from 'react';
import '../Styles/otp.css';
import { useTranslation, Trans } from 'react-i18next';

export default function OtpModal({ target, onSubmit, onClose }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(t('errors.otp.invalidCodeFormat'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit(code);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="otp-backdrop" role="dialog" aria-modal="true" aria-labelledby="otp-title">
      <div className="otp-modal">
        <button
          className="otp-close"
          onClick={onClose}
          aria-label={t('otp.close')}
          title={t('otp.close')}
        >
          ×
        </button>

        <h3 id="otp-title">{t('otp.title')}</h3>

        <p>
          <Trans i18nKey="otp.desc" values={{ target }} components={{ b: <b /> }} />
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder={t('otp.placeholder')}
            className="otp-input"
            autoFocus
            aria-label={t('otp.placeholder')}
          />

          {error && <div className="otp-error" role="alert">{error}</div>}

          <button className="otp-submit" type="submit" disabled={loading}>
            {loading ? t('otp.checking') : t('otp.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
