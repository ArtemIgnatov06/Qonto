import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function PhoneBinder() {
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
      const { data } = await axios.post('/api/me/update-phone', { phone, password }, { withCredentials: true });
      if (data.ok) { setMsg('Номер сохранён'); setPassword(''); }
      else setErr(data.error || 'Не удалось сохранить номер');
    } catch (e) {
      setErr(e?.response?.data?.error || 'Не удалось сохранить номер');
    } finally { setLoading(false); }
  }

  return (
    <div className="card phone-card">
      <h3 style={{marginTop:0}}>Телефон</h3>
      <input
        type="tel"
        placeholder="+380..."
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={{width:'100%', padding:'10px', border:'1px solid #ddd', borderRadius:10, marginBottom:8}}
      />
      <div style={{fontSize:12, color:'#666', marginBottom:6}}>
        Чтобы входить по номеру — задайте пароль (минимум 6 символов).
      </div>
      <input
        type="password"
        placeholder="Новый пароль (необязательно)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{width:'100%', padding:'10px', border:'1px solid #ddd', borderRadius:10}}
      />
      <button onClick={save} disabled={loading}
              style={{marginTop:10, width:'100%', padding:'10px 14px', borderRadius:10, border:'none', background:'#1a73e8', color:'#fff', cursor:'pointer'}}>
        {loading ? 'Сохраняем...' : 'Сохранить'}
      </button>
      {msg && <div style={{color:'#0a7d16', marginTop:8}}>{msg}</div>}
      {err && <div style={{color:'#b00020', marginTop:8}}>{err}</div>}
    </div>
  );
}
