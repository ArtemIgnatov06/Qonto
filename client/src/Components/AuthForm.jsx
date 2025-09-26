// Components/AuthForm.jsx
import React, { useState } from 'react';
import axios from 'axios';
import GoogleSignIn from './GoogleSignIn';
import OtpModal from './OtpModal';
import '../Styles/auth.css';
import { useTranslation } from 'react-i18next';

export const AuthForm = () => {
  const { t } = useTranslation();

  const [mode, setMode] = useState('login');          // 'login' | 'register'
  const [loginBy, setLoginBy] = useState('email');    // 'email' | 'phone' | 'phone_otp'

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // SMS-OTP
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        if (loginBy === 'email') {
          const { data } = await axios.post(
            '/api/login-email',
            { email: form.email, password: form.password },
            { withCredentials: true }
          );
          if (data.ok) { window.location.href = '/'; return; }
          setError(data.error || t('errors.loginFailed'));
        } else if (loginBy === 'phone') {
          const { data } = await axios.post(
            '/api/login-phone',
            { phone: form.phone, password: form.password },
            { withCredentials: true }
          );
          if (data.ok) { window.location.href = '/'; return; }
          setError(data.error || t('errors.loginFailed'));
        } else {
          // phone_otp
          if (!form.phone) { setError(t('errors.phoneRequired')); setLoading(false); return; }
          const { data } = await axios.post(
            '/api/auth/phone/start',
            { phone: form.phone },
            { withCredentials: true }
          );
          if (data.ok) {
            setSmsPhone(form.phone);
            setShowSmsModal(true);
          } else {
            setError(data.error || t('errors.smsSendFailed'));
          }
        }
      } else {
        const payload = {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          password: form.password,
        };
        const { data } = await axios.post('/api/register-email', payload, { withCredentials: true });
        if (data.ok) { alert(t('auth.registrationSuccess')); setMode('login'); }
        else setError(data.error || t('errors.registerFailed'));
      }
    } catch (e2) {
      setError(e2?.response?.data?.error || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  async function verifySms(code) {
    try {
      const { data } = await axios.post(
        '/api/auth/phone/verify',
        { phone: smsPhone, code },
        { withCredentials: true }
      );
      if (data.ok) {
        setShowSmsModal(false);
        window.location.href = '/';
      } else {
        alert(data.error || t('errors.invalidCode'));
      }
    } catch (e) {
      alert(e?.response?.data?.error || t('errors.codeVerifyError'));
    }
  }

  return (
    <div className="auth-stage" aria-label={t('auth.formAria')}>
      {/* Левая колонка — Sign in */}
      <section className="auth-box auth-box--left" aria-label={t('auth.loginTab')}>
        <h4 className="auth-left-title">{t('auth.loginTab')}</h4>

        {/* Переключатель способов входа */}
        <div className="login-switch" aria-hidden="false">
          <button
            type="button"
            className={loginBy === 'email' ? 'is-active' : ''}
            onClick={() => setLoginBy('email')}
          >
            {t('auth.byEmail')}
          </button>
          <button
            type="button"
            className={loginBy === 'phone' ? 'is-active' : ''}
            onClick={() => setLoginBy('phone')}
          >
            {t('auth.byPhonePass')}
          </button>
          <button
            type="button"
            className={loginBy === 'phone_otp' ? 'is-active' : ''}
            onClick={() => setLoginBy('phone_otp')}
          >
            {t('auth.byPhoneOtp')}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email / Телефон */}
          {loginBy !== 'phone' ? (
            <label className="auth-input-wrap auth-input-wrap--email">
              <input
                type="email"
                className="auth-input auth-input--email"
                placeholder="*Email"
                aria-label="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
          ) : (
            <label className="auth-input-wrap auth-input-wrap--email">
              <input
                className="auth-input auth-input--email"
                placeholder={t('forms.phone')}
                aria-label={t('forms.phone')}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
          )}

          {/* Пароль (не нужен для OTP) */}
          {loginBy !== 'phone_otp' && (
            <label className="auth-input-wrap auth-input-wrap--password">
              <input
                type="password"
                className="auth-input auth-input--password"
                placeholder={t('forms.password')}
                aria-label={t('forms.password')}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button type="button" className="auth-pass-toggle" aria-label="Toggle password">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" stroke="#35C65E" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="3" stroke="#35C65E" strokeWidth="1.5" />
                </svg>
              </button>
            </label>
          )}

          {error && <div className="error-block">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {t('auth.continue')} {/* в фигме — auth.continue, не "Войти" */}
          </button>
        </form>

        {/* Google */}
        <div className="auth-divider">
          <span className="auth-divider__text">{t('common.or')}</span>
          <div className="auth-google">
            <GoogleSignIn onSuccess={() => (window.location.href = '/')} />
          </div>
        </div>
      </section>

      {/* Правая колонка — Sign up */}
      <section className="auth-box auth-box--right" aria-label={t('auth.registerTab')}>
        <h4 className="r-auth-title">{t('auth.registerTab')}</h4>

        <form onSubmit={handleSubmit}>
          <label className="r-auth-input-wrap r-auth-input-wrap--name">
            <input
              className="r-auth-input r-auth-input--name"
              placeholder={t('forms.firstName')}
              aria-label={t('forms.firstName')}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </label>

          <label className="r-auth-input-wrap r-auth-input-wrap--email">
            <input
              type="email"
              className="r-auth-input r-auth-input--email"
              placeholder="Email"
              aria-label="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>

          {/* точки шага */}
          <div className="auth-steps" aria-hidden="true">
            <span className="dot is-active" />
            <span className="dot" />
            <span className="dot" />
          </div>

          <button
            type="submit"
            className="r-auth-submit"
            disabled={loading}
            onClick={() => setMode('register')}
          >
            {t('auth.continue')}
          </button>

          <div className="r-auth-divider">
            <span className="r-auth-divider__text">{t('common.or')}</span>
            <div className="r-auth-google">
              <GoogleSignIn onSuccess={() => (window.location.href = '/')} />
            </div>
          </div>
        </form>
      </section>

      {showSmsModal && (
        <OtpModal
          target={smsPhone}
          onClose={() => setShowSmsModal(false)}
          onSubmit={verifySms}
        />
      )}
    </div>
  );
};
