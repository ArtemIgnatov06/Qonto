// client/src/Pages/ProductPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

function Stars({ value = 0 }) {
  const full = Math.round(Number(value) || 0);
  return (
    <span title={`Рейтинг: ${value}`}>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
    </span>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const canSubmit = useMemo(() => myRating >= 1 && myRating <= 5, [myRating]);

  useEffect(() => {
    let abort = false;
    (async () => {
      const [d1, d2] = await Promise.all([
        fetch(`/api/products/${id}`).then(r => r.json()),
        fetch(`/api/products/${id}/reviews`).then(r => r.json())
      ]);
      if (!abort) {
        setItem(d1.item);
        setReviews(d2.items || []);
      }
    })();
    return () => { abort = true; };
  }, [id]);

  const handleBuy = () => {
    // Заглушка — позже подключим оформление заказа
    alert(`TODO: купить "${item?.title}"`);
  };

  const submitReview = async (e) => {
    e.preventDefault();
    const body = {
      rating: myRating,
      comment: (myComment || '').slice(0, 1000) // ограничим длину
    };
    const res = await fetch(`/api/products/${id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.message || 'Не удалось сохранить отзыв');
      return;
    }

    // обновим агрегаты и список
    const [d1, d2] = await Promise.all([
      fetch(`/api/products/${id}`).then(r => r.json()),
      fetch(`/api/products/${id}/reviews`).then(r => r.json())
    ]);
    setItem(d1.item);
    setReviews(d2.items || []);
    setMyComment('');
  };

  if (!item) return <div>Загрузка…</div>;

  return (
    <div className="product-page">
      <h1>{item.title}</h1>

      <div className="row">
        <div className="price">{Number(item.price).toFixed(2)} ₴</div>
        <button className="btn" onClick={handleBuy}>Купить</button>
      </div>

      <div className="meta">
        Продавец: {item.seller_name} · Категория: {item.category}
      </div>

      <div className="rating" style={{ margin: '8px 0 16px' }}>
        <Stars value={item.avg_rating} />{' '}
        <b>{Number(item.avg_rating || 0).toFixed(1)}</b> ({item.reviews_count})
      </div>

      {item.description && (
        <div className="desc" style={{ marginBottom: 20 }}>
          <h3>Описание</h3>
          <p>{item.description}</p>
        </div>
      )}

      <div className="reviews">
        <h3>Отзывы</h3>

        <form onSubmit={submitReview} className="review-form">
          <label>
            Рейтинг:&nbsp;
            <select
              value={myRating}
              onChange={(e) => setMyRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>

          <textarea
            placeholder="Ваш комментарий (необязательно)"
            value={myComment}
            onChange={(e) => setMyComment(e.target.value)}
            maxLength={1000}
            rows={4}
            style={{ width: '100%' }}
          />

          <button className="btn" type="submit" disabled={!canSubmit}>
            Оставить отзыв
          </button>
        </form>

        <ul className="review-list">
          {reviews.map(r => (
            <li key={r.id} className="review">
              <div className="head">
                <span title={`Рейтинг: ${r.rating}`}>
                  {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                </span>
                {' — '}
                {r.first_name || r.last_name
                  ? `${r.first_name || ''} ${r.last_name || ''}`.trim()
                  : r.username}
              </div>

              {r.comment && <div className="comment">{r.comment}</div>}

              <div className="ts">{new Date(r.created_at).toLocaleString()}</div>
            </li>
          ))}
          {!reviews.length && <i>Пока нет отзывов</i>}
        </ul>
      </div>
    </div>
  );
}
