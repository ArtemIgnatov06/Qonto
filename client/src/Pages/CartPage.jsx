// client/src/Pages/CartPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CartPage() {
  const API = process.env.REACT_APP_API || '';
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/api/cart`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || 'Ошибка');
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setError(e.message || 'Сервер недоступен');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const subtotal = items.reduce((s, it) => s + it.qty * Number(it.price), 0);

  async function setQty(pid, qty) {
    await fetch(`${API}/api/cart/${pid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ qty })
    });
    load();
  }
  async function removeItem(pid) {
    await fetch(`${API}/api/cart/${pid}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>;
  if (error)   return <div style={{ padding: 24 }}>Ошибка: {error}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1>Корзина</h1>
      {items.length === 0 ? (
        <div>
          Корзина пуста.
          <div style={{ marginTop: 12 }}>
            <button onClick={() => nav('/')}>&larr; Продолжить покупки</button>
          </div>
        </div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Товар</th>
                <th>Цена</th>
                <th>Кол-во</th>
                <th>Сумма</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.product_id} style={{ borderTop: '1px solid #eee' }}>
                  <td>{it.title}</td>
                  <td>{Number(it.price).toFixed(2)} ₴</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={it.qty}
                      onChange={(e) => setQty(it.product_id, Math.max(1, parseInt(e.target.value || '1', 10)))}
                      style={{ width: 64 }}
                    />
                  </td>
                  <td>{(it.qty * Number(it.price)).toFixed(2)} ₴</td>
                  <td><button onClick={() => removeItem(it.product_id)}>Удалить</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => nav('/')}>&larr; Продолжить покупки</button>
            <div style={{ fontSize: 18 }}>
              Итого: <strong>{subtotal.toFixed(2)} ₴</strong>
              <button onClick={() => nav('/checkout')} style={{ marginLeft: 12 }}>Оформить заказ</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
