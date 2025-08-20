// client/src/Pages/Home.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ChatWidget from '../Components/ChatWidget';
import { useAuth } from '../Hooks/useAuth';
import '../App.css';

export default function Home() {
  const { user } = useAuth(); // нужен для показа админ-кнопки
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]); // для списка категорий
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate(); // ✨ для перехода

  // грузим все товары один раз — чтобы собрать список категорий
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const r = await fetch('http://localhost:5050/products', { credentials: 'include' });
        if (!r.ok) throw new Error('bad status');
        const data = await r.json();
        if (!abort) {
          const arr = Array.isArray(data.items) ? data.items : [];
          setAllItems(arr);
        }
      } catch {
        if (!abort) setError('Не вдалося завантажити товары');
      }
    })();
    return () => { abort = true; };
  }, []);

  // грузим товары по выбранной категории
  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const url = new URL('http://localhost:5050/products');
        if (category) url.searchParams.set('category', category);
        const r = await fetch(url.toString(), { credentials: 'include' });
        if (!r.ok) throw new Error('bad status');
        const data = await r.json();
        if (!abort) setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!abort) setError('Не вдалося завантажити товары');
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [category]);

  // список категорий из allItems
  const categories = useMemo(() => {
    const set = new Set(
      (allItems || []).map(i => (i?.category || '').trim()).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allItems]);

  // покупка → переход на страницу товара
  const handleBuy = (product) => {
    navigate(`/product/${product.id}`);
  };

  // удаление товара админом
  const handleAdminDelete = async (product) => {
    const reason = window.prompt(`Укажите причину удаления для товара "${product.title}":`);
    if (!reason) return;

    try {
      const r = await fetch(`http://localhost:5050/admin/products/${product.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || 'Ошибка удаления');
      }
      // убрать из списков локально
      setItems(prev => prev.filter(i => i.id !== product.id));
      setAllItems(prev => prev.filter(i => i.id !== product.id));
    } catch (e) {
      alert(e.message || 'Не удалось удалить товар');
    }
  };

  return (
    <div className="page page-home">
      <div className="card card-compact">
        <h2 className="heading-large">Каталог товаров</h2>

        {/* Фильтр по категории */}
        <div className="form-row" style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Категория</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ minHeight: 40, padding: '8px 10px' }}
          >
            <option value="">Все категории</option>
            {categories.map(c => (
              <option value={c} key={c}>{c}</option>
            ))}
          </select>
        </div>

        {loading && <p className="text-muted">Загрузка…</p>}
        {error && <p className="text-danger">{error}</p>}

        {!loading && !error && (
          items.length ? (
            <div className="products-grid products-grid-3">
              {items.map(p => (
                <div className="product-card" key={p.id}>
                  <Link to={`/product/${p.id}`} style={{ display: 'block' }}>
                    <img
                      className="product-thumb"
                      src="/placeholder.svg"
                      alt={p.title}
                    />
                  </Link>

                  <div className="product-body">
                    <div
                      className="product-title"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                    >
                      <Link to={`/product/${p.id}`} className="link-plain">
                        <span>{p.title}</span>
                      </Link>

                      {/* Кнопка удаления видна только админам */}
                      {user?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleAdminDelete(p)}
                          className="btn-logout"
                          title="Удалить товар"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                        >
                          Удалить
                        </button>
                      )}
                    </div>

                    {/* категория */}
                    {p.category && (
                      <div className="text-muted" style={{ margin: '4px 0 8px' }}>
                        {p.category}
                      </div>
                    )}

                    {p.description && (
                      <div className="product-desc">{p.description}</div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginTop: 8
                      }}
                    >
                      <div className="product-price">
                        {Number(p.price).toFixed(2)} ₴
                      </div>

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleBuy(p)}
                        title="Купить"
                      >
                        Купить
                      </button>
                    </div>

                    {p.seller_name && (
                      <div className="product-seller" style={{ marginTop: 6 }}>
                        Продавец: {p.seller_name}
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
