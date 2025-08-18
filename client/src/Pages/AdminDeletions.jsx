// client/src/Pages/AdminDeletions.jsx
import React, { useEffect, useState } from 'react';
import '../App.css';
import { useAuth } from '../Hooks/useAuth';

export default function AdminDeletions() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const r = await fetch('http://localhost:5050/admin/product-deletions', {
          credentials: 'include'
        });
        if (!r.ok) throw new Error('bad status');
        const data = await r.json();
        if (!abort) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (!abort) setError('Не удалось загрузить историю удалений');
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  if (!user || user.role !== 'admin') {
    return <div className="page"><h2>Доступ запрещён</h2></div>;
  }

  return (
    <div className="page page-admin">
      <div className="card">
        <h2 className="heading-large">История удалённых товаров</h2>

        {loading && <p className="text-muted">Загрузка…</p>}
        {error && <p className="text-danger">{error}</p>}

        {!loading && !error && (
          items.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table
                className="table"
                style={{
                  width: '100%',
                  marginTop: 16,
                  borderCollapse: 'separate',  // разъединяем, чтобы работал spacing
                  borderSpacing: '0 8px',      // вертикальный зазор между строками
                }}
              >
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>ID товара</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Название</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Категория</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Цена</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Продавец</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Удалил админ</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Причина</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((d) => (
                    <tr
                      key={d.id}
                      style={{
                        background: '#fafafa',
                        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>{d.product_id}</td>
                      <td style={{ padding: '12px 16px' }}>{d.title}</td>
                      <td style={{ padding: '12px 16px' }}>{d.category}</td>
                      <td style={{ padding: '12px 16px' }}>{Number(d.price).toFixed(2)} ₴</td>
                      <td style={{ padding: '12px 16px' }}>
                        {d.seller_first_name} {d.seller_last_name} ({d.seller_username})
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {d.admin_first_name} {d.admin_last_name} ({d.admin_username})
                      </td>
                      <td style={{ padding: '12px 16px', color: '#d32f2f' }}>{d.reason}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {new Date(d.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">(Пока нет удалённых товаров)</p>
          )
        )}
      </div>
    </div>
  );
}
