// Components/AuthForm.jsx
import React, { useState } from 'react';
import axios from 'axios';
import GoogleSignIn from './GoogleSignIn';
import OtpModal from './OtpModal';
import '../Styles/auth.css';
import { useTranslation } from 'react-i18next';

export const AuthForm = () => {
  const { t } = useTranslation(); // defaultNS: common
  const [mode, setMode] = useState('login');         // 'login' | 'register'
  const [loginBy, setLoginBy] = useState('email');   // 'email' | 'phone' | 'phone_otp'
  const [form, setForm] = useState({
    firstName:'', lastName:'', password:'', phone:'', email:''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // для SMS-OTP
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      if (mode === 'login') {
        if (loginBy === 'email') {
          const { data } = await axios.post('/api/login-email', { email: form.email, password: form.password }, { withCredentials:true });
          if (data.ok) { window.location.href = '/'; return; }
          setError(data.error || t('errors.loginFailed'));
        } else if (loginBy === 'phone') {
          const { data } = await axios.post('/api/login-phone', { phone: form.phone, password: form.password }, { withCredentials:true });
          if (data.ok) { window.location.href = '/'; return; }
          setError(data.error || t('errors.loginFailed'));
        } else {
          // phone_otp — запускаем отправку SMS и открываем модалку
          if (!form.phone) { setError(t('errors.phoneRequired')); setLoading(false); return; }
          const { data } = await axios.post('/api/auth/phone/start', { phone: form.phone }, { withCredentials:true });
          if (data.ok) {
            setSmsPhone(form.phone);
            setShowSmsModal(true);
          } else {
            setError(data.error || t('errors.smsSendFailed'));
          }
        }
      } else {
        const payload = { firstName: form.firstName, lastName: form.lastName, password: form.password, phone: form.phone, email: form.email };
        const { data } = await axios.post('/api/register-email', payload, { withCredentials:true });
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
      const { data } = await axios.post('/api/auth/phone/verify', { phone: smsPhone, code }, { withCredentials:true });
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
    <div className="auth-container" aria-label={t('auth.formAria')}>
      <div className="auth-tabs" role="tablist" aria-label={t('auth.tablistAria')}>
        <button
          className={mode === 'login' ? 'active' : ''}
          onClick={() => setMode('login')}
          role="tab"
          aria-selected={mode === 'login'}
        >
          {t('auth.loginTab')}
        </button>
        <button
          className={mode === 'register' ? 'active' : ''}
          onClick={() => setMode('register')}
          role="tab"
          aria-selected={mode === 'register'}
        >
          {t('auth.registerTab')}
        </button>
      </div>

      <div className="auth-third-party">
        <GoogleSignIn onSuccess={() => (window.location.href = '/')} />
      </div>
      <div className="auth-divider"><span>{t('common.or')}</span></div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === 'register' ? (
          <>
            <input
              name="firstName"
              placeholder={t('forms.firstName')}
              value={form.firstName}
              onChange={e=>setForm({...form, firstName:e.target.value})}
              aria-label={t('forms.firstName')}
            />
            <input
              name="lastName"
              placeholder={t('forms.lastName')}
              value={form.lastName}
              onChange={e=>setForm({...form, lastName:e.target.value})}
              aria-label={t('forms.lastName')}
            />
            <input
              name="phone"
              placeholder={t('forms.phone')}
              value={form.phone}
              onChange={e=>setForm({...form, phone:e.target.value})}
              aria-label={t('forms.phone')}
            />
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={e=>setForm({...form, email:e.target.value})}
              aria-label="Email"
            />
            <input
              name="password"
              type="password"
              placeholder={t('forms.password')}
              value={form.password}
              onChange={e=>setForm({...form, password:e.target.value})}
              aria-label={t('forms.password')}
            />
          </>
        ) : (
          <>
            <div style={{display:'flex', gap:6, marginBottom:4, flexWrap:'wrap'}}>
              <button
                type="button"
                className={loginBy==='email'?'active':''}
                onClick={()=>setLoginBy('email')}
                aria-pressed={loginBy==='email'}
              >
                {t('auth.byEmail')}
              </button>
              <button
                type="button"
                className={loginBy==='phone'?'active':''}
                onClick={()=>setLoginBy('phone')}
                aria-pressed={loginBy==='phone'}
              >
                {t('auth.byPhonePass')}
              </button>
              <button
                type="button"
                className={loginBy==='phone_otp'?'active':''}
                onClick={()=>setLoginBy('phone_otp')}
                aria-pressed={loginBy==='phone_otp'}
              >
                {t('auth.byPhoneOtp')}
              </button>
            </div>

            {loginBy === 'email' && (
              <>
                <input
                  name="email"
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e=>setForm({...form, email:e.target.value})}
                  aria-label="Email"
                />
                <input
                  name="password"
                  type="password"
                  placeholder={t('forms.password')}
                  value={form.password}
                  onChange={e=>setForm({...form, password:e.target.value})}
                  aria-label={t('forms.password')}
                />
              </>
            )}

            {loginBy === 'phone' && (
              <>
                <input
                  name="phone"
                  placeholder={t('forms.phone')}
                  value={form.phone}
                  onChange={e=>setForm({...form, phone:e.target.value})}
                  aria-label={t('forms.phone')}
                />
                <input
                  name="password"
                  type="password"
                  placeholder={t('forms.password')}
                  value={form.password}
                  onChange={e=>setForm({...form, password:e.target.value})}
                  aria-label={t('forms.password')}
                />
              </>
            )}

            {loginBy === 'phone_otp' && (
              <>
                <input
                  name="phone"
                  placeholder={t('forms.phone')}
                  value={form.phone}
                  onChange={e=>setForm({...form, phone:e.target.value})}
                  aria-label={t('forms.phone')}
                />
                {/* Кнопка Submit запустит отправку кода и откроет модалку */}
              </>
            )}
          </>
        )}

        {error && <div className="error" role="alert">{error}</div>}
        <button type="submit" disabled={loading}>
          {mode==='login' ? t('auth.login') : t('auth.register')}
        </button>
      </form>

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
