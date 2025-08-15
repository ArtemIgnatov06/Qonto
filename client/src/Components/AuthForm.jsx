import React, { useState } from 'react';
import axios from 'axios';
import GoogleSignIn from './GoogleSignIn';
import OtpModal from './OtpModal';
import '../Styles/auth.css';

export const AuthForm = () => {
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
          setError(data.error || 'Ошибка входа');
        } else if (loginBy === 'phone') {
          const { data } = await axios.post('/api/login-phone', { phone: form.phone, password: form.password }, { withCredentials:true });
          if (data.ok) { window.location.href = '/'; return; }
          setError(data.error || 'Ошибка входа');
        } else {
          // phone_otp — запускаем отправку SMS и открываем модалку
          if (!form.phone) { setError('Укажите телефон'); return; }
          const { data } = await axios.post('/api/auth/phone/start', { phone: form.phone }, { withCredentials:true });
          if (data.ok) {
            setSmsPhone(form.phone);
            setShowSmsModal(true);
          } else {
            setError(data.error || 'Не удалось отправить код');
          }
        }
      } else {
        const payload = { firstName: form.firstName, lastName: form.lastName, password: form.password, phone: form.phone, email: form.email };
        const { data } = await axios.post('/api/register-email', payload, { withCredentials:true });
        if (data.ok) { alert('Регистрация успешна. Теперь войдите.'); setMode('login'); }
        else setError(data.error || 'Ошибка регистрации');
      }
    } catch (e2) {
      setError(e2?.response?.data?.error || 'Произошла ошибка. Проверьте соединение.');
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
        alert(data.error || 'Неверный код');
      }
    } catch (e) {
      alert(e?.response?.data?.error || 'Ошибка подтверждения кода');
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Вход</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Регистрация</button>
      </div>

      <div className="auth-third-party">
        <GoogleSignIn onSuccess={() => (window.location.href = '/')} />
      </div>
      <div className="auth-divider"><span>или</span></div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === 'register' ? (
          <>
            <input name="firstName" placeholder="Имя" value={form.firstName} onChange={e=>setForm({...form, firstName:e.target.value})} />
            <input name="lastName"  placeholder="Фамилия" value={form.lastName} onChange={e=>setForm({...form, lastName:e.target.value})} />
            <input name="phone"     placeholder="Телефон" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
            <input name="email" type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
            <input name="password" type="password" placeholder="Пароль" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
          </>
        ) : (
          <>
            <div style={{display:'flex', gap:6, marginBottom:4, flexWrap:'wrap'}}>
              <button type="button" className={loginBy==='email'?'active':''} onClick={()=>setLoginBy('email')}>По email</button>
              <button type="button" className={loginBy==='phone'?'active':''} onClick={()=>setLoginBy('phone')}>Телефон + пароль</button>
              <button type="button" className={loginBy==='phone_otp'?'active':''} onClick={()=>setLoginBy('phone_otp')}>Телефон + SMS-код</button>
            </div>

            {loginBy === 'email' && (
              <>
                <input name="email" type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
                <input name="password" type="password" placeholder="Пароль" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
              </>
            )}

            {loginBy === 'phone' && (
              <>
                <input name="phone" placeholder="Телефон" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
                <input name="password" type="password" placeholder="Пароль" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
              </>
            )}

            {loginBy === 'phone_otp' && (
              <>
                <input name="phone" placeholder="Телефон" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
                {/* Кнопка "Войти" запустит отправку кода и откроет модалку */}
              </>
            )}
          </>
        )}

        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>{mode==='login'?'Войти':'Зарегистрироваться'}</button>
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
