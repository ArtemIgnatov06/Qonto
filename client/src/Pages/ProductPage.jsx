// client/src/Pages/ProductPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import '../Styles/ProductPage.css';

function Stars({ value = 0 }) {
  const { t } = useTranslation();
  const v = Number.isFinite(+value) ? Math.min(5, Math.max(0, Math.round(+value))) : 0;
  return <span title={t('productPage.ratingTooltip', { v })}>{'★'.repeat(v)}{'☆'.repeat(5 - v)}</span>;
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
  const { t, i18n } = useTranslation();
  const { convertFromUAH, formatMoney } = useCurrency();

  const [item, setItem] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const canSubmit = useMemo(() => myRating >= 1 && myRating <= 5, [myRating]);

  const [added, setAdded] = useState(false);

  const API = process.env.REACT_APP_API || '';
  const locale = useMemo(
    () => (i18n.language?.startsWith('ua') || i18n.language?.startsWith('uk') ? 'uk-UA' : 'ru-RU'),
    [i18n.language]
  );
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }), [locale]);

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
        setError(d1?.message || t('productPage.errors.notFound'));
        return;
      }
      setItem(d1.item);
      const list = (Array.isArray(d2?.items) ? d2.items : [])
        .map((x, i) => normalizeReview(x, i))
        .filter(Boolean);
      setReviews(list);
    } catch {
      setError(t('productPage.errors.network'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, API]);

  useEffect(() => {
    if (item?.title) document.title = item.title;
  }, [item?.title]);

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
      alert(t('productPage.errors.reviewSend'));
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
        alert(d?.message || t('productPage.errors.addToCart'));
        return false;
      }
      setAdded(true);
      window.dispatchEvent(new CustomEvent('cart:changed', { detail: { type: 'add', productId, qty } }));
      return true;
    } catch {
      alert(t('productPage.errors.network'));
      return false;
    }
  }

  if (loading) return <div className="pad-24 ta-center">{t('common.loading')}</div>;
  if (error) {
    return (
      <div className="pad-24 ta-center">
        <h2>{t('common.error')}</h2>
        <div>{error}</div>
      </div>
    );
  }

  const avg = item.avg_rating ?? item.ratingAvg ?? 0;
  const cnt = item.reviews_count ?? item.ratingCount ?? 0;

  const sellerNameText =
    item.seller_name ||
    `${(item.seller_first_name || '').trim()} ${(item.seller_last_name || '').trim()}`.trim() ||
    '—';

  const sellerNode = item.seller_id ? (
    <Link
      to={`/profile/public/${item.seller_id}`}
      className="seller-link"
      title={t('productPage.viewSellerProfile')}
    >
      {sellerNameText}
    </Link>
  ) : (
    <span>{sellerNameText}</span>
  );

  return (
    <div className="product-page">
      <h1 className="mb-8">{item.title}</h1>

      <div className="row-center gap-12">
        <div className="price">
          {formatMoney(convertFromUAH(item.price || 0))}
        </div>

        {/* Купить: положить в корзину и перейти в корзину */}
        <button
          className="btn-buy-now"
          onClick={async () => { if (await addToCart(item.id, 1)) nav('/cart'); }}
          title={t('productPage.buttons.buyNow')}
          aria-label={t('productPage.buttons.buyNow')}
        >
          {t('productPage.buttons.buyNow')}
        </button>

        {/* В корзину: положить и остаться на странице */}
        <button
          className="btn-add-to-cart"
          onClick={async () => { await addToCart(item.id, 1); }}
          title={t('productPage.buttons.addToCart')}
          aria-label={t('productPage.buttons.addToCart')}
        >
          {t('productPage.buttons.addToCart')}
        </button>
      </div>

      {added && (
        <div className="added-note">
          {t('productPage.added')} <a href="/cart">{t('productPage.buttons.goToCart')} →</a>
        </div>
      )}

      <div className="seller-line">
        {t('productPage.seller')}: {sellerNode} · {t('productPage.category')}: {item.category || '—'}
      </div>

      <div className="mb-16">
        <Stars value={avg} /> {avg} ({cnt})
      </div>

      <h3 className="mt-12 mb-6">{t('productPage.description')}</h3>
      <p className="mb-24">{item.description}</p>

      <h3 className="mt-24">{t('productPage.reviews')}</h3>
      <form onSubmit={submitReview} className="row gap-8">
        <label>
          {t('productPage.rating')}:{' '}
          <input
            type="number"
            min="1"
            max="5"
            value={myRating}
            onChange={(e) => setMyRating(Number(e.target.value))}
            className="w-60"
          />
        </label>
        <textarea
          placeholder={t('productPage.yourComment')}
          value={myComment}
          onChange={(e) => setMyComment(e.target.value)}
          rows={3}
          className="review-textarea"
        />
        <button disabled={!canSubmit} className="pad-8-10">
          {t('productPage.leaveReview')}
        </button>
      </form>

      {reviews.length === 0 ? (
        <div>{t('productPage.noReviews')}</div>
      ) : (
        <div className="reviews-list">
          {reviews.map((r, i) => (
            <div key={r.id ?? i} className="review-card">
              <div className="row-center gap-6">
                <Stars value={r.rating} />
                <strong>— {r.user_name || t('productPage.customer')}</strong>
              </div>
              <div className="prewrap">{r.comment}</div>
              {r.created_at && (
                <div className="review-date">
                  {dateTime.format(new Date(r.created_at))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
