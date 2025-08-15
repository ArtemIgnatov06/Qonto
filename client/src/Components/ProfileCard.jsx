import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PhoneBinder from './PhoneBinder';

export default function ProfileCard() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    axios.get('/api/me', { withCredentials:true }).then(({ data }) => {
      const u = data.user || {};
      setMe(u);
      setForm({ first_name: u.first_name || '', last_name: u.last_name || '', email: u.email || '' });
    });
  }, []);

  if (me === null) return null;

  async function saveProfile() {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const { data } = await axios.post('/api/me/update-profile', form, { withCredentials:true });
      if (data.ok) {
        setMsg('Данные профиля сохранены');
        setMe(data.user);
      } else {
        setErr(data.error || 'Не удалось сохранить профиль');
      }
    } catch (e) {
      setErr(e?.response?.data?.error || 'Не удалось сохранить профиль');
    } finally { setSaving(false); }
  }

  return (
    <div style={{display:'grid', gap:16, gridTemplateColumns:'1fr', maxWidth:980, margin:'0 auto'}}>
      <div className="card" style={{padding:20, border:'1px solid #eee', borderRadius:14}}>
        <h3 style={{marginTop:0}}>Профиль</h3>
        {/* ЛОГИН УДАЛЁН — больше не показываем и не редактируем */}
        <div style={{display:'grid', gap:8}}>
          <input placeholder="Имя" value={form.first_name} onChange={(e)=>setForm({...form, first_name:e.target.value})}
                 style={{padding:'10px', border:'1px solid #ddd', borderRadius:10}} />
          <input placeholder="Фамилия" value={form.last_name} onChange={(e)=>setForm({...form, last_name:e.target.value})}
                 style={{padding:'10px', border:'1px solid #ddd', borderRadius:10}} />
          <input type="email" placeholder="Email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})}
                 style={{padding:'10px', border:'1px solid #ddd', borderRadius:10}} />
          <button onClick={saveProfile} disabled={saving}
                  style={{padding:'10px 14px', borderRadius:10, border:'none', background:'#1a73e8', color:'#fff', cursor:'pointer'}}>
            {saving ? 'Сохраняем...' : 'Сохранить профиль'}
          </button>
          {msg && <div style={{color:'#0a7d16'}}>{msg}</div>}
          {err && <div style={{color:'#b00020'}}>{err}</div>}
        </div>
      </div>

      {/* Блок привязки телефона и пароля для входа по телефону */}
      <div className="card" style={{padding:20, border:'1px solid #eee', borderRadius:14}}>
        <PhoneBinder />
      </div>
    </div>
  );
}
