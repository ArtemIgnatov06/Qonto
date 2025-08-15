import React, { useState } from 'react';
import '../Styles/otp.css';

export default function OtpModal({ target, onSubmit, onClose }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError('Введите 6-значный код'); return; }
    setError(null); setLoading(true);
    try {
      await onSubmit(code);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="otp-backdrop">
      <div className="otp-modal">
        <button className="otp-close" onClick={onClose} aria-label="Закрыть">×</button>
        <h3>Введите код</h3>
        <p>Мы отправили 6-значный код на <b>{target}</b>.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            maxLength={6}
            value={code}
            onChange={(e)=>setCode(e.target.value.replace(/\D/g,''))}
            placeholder="123456"
            className="otp-input"
            autoFocus
          />
          {error && <div className="otp-error">{error}</div>}
          <button className="otp-submit" type="submit" disabled={loading}>
            {loading ? 'Проверяем...' : 'Подтвердить'}
          </button>
        </form>
      </div>
    </div>
  );
}
