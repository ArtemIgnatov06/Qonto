// client/src/Pages/SellerApplication.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';

export default function SellerApplication() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    company_name: '',
    tax_id: '',
    price_list_url: '',
    comment: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    // Префилл из профиля
    if (user) {
      setForm(prev => ({
        ...prev,
        company_name: prev.company_name || `${user.first_name || ''} ${user.last_name || ''}`.trim()
      }));
    }
  }, [user]);

  if (!user) {
    return <div className="container" style={{padding:'24px 16px'}}>Нужно войти в аккаунт</div>;
  }

  if (user.seller_status === 'approved') {
    return (
      <div className="container" style={{padding:'24px 16px'}}>
        <h2>Вы уже являетесь продавцом 🎉</h2>
        <button className="btn-login" onClick={() => navigate('/profile')} style={{marginTop:12}}>
          Вернуться в профиль
        </button>
      </div>
    );
  }

  if (user.seller_status === 'pending') {
    return (
      <div className="container" style={{padding:'24px 16px'}}>
        <h2>Ваша заявка на рассмотрении ⏳</h2>
        <p>Мы уведомим вас, как только решение будет принято.</p>
        <button className="btn-login" onClick={() => navigate('/profile')} style={{marginTop:12}}>
          Вернуться в профиль
        </button>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch('http://localhost:5050/seller/apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.company_name.trim(),
          tax_id: form.tax_id.trim(),
          price_list_url: form.price_list_url.trim() || undefined,
          // Тут как раз «текстовое окно желаний, что хочет продавать»
          comment: form.comment.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Не удалось отправить заявку');
      }

      setMsg('Заявка отправлена! Статус обновлён на pending.');
      await refresh(); // подтянем seller_status = pending
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{padding:'24px 16px', maxWidth: 900, margin: '0 auto'}}>
      <h2 style={{marginBottom: 16}}>Заявка на статус продавца</h2>

      {/* Блок с «личными данными пользователя», под которые ты просил подтяжку */}
      <div style={{
        border:'1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16, background:'#f9fafb'
      }}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div>
            <label style={{fontSize:12, color:'#6b7280'}}>Имя</label>
            <input value={user.first_name || ''} readOnly className="input" style={{width:'100%'}} />
          </div>
          <div>
            <label style={{fontSize:12, color:'#6b7280'}}>Фамилия</label>
            <input value={user.last_name || ''} readOnly className="input" style={{width:'100%'}} />
          </div>
          <div>
            <label style={{fontSize:12, color:'#6b7280'}}>Email</label>
            <input value={user.email || ''} readOnly className="input" style={{width:'100%'}} />
          </div>
          <div>
            <label style={{fontSize:12, color:'#6b7280'}}>Телефон</label>
            <input value={user.phone || ''} readOnly className="input" style={{width:'100%'}} />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{display:'grid', gap: 12}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div>
            <label style={{fontSize:12, color:'#374151'}}>Название компании / продавца *</label>
            <input
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              required
              className="input"
              placeholder="ООО «Ромашка» или Иван Иванов"
              style={{width:'100%'}}
            />
          </div>

          <div>
            <label style={{fontSize:12, color:'#374151'}}>ИНН / Налоговый номер *</label>
            <input
              name="tax_id"
              value={form.tax_id}
              onChange={handleChange}
              required
              className="input"
              placeholder="ИНН / Tax ID"
              style={{width:'100%'}}
            />
          </div>
        </div>

        <div>
          <label style={{fontSize:12, color:'#374151'}}>Прайс-лист (ссылка, опционально)</label>
          <input
            name="price_list_url"
            value={form.price_list_url}
            onChange={handleChange}
            className="input"
            placeholder="https://..."
            style={{width:'100%'}}
          />
        </div>

        <div>
          <label style={{fontSize:12, color:'#374151'}}>Что вы хотите продавать? (ваши пожелания)</label>
          <textarea
            name="comment"
            value={form.comment}
            onChange={handleChange}
            className="input"
            placeholder="Опишите категории и тип товаров, условия, объёмы и т.п."
            rows={6}
            style={{width:'100%', resize:'vertical'}}
          />
        </div>

        <div style={{display:'flex', gap:12, alignItems:'center', marginTop:8}}>
          <button
            type="submit"
            className="btn-login"
            disabled={submitting}
          >
            {submitting ? 'Отправляем…' : 'Отправить заявку'}
          </button>
          <button type="button" className="btn-login" onClick={() => navigate('/profile')} style={{background:'#6b7280'}}>
            Назад в профиль
          </button>
          {msg && <div style={{color:'#0a7d16'}}>{msg}</div>}
          {err && <div style={{color:'#b00020'}}>{err}</div>}
        </div>
      </form>
    </div>
  );
}
