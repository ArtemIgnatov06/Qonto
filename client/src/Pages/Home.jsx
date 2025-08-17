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
        if (!abort) setError('Не вдалося завантажити товари');
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  return (
    <div className="page page-home">
      <div className="card card-compact"> {/* уменьшенные отступы */}
        <h2 className="heading-large">Каталог товаров</h2>

        {loading && <p className="text-muted">Загрузка…</p>}
        {error && <p className="text-danger">{error}</p>}

        {!loading && !error && (
          items.length ? (
            <div className="products-grid products-grid-3">
              {items.map(p => (
                <div className="product-card" key={p.id}>
                  <img
                    className="product-thumb"
                    src="/placeholder.svg"
                    alt={p.title}
                  />
                  <div className="product-body">
                    <div className="product-title">{p.title}</div>
                    {p.description && (
                      <div className="product-desc">{p.description}</div>
                    )}
                    <div className="product-price">
                      {Number(p.price).toFixed(2)} ₴
                    </div>
                    {p.seller_username && (
                      <div className="product-seller">
                        Продавец: {p.seller_username}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">(Поки немає активних товарів)</p>
          )
        )}
      </div>
      <ChatWidget />
    </div>
  );
}

