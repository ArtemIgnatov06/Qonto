import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import '../Styles/profile.css';

const ProductNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    qty: 1,                 // новое поле
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  if (!user) return <div className="profile-page">Не авторизован</div>;
  if (user.seller_status !== 'approved') {
    return (
      <div className="profile-page">
        Вам нужно дождаться одобрения заявки продавца.
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);

    // простая валидация
    const priceNum = Number(form.price);
    const qtyNum = Number.isFinite(Number(form.qty)) ? Math.max(0, parseInt(form.qty, 10)) : 1;
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setErr('Цена должна быть неотрицательным числом');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        price: priceNum,
        qty: qtyNum,        // отправляем количество
      };
      const { data } = await axios.post('/api/products', payload, { withCredentials: true });
      if (data.ok) {
        navigate('/'); // после создания — домой, чтобы увидеть товар в каталоге
      } else {
        setErr(data.error || 'Не удалось сохранить товар');
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e?.response?.data?.error || 'Не удалось сохранить товар');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <h2>Добавить товар</h2>
      <form className="card" onSubmit={submit} style={{ maxWidth: 640 }}>
        <div className="form-row">
          <label>Название</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Например, «Наушники MX-100»"
            required
          />
        </div>

        <div className="form-row">
          <label>Категория</label>
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Например, Электроника"
            required
          />
        </div>

        <div className="form-row">
          <label>Цена</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>

        <div className="form-row">
          <label>Количество</label>
          <input
            type="number"
            min="0"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: e.target.value })}
            placeholder="1"
          />
        </div>

        <div className="form-row">
          <label>Описание</label>
          <textarea
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Краткое описание товара"
          />
        </div>

        <div className="profile-actions">
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
          <button className="btn-logout" type="button" onClick={() => navigate(-1)}>
            Отмена
          </button>
        </div>

        {err && <div className="msg error">{err}</div>}
      </form>
    </div>
  );
};

export default ProductNew;
