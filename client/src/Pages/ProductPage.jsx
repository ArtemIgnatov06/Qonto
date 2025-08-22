// client/src/Pages/ProductPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function Stars({ value = 0 }) {
  const v = Number.isFinite(+value) ? Math.min(5, Math.max(0, Math.round(+value))) : 0;
  return <span title={`Рейтинг: ${v}`}>{'★'.repeat(v)}{'☆'.repeat(5 - v)}</span>;
}

function normalizeReview(r, fallbackId = null) {
  if (!r || typeof r !== 'object') return null;
  const id = r.id ?? r.review_id ?? r._id ?? fallbackId;
  const rating = Number.isFinite(+r.rating) ? +r.rating : 0;
  const comment = (r.comment ?? '').toString();
  const user_name = (r.user_name ?? r.author ?? '').toString();
  const created_at = r.created_at ?? r.createdAt ?? null;
  return { id, rating, comment, user_name, created_at };
}

export default function ProductPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [item, setItem] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const canSubmit = useMemo(() => myRating >= 1 && myRating <= 5, [myRating]);

  const [added, setAdded] = useState(false);

  const API = process.env.REACT_APP_API || '';

  async function loadData(pid) {
    setLoading(true);
    setError('');
    setItem(null);
    setReviews([]);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API}/api/products/${pid}`),
        fetch(`${API}/api/products/${pid}/reviews`)
      ]);
      const d1 = await r1.json().catch(() => ({}));
      const d2 = await r2.json().catch(() => ({}));
      if (!r1.ok || !d1?.item) {
        setError(d1?.message || 'Товар не найден');
        return;
      }
      setItem(d1.item);
      const list = (Array.isArray(d2?.items) ? d2.items : [])
        .map((x, i) => normalizeReview(x, i))
        .filter(Boolean);
      setReviews(list);
    } catch {
      setError('Сеть/сервер недоступен');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, API]);

  async function submitReview(e) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const resp = await fetch(`${API}/api/products/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating: myRating, comment: myComment })
      });
      const raw = await resp.text();
      let data; try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      const newRaw = data?.item ?? (Array.isArray(data?.items) ? data.items[0] : null);
      const newReview = normalizeReview(newRaw, Date.now());

      if (!resp.ok || !newReview) {
        await loadData(id);
      } else {
        setReviews(prev => [newReview, ...prev.filter(Boolean)]);
      }
      setMyComment('');
      setMyRating(5);
    } catch {
      alert('Не удалось отправить отзыв');
    }
  }

  // === добавить в корзину ===
  async function addToCart(productId, qty = 1) {
    try {
      const r = await fetch(`${API}/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ product_id: productId, qty })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(d?.message || 'Не удалось добавить в корзину. Войдите в аккаунт.');
        return false;
      }
      setAdded(true);
      // уведомляем шапку обновить бейдж
      window.dispatchEvent(new CustomEvent('cart:changed', { detail: { type: 'add', productId, qty } }));
      return true;
    } catch {
      alert('Сеть/сервер недоступен');
      return false;
    }
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>;
  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h2>Ошибка</h2>
        <div>{error}</div>
      </div>
    );
  }

  const priceUAH = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' })
    .format(item.price || 0);
  const avg = item.avg_rating ?? item.ratingAvg ?? 0;
  const cnt = item.reviews_count ?? item.ratingCount ?? 0;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>{item.title}</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{priceUAH}</div>

        {/* Купить: положить в корзину и перейти в корзину */}
        <button
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #000', cursor: 'pointer', background: '#fff' }}
          onClick={async () => { if (await addToCart(item.id, 1)) nav('/cart'); }}
        >
          Купить
        </button>

        {/* В корзину: положить и остаться на странице */}
        <button
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #888', cursor: 'pointer', background: '#f6f6f6' }}
          onClick={async () => { await addToCart(item.id, 1); }}
        >
          В корзину
        </button>
      </div>

      {added && (
        <div style={{ margin: '8px 0 12px', fontSize: 14 }}>
          Товар добавлен в корзину. <a href="/cart">Перейти в корзину →</a>
        </div>
      )}

      <div style={{ color: '#555', marginBottom: 10 }}>
        Продавец: {item.seller_name || '—'} · Категория: {item.category || '—'}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Stars value={avg} /> {avg} ({cnt})
      </div>

      <h3 style={{ margin: '12px 0 6px' }}>Описание</h3>
      <p style={{ marginBottom: 24 }}>{item.description}</p>

      <h3 style={{ marginTop: 24 }}>Отзывы</h3>
      <form onSubmit={submitReview} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <label>
          Рейтинг:{' '}
          <input
            type="number"
            min="1"
            max="5"
            value={myRating}
            onChange={(e) => setMyRating(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </label>
        <textarea
          placeholder="Ваш комментарий (необязательно)"
          value={myComment}
          onChange={(e) => setMyComment(e.target.value)}
          rows={3}
          style={{ flex: 1, padding: 8 }}
        />
        <button disabled={!canSubmit} style={{ padding: '8px 10px' }}>Оставить отзыв</button>
      </form>

      {reviews.length === 0 ? (
        <div>Пока нет отзывов.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map((r, i) => (
            <div key={r.id ?? i} style={{ background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #e5e5e5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Stars value={r.rating} />
                <strong>— {r.user_name || 'Покупатель'}</strong>
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{r.comment}</div>
              {r.created_at && (
                <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                  {new Date(r.created_at).toLocaleString('uk-UA')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
