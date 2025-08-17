import React, { useEffect, useState } from 'react';
import ChatWidget from '../Components/ChatWidget';
import '../App.css';

export default function Home() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const r = await fetch('http://localhost:5050/products');
        if (!r.ok) throw new Error('bad status');
        const data = await r.json();
        if (!abort) setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!abort) setError('Не удалось загрузить товары');
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  return (
    <div className="page page-home">
      <div className="card">
        <button className="button menu-button" aria-label="Меню">
          &#9776;
        </button>
        <h2 className="heading-large">Каталог товаров</h2>

        {loading && <p className="text-muted">Загрузка…</p>}
        {error && <p className="text-danger">{error}</p>}

        {!loading && !error && (
          items.length ? (
            <div className="products-grid">
              {items.map(p => (
                <div className="product-card" key={p.id}>
                  <div className="product-thumb" aria-hidden="true">🛍️</div>
                  <div className="product-body">
                    <div className="product-title">{p.title}</div>
                    {p.description && <div className="product-desc">{p.description}</div>}
                    <div className="product-meta">
                      <span className="price">{Number(p.price).toFixed(2)} ₴</span>
                      <span className="qty">В наличии: {p.qty}</span>
                    </div>
                    {p.seller_username && (
                      <div className="seller">Продавец: {p.seller_username}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">(Пока нет активных товаров)</p>
          )
        )}
      </div>
      <ChatWidget />
    </div>
  );
}
