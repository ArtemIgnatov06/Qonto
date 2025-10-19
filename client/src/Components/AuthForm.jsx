// src/Components/AuthForm.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import GoogleSignIn from './GoogleSignIn';
import OtpModal from './OtpModal';
import { useTranslation } from 'react-i18next';
import '../Styles/auth.css';
import '../Styles/AuthForm.css';

import leftGhost from '../assets/left.png';
import rightGhost from '../assets/right.png';

const OTP_LEN = 6;
const RESEND_SECONDS = 120;

export default function AuthForm() {
  const { t } = useTranslation();

  // --- общий стейт
  const [mode, setMode] = useState('login');      // 'login' | 'register'
  const [showPwd, setShowPwd] = useState(false);

  // --- логин
  const [login, setLogin] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- регистрация (3 шага по макету)
  const [regStep, setRegStep] = useState(1);
  // шаг 1
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  // шаг 2 (OTP)
  const [otp, setOtp] = useState(Array(OTP_LEN).fill(''));
  const [otpErr, setOtpErr] = useState('');
  const [resendLeft, setResendLeft] = useState(0);
  // шаг 3 (пароль + согласие)
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [regConsent, setRegConsent] = useState(false);

  // токен с сервера для связки шагов (подпись с данными шага 1)
  const [regToken, setRegToken] = useState('');

  // --- SMS-OTP (логин по телефону — как было)
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');

  // автофокус для OTP
  const otpRefs = useRef([...Array(OTP_LEN)].map(() => React.createRef()));

  // таймер “отправить ещё раз”
  useEffect(() => {
    if (resendLeft <= 0) return;
    const id = setInterval(() => setResendLeft(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [resendLeft]);

  // ====== ЛОГИН ======
  async function doLogin(e) {
    e?.preventDefault?.();
    setError(null);
    setLoading(true);
    try {
      const { data } = await axios.post(
        '/api/login-email',
        { email: login.email, password: login.password },
        { withCredentials: true }
      );
      if (data.ok) window.location.href = '/';
      else setError(data.error || t('errors.loginFailed'));
    } catch (e2) {
      setError(e2?.response?.data?.error || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  // ====== РЕГИСТРАЦИЯ ======
  // Шаг 1 -> старт регистрации: сервер валидирует и шлёт код на email
  async function startRegister(e) {
    e?.preventDefault?.();
    setError(null);
    setOtpErr('');
    try {
      const payload = {
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
      };
      const { data } = await axios.post('/api/register-email/start', payload, { withCredentials: true });
      if (!data?.ok) throw new Error(data?.error || 'start failed');

      setRegToken(data.reg_token);           // связывает шаги
      setResendLeft(RESEND_SECONDS);         // запускаем таймер
      setOtp(Array(OTP_LEN).fill(''));       // чистим инпуты
      setRegStep(2);                         // шаг 2 (OTP)
      // автофокус на первую ячейку
      setTimeout(() => otpRefs.current[0]?.current?.focus(), 0);
    } catch (e2) {
      setError(e2?.response?.data?.error || e2.message || t('errors.generic'));
    }
  }

  // повторно отправить код
  async function resendCode() {
    if (resendLeft > 0) return;
    setOtpErr('');
    try {
      const { data } = await axios.post(
        '/api/register-email/start',
        { firstName: regFirstName, lastName: regLastName, email: regEmail, phone: regPhone },
        { withCredentials: true }
      );
      if (!data?.ok) throw new Error(data?.error || 'resend failed');
      setRegToken(data.reg_token);
      setResendLeft(RESEND_SECONDS);
      setOtp(Array(OTP_LEN).fill(''));
      otpRefs.current[0]?.current?.focus();
    } catch (e2) {
      setOtpErr(e2?.response?.data?.error || e2.message || t('errors.generic'));
    }
  }

  // ввод кода (по ячейкам)
  function handleOtpChange(i, v) {
    if (!/^\d?$/.test(v)) return;
    const next = otp.slice();
    next[i] = v;
    setOtp(next);
    setOtpErr('');
    if (v && i < OTP_LEN - 1) {
      otpRefs.current[i + 1]?.current?.focus();
    }
  }
  function handleOtpKey(i, e) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.current?.focus();
    }
  }

  // Шаг 2 -> проверка кода
  async function verifyOtp(e) {
    e?.preventDefault?.();
    setOtpErr('');
    const code = otp.join('');
    if (code.length !== OTP_LEN) {
      setOtpErr(t('errors.invalidCode') || 'Некорректний код');
      return;
    }
    try {
      const { data } = await axios.post(
        '/api/register-email/verify',
        { email: regEmail, code },
        { withCredentials: true }
      );
      if (!data?.ok) throw new Error(data?.error || 'verify failed');
      setRegToken(data.reg_token); // обновлённый токен (разрешение на finish)
      setRegStep(3);
    } catch (e2) {
      setOtpErr(e2?.response?.data?.error || e2.message || t('errors.codeVerifyError'));
    }
  }

  // Шаг 3 -> завершение (создаём пользователя + логиним)
  async function finishRegister(e) {
    e?.preventDefault?.();
    setError(null);
    if (!regPassword || regPassword.length < 6) {
      setError('Пароль має бути не коротше 6 символів');
      return;
    }
    if (regPassword !== regPassword2) {
      setError('Паролі не співпадають');
      return;
    }
    if (!regConsent) {
      setError('Потрібно погодитися з політикою конфіденційності');
      return;
    }
    try {
      const { data } = await axios.post(
        '/api/register-email/finish',
        { reg_token: regToken, password: regPassword },
        { withCredentials: true }
      );
      if (data?.ok) {
        window.location.href = '/';
      } else {
        setError(data?.error || t('errors.registerFailed'));
      }
    } catch (e2) {
      setError(e2?.response?.data?.error || e2.message || t('errors.registerFailed'));
    }
  }

  // ====== разметка ======
  return (
    <div className="auth-stage" aria-label={t('auth.formAria')}>
      {/* ЛЕВАЯ КАРТОЧКА — ВХОД */}
      <section className="auth-box" aria-label={t('auth.loginTab')}>
        <h4 className="auth-left-title">{t('auth.loginTab')}</h4>

        <form onSubmit={doLogin}>
          <label className="auth-input-wrap">
            <input
              type="email"
              className="auth-input"
              placeholder="*Email"
              value={login.email}
              onChange={(e) => setLogin({ ...login, email: e.target.value })}
            />
          </label>

          <label className="auth-input-wrap auth-input-wrap--password">
            <input
              type={showPwd ? 'text' : 'password'}
              className="auth-input"
              placeholder={t('forms.password')}
              value={login.password}
              onChange={(e) => setLogin({ ...login, password: e.target.value })}
            />
            <button
              type="button"
              className="auth-pass-toggle"
              aria-pressed={showPwd}
              onClick={() => setShowPwd(v => !v)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" stroke="#35C65E" strokeWidth="1.5" />
                {showPwd ? (
                  <path d="M4 4l16 16" stroke="#35C65E" strokeWidth="1.5" />
                ) : (
                  <circle cx="12" cy="12" r="3" stroke="#35C65E" strokeWidth="1.5" />
                )}
              </svg>
            </button>
          </label>

          {error && mode === 'login' && <div className="error-block">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {t('auth.login', 'Увійти')}
          </button>
        </form>

        <div className="auth-divider">
          <span className="auth-divider__text">{t('common.or')}</span>
          <GoogleSignIn onSuccess={() => (window.location.href = '/')} />
        </div>
      </section>

      {/* ПРАВАЯ КАРТОЧКА — РЕГИСТРАЦИЯ (3 шага) */}
      <section className="auth-box" aria-label={t('auth.registerTab')}>
        <h4 className="r-auth-title">{t('auth.registerTab')}</h4>

        {/* индикатор шагов */}
        <div className="auth-steps" aria-hidden="true">
          <span className={`dot ${regStep === 1 ? 'is-active' : ''}`} />
          <span className={`dot ${regStep === 2 ? 'is-active' : ''}`} />
          <span className={`dot ${regStep === 3 ? 'is-active' : ''}`} />
        </div>

      {regStep === 1 && (
        <>
          <form onSubmit={startRegister}>
            <label className="r-auth-input-wrap">
              <input
                className="r-auth-input"
                placeholder={t('forms.firstName')}
                value={regFirstName}
                onChange={(e) => setRegFirstName(e.target.value)}
              />
            </label>
            <label className="r-auth-input-wrap">
              <input
                className="r-auth-input"
                placeholder={t('forms.lastName')}
                value={regLastName}
                onChange={(e) => setRegLastName(e.target.value)}
              />
            </label>
            <label className="r-auth-input-wrap">
              <input
                type="email"
                className="r-auth-input"
                placeholder="Email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
            </label>
            <label className="r-auth-input-wrap">
              <input
                className="r-auth-input"
                placeholder={t('forms.phone')}
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
              />
            </label>

            {error && mode === 'register' && <div className="error-block">{error}</div>}

            <button
              type="submit"
              className="r-auth-submit r-auth-submit--white"
              onClick={() => setMode('register')}
            >
              {t('common.continue', 'Продовжити')}
            </button>
          </form>

          {/* ВАЖНО: Google-кнопка вне формы, чтобы не было submit */}
          <div className="r-auth-divider">
            <span className="r-auth-divider__text">{t('common.or')}</span>
            <GoogleSignIn onSuccess={() => (window.location.href = '/')} />
          </div>
        </>
      )}

        {regStep === 2 && (
          <form onSubmit={verifyOtp}>
            {/* надпись + таймер/ресенд */}
            <div className="google-or" style={{ marginBottom: 8 }}>
              На пошту надіслано код для верифікації
            </div>

            {/* OTP 6 инпутов */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
              {otp.map((ch, i) => (
                <input
                  key={i}
                  ref={otpRefs.current[i]}
                  inputMode="numeric"
                  maxLength={1}
                  className="r-auth-input"
                  style={{ width: 56, textAlign: 'center' }}
                  value={ch}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
                />
              ))}
            </div>

            <div className="login-hints" style={{ justifyContent: 'space-between', maxWidth: 392, margin: '6px auto 8px' }}>
              <span>{resendLeft ? `${Math.floor(resendLeft/60)}:${String(resendLeft%60).padStart(2,'0')}` : ' '}</span>
              <span
                onClick={resendLeft ? undefined : resendCode}
                style={{ textDecoration: resendLeft ? 'none' : 'underline', cursor: resendLeft ? 'default' : 'pointer' }}
              >
                Надіслати ще раз
              </span>
            </div>

            {otpErr && <div className="error-block">{otpErr}</div>}

            <button type="submit" className="r-auth-submit r-auth-submit--white">
              Продовжити
            </button>
          </form>
        )}

        {regStep === 3 && (
          <form onSubmit={finishRegister}>
            <label className="r-auth-input-wrap">
              <input
                type="password"
                className="r-auth-input"
                placeholder="*Введіть пароль"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
            </label>
            <label className="r-auth-input-wrap">
              <input
                type="password"
                className="r-auth-input"
                placeholder="*Введіть пароль ще раз"
                value={regPassword2}
                onChange={(e) => setRegPassword2(e.target.value)}
              />
            </label>

            <label className="login-hints" style={{ gap: 10, alignItems: 'start' }}>
              <input
                type="checkbox"
                checked={regConsent}
                onChange={(e) => setRegConsent(e.target.checked)}
                style={{ transform: 'translateY(3px)' }}
              />
              <span>Я прочитав і згоден з політикою конфіденційності та використанням cookies.</span>
            </label>

            {error && <div className="error-block">{error}</div>}

            <button type="submit" className="r-auth-submit r-auth-submit--white">
              Продовжити
            </button>
          </form>
        )}
      </section>

      {showSmsModal && (
        <OtpModal target={smsPhone} onClose={() => setShowSmsModal(false)} onSubmit={() => {}} />
      )}

      {/* ghosts */}
      <img src={leftGhost} alt="" aria-hidden="true" className="ghost ghost--left" style={{ top: '60vh' }} />
      <img src={rightGhost} alt="" aria-hidden="true" className="ghost ghost--right" style={{ top: '40vh' }} />
    </div>
  );
}
