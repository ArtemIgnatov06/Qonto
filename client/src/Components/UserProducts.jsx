import React, { useEffect, useState } from 'react';
import axios from 'axios';

const UserProducts = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await axios.get('/api/my-products', { withCredentials: true });
      setItems(data.items || []);
    } catch {
      setErr('Не удалось загрузить товары');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm('Удалить товар?')) return;
    try {
      await axios.delete(`/api/products/${id}`, { withCredentials: true });
      setItems(items.filter(i => i.id !== id));
    } catch {
      alert('Ошибка удаления');
    }
  };

  return (
    <div>
      {loading && <p className="text-muted">Загрузка…</p>}
      {err && <p className="text-danger">{err}</p>}

      {!loading && !items.length && <p className="text-muted">У вас пока нет товаров</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map(p => (
          <li key={p.id} style={{ marginBottom: 12, padding: 8, border: '1px solid #ddd', borderRadius: 8 }}>
            <div><b>{p.title}</b> ({p.category}) — {Number(p.price).toFixed(2)} ₴</div>
            <div style={{ fontSize: 14, color: '#666' }}>{p.description}</div>
            <div style={{ marginTop: 6 }}>
              <button className="btn-primary" style={{ marginRight: 8 }}>Редактировать</button>
              <button className="btn-logout" onClick={() => remove(p.id)}>Удалить</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserProducts;
