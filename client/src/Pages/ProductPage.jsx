// ProductPage.jsx — карточка товара + магазин-плашка + отзывы с фото

import React, { useEffect, useMemo, useRef, useState } from 'react';
import reportIcon from '../assets/report.png';
import { useParams, Link } from 'react-router-dom';
import '../Styles/ProductPage.css';

import star from '../assets/star.png';
import starGray from '../assets/starg.png';
import basketWhite from '../assets/basket-white.png';
import addIcon from '../assets/add.png';
import sendIcon from '../assets/send.png';
import shopFruits from '../assets/fruits.png';

/* ---------------------------- helpers ---------------------------------- */

const isBase64 = (s) => typeof s === 'string' && /^[A-Za-z0-9+/=\r\n]+$/.test(s) && s.length > 100;
const looksLikeExt = (s) => /\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i.test(s || '');

const normSrc = (u) => {
  if (!u || typeof u !== 'string') return null;
  const s = u.trim().replace(/\\/g, '/');
  if (/^data:image\//i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return s;
  if (s.startsWith('assets/')) return '/' + s;
  if (/^(uploads|images|static|files|media)\//i.test(s)) return '/' + s;
  if (isBase64(s) && !looksLikeExt(s)) return `data:image/jpeg;base64,${s}`;
  try {
    // eslint-disable-next-line no-undef
    return new URL(`../assets/${s}`, import.meta.url).href;
  } catch {
    return null;
  }
};

const pickShopCover = (...names) => {
  for (const n of names) {
    const u = normSrc(n);
    if (u) return u;
  }
  return null;
};

const pluckProduct = (raw) => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] || null;
  if (raw.item) return raw.item;
  if (raw.product) return raw.product;
  if (raw.data && (raw.data.product || raw.data.item)) return raw.data.product || raw.data.item;
  if (raw.data && (Array.isArray(raw.data) ? raw.data[0] : typeof raw.data === 'object')) return Array.isArray(raw.data) ? raw.data[0] : raw.data;
  return raw;
};

const extractTitle = (p, catalogTitle = '') => {
  if (!p) return catalogTitle || 'product.title';
  const t = p.title || p.name || p.productTitle || p.product_name || p.label || p.model || p.caption;
  if (t) return t;
  const fromCat = p.category?.title || p.category?.name || p.catalog?.title || p.catalog?.name;
  return fromCat || catalogTitle || 'product.title';
};

const extractGallery = (p) => {
  if (!p) return [];
  const primary = [p.preview_image_url, p.image_url].map(normSrc).filter(Boolean);
  if (primary.length) return primary;

  const candidates = [
    p.images, p.photos, p.gallery, p.media, p.mediaFiles,
    p.productImages, p.product_images, p.images_list,
    p.galleryImages, p.photos_urls, p.picture_urls,
    p.pictures, p.files, p.imagesUrls, p.images_urls,
  ].filter(Boolean);

  for (const cand of candidates) {
    if (Array.isArray(cand) && cand.length) {
      const urls = cand
        .map((x) => (typeof x === 'string' ? x : (x?.url || x?.src || x?.path || x?.link || x?.imageUrl || x?.image_url)))
        .map(normSrc)
        .filter(Boolean);
      if (urls.length) return urls;
    }
  }

  const single =
    p.image || p.imageUrl || p.image_url ||
    p.photo || p.photoUrl || p.photo_url ||
    p.thumbnail || p.thumbnail_url || p.cover ||
    p.main_image || p.mainImage || p.preview;
  const one = normSrc(single);
  return one ? [one] : [];
};

/* ------------------------------ Component ------------------------------ */

export default function ProductPage() {
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportToast, setReportToast] = useState('');

  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [catalogTitle, setCatalogTitle] = useState('');
  const [loading, setLoading] = useState(true);

  // CART
  const [cartBusy, setCartBusy] = useState(false);
  const [cartMsg, setCartMsg] = useState('');

  // REVIEWS
  const [reviews, setReviews] = useState([]);
  const [revLoading, setRevLoading] = useState(true);
  const [revText, setRevText] = useState('');
  const [revRating, setRevRating] = useState(0);
  const [revAnon, setRevAnon] = useState(false);
  const [revFiles, setRevFiles] = useState([]);
  const fileRef = useRef(null);

  /* ---------------------- product fetch ---------------------- */
  useEffect(() => {
    let abort = false;
    const endpoints = [
      `/api/products/${id}`, `/api/product/${id}`,
      `/products/${id}`, `/product/${id}`,
      `/api/catalog/products/${id}`,
    ];
    (async () => {
      setLoading(true);
      for (const url of endpoints) {
        try {
          const r = await fetch(url, { credentials: 'include' });
          if (!r.ok) continue;
          const json = await r.json();
          const p = pluckProduct(json);
          if (p && !abort) { setProduct(p); break; }
        } catch { }
      }
      if (!abort) setLoading(false);
    })();
    return () => { abort = true; };
  }, [id]);

  // optional gallery endpoint
  useEffect(() => {
    let abort = false;
    const ends = [
      `/api/products/${id}/images`,
      `/api/product/${id}/images`,
      `/products/${id}/images`,
      `/product/${id}/images`,
    ];
    (async () => {
      for (const url of ends) {
        try {
          const r = await fetch(url, { credentials: 'include' });
          if (!r.ok) continue;
          const data = await r.json();
          const urls = Array.isArray(data)
            ? data
              .map((x) => (typeof x === 'string' ? x : (x?.url || x?.src || x?.path || x?.imageUrl || x?.image_url)))
              .map(normSrc)
              .filter(Boolean)
            : [];
          if (!abort && urls.length) { setGallery(urls); break; }
        } catch { }
      }
    })();
    return () => { abort = true; };
  }, [id]);

  // catalog title
  useEffect(() => {
    let abort = false;
    (async () => {
      const p = product;
      if (!p) return;
      const catId = p.catalog_id || p.category_id || p.catalogId || p.categoryId || p.catalog?.id || p.category?.id;
      if (!catId) return;
      const urls = [`/api/catalog/${catId}`, `/api/categories/${catId}`, `/categories/${catId}`];
      for (const u of urls) {
        try {
          const r = await fetch(u, { credentials: 'include' });
          if (!r.ok) continue;
          const d = await r.json();
          const t = d?.title || d?.name || d?.data?.title || d?.data?.name;
          if (t && !abort) { setCatalogTitle(t); break; }
        } catch { }
      }
    })();
    return () => { abort = true; };
  }, [product]);

  // reviews
  const reloadReviews = async () => {
    try {
      const r = await fetch(`/api/products/${id}/reviews`, { credentials: 'include' });
      if (!r.ok) return;
      const arr = await r.json();
      const list = Array.isArray(arr?.items) ? arr.items
        : Array.isArray(arr?.data) ? arr.data
          : Array.isArray(arr) ? arr
            : [];
      setReviews(list);
    } catch { }
  };

  useEffect(() => {
    let abort = false;
    (async () => {
      setRevLoading(true);
      try {
        const r = await fetch(`/api/products/${id}/reviews`, { credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          const list = Array.isArray(d?.items) ? d.items
            : Array.isArray(d?.data) ? d.data
              : Array.isArray(d) ? d
                : [];
          if (!abort) setReviews(list);
        }
      } finally {
        if (!abort) setRevLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [id]);

  /* ------------------------- derived ------------------------- */
  const photos = useMemo(() => {
    if (gallery.length) return gallery;
    return extractGallery(product);
  }, [gallery, product]);

  const title = extractTitle(product, catalogTitle);
  const rating = Number(product?.avg_rating ?? product?.ratingAvg ?? product?.rating ?? 0);
  const reviewsCount = Number(product?.reviews_count ?? product?.ratingCount ?? reviews?.length ?? 0);
  const hasPhotos = photos.length > 0;

  // --- Shop/Seller info ---
  const sellerId =
    product?.seller_id ?? product?.sellerId ?? product?.owner_id ?? product?.ownerId ?? product?.user_id ?? product?.userId ?? null;

  const sellerNameText =
    product?.seller_name ||
    `${(product?.seller_first_name || '').trim()} ${(product?.seller_last_name || '').trim()}`.trim() ||
    'Super Noname Store';

  const shopCover =
    product?.shop_cover_url ? normSrc(product.shop_cover_url) :
      (shopFruits || null) ||
      pickShopCover('fruits.png', 'shop-cover.jpg', 'shop-cover.png', 'store-cover.jpg', 'store-cover.png', 'shop.jpg', 'shop.png') ||
      null;

  /* ------------------------- handlers ------------------------ */

  const handleAddToCart = async () => {
    if (!product?.id) return;
    setCartBusy(true); setCartMsg('');
    const tries = [
      { url: '/api/cart', method: 'POST', body: { product_id: product.id, quantity: 1 } },
      { url: '/cart', method: 'POST', body: { product_id: product.id, quantity: 1 } },
      { url: '/api/cart/add', method: 'POST', body: { product_id: product.id, qty: 1 } },
    ];
    for (const t of tries) {
      try {
        const r = await fetch(t.url, {
          method: t.method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(t.body),
        });
        if (!r.ok) continue;
        setCartMsg('Товар додано до кошика');
        setTimeout(() => setCartMsg(''), 2500);
        setCartBusy(false);
        return;
      } catch { }
    }
    setCartMsg('Не вдалося додати до кошика');
    setTimeout(() => setCartMsg(''), 2500);
    setCartBusy(false);
  };

  const handleChooseFiles = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    setRevFiles(files);
  };

  const handleSendReview = async () => {
    if (!revRating) { alert('Оцініть товар (1–5)'); return; }
    if (!revText.trim()) { alert('Напишіть короткий відгук'); return; }

    try {
      const fd = new FormData();
      fd.append('rating', String(revRating));
      fd.append('comment', revText.trim());
      fd.append('is_anonymous', revAnon ? '1' : '0');
      revFiles.forEach((f, i) => fd.append('images[]', f, f.name || `img${i}.jpg`));

      const r = await fetch(`/api/products/${id}/reviews`, {
        method: 'POST',
        credentials: 'include',
        body: fd
      });

      if (r.ok) {
        const data = await r.json().catch(() => null);
        const saved = data?.item;
        if (saved) setReviews((prev) => [saved, ...prev]);
        else await reloadReviews();
        setRevText(''); setRevRating(0); setRevAnon(false); setRevFiles([]);
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
    } catch { }

    alert('Не вдалося надіслати відгук');
  };

  /* ------------------------------- UI ----------------------------------- */

  if (loading) return <div className="pad-24">Loading…</div>;
  if (!product) return <div className="pad-24">Товар не знайдено</div>;

  return (
    <>
      <div className="pdp-wrap">
        <div className="pdp-grid pdp-grid--nochips">
          {/* Thumbs */}
          <div className="pdp-thumbs" aria-label="Галерея зображень">
            {Array.from({ length: Math.min(5, Math.max(photos.length, 0)) }).map((_, i) => {
              const src = photos[i];
              return (
                <button
                  key={i}
                  className={'thumb' + (i === 0 ? ' is-active' : '')}
                  onClick={(e) => {
                    const main = e.currentTarget.closest('.pdp-grid').querySelector('.pdp-photo .main');
                    if (main && src) main.src = src;
                    e.currentTarget.parentElement.querySelectorAll('.thumb').forEach((b) => b.classList.remove('is-active'));
                    e.currentTarget.classList.add('is-active');
                  }}
                  type="button"
                  disabled={!src}
                >
                  {src ? <img src={src} alt={`${title} ${i + 1}`} /> : <span style={{ opacity: .5 }}>—</span>}
                </button>
              );
            })}
          </div>

          {/* Main photo */}
          <div className="pdp-photo">
            {hasPhotos ? (
              <img className="main" src={photos[0]} alt={title} />
            ) : (
              <div className="main empty" aria-label="Немає зображення">no image</div>
            )}
          </div>

          {/* Right info */}
          <div className="pdp-info">
            <div className="title-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 className="title" style={{ margin: 0 }}>{title}</h1>
              <button aria-label="Поскаржитися" onClick={() => setShowReport(true)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
                <img src={reportIcon} alt="Поскаржитися" style={{ width: 20, height: 20, opacity: 0.9 }} />
              </button>
            </div>

            <div className="rating">
              <img src={star} alt="" className="star" />
              <span className="score">{rating.toFixed(1).replace('.', ',')}</span>
              <span className="dot" aria-hidden="true"></span>
              <a href="#reviews" className="link">
                {reviewsCount ? `${reviewsCount.toLocaleString('uk-UA')} відгуків` : 'Немає відгуків'}
              </a>
            </div>

            <div className="buy-row" style={{ marginTop: '16px' }}>
              <button className="btn-primary" type="button" disabled={cartBusy} onClick={handleAddToCart}>
                <span className="icon"><img src={basketWhite} alt="" /></span>
                <span className="txt">{cartBusy ? 'Додаємо…' : 'Додати до кошику'}</span>
              </button>
              {cartMsg && <span className="cart-msg" style={{ marginLeft: 12 }}>{cartMsg}</span>}
            </div>

            {/* Магазин: сверху картинка, снизу белый блок */}
            <section className="shop">
              <h3>Магазин</h3>
              {sellerId ? (
                <Link to={`/shop/${sellerId}`} className="shop-card" aria-label="Перейти до магазину">
                  <div className="shop-card__media">
                    <img src={shopCover || shopFruits} alt="" />
                  </div>
                  <div className="shop-card__body">
                    <div className="shop-card__name" title={sellerNameText || 'Магазин'}>
                      {sellerNameText || 'Магазин'}
                    </div>
                    <div className="shop-card__cta">
                      Перейти до магазину <span className="arrow" aria-hidden>›</span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="shop-card is-disabled">
                  <div className="shop-card__media"><img src={shopCover || shopFruits} alt="" /></div>
                  <div className="shop-card__body">
                    <div className="shop-card__name">{sellerNameText || 'Магазин'}</div>
                    <div className="shop-card__cta muted">Профіль продавця недоступний</div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* About */}
        <div className="pdp-below">
          <section className="about" style={{ gridColumn: '1 / -1' }}>
            <h3>Про товар</h3>
            <p>{(product?.short_description || product?.description || '—')}</p>
            <button className="link-inline" type="button">Детальніше</button>
          </section>
        </div>

        {/* Reviews composer + list */}
        <div className="reviews-strip" id="reviews">
          <div className="stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                className="sbtn"
                type="button"
                onClick={() => setRevRating(i + 1)}
                aria-label={`${i + 1}/5`}
                title={`${i + 1}/5`}
              >
                <img src={i < revRating ? star : starGray} alt="" />
              </button>
            ))}
          </div>

          <input
            className="r-input"
            placeholder="Залишіть свій відгук"
            value={revText}
            onChange={(e) => setRevText(e.target.value)}
          />

          <button className="r-attach" type="button" onClick={() => fileRef.current?.click()} title="Додати фото">
            <img src={addIcon} alt="" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleChooseFiles}
          />
          <button className="r-send" type="button" onClick={handleSendReview} title="Надіслати">
            <img src={sendIcon} alt="" />
          </button>

          <label className="anon" title="Приховати ім'я та прізвище">
            <span>Анонімний відгук</span>
            <input type="checkbox" checked={revAnon} onChange={(e) => setRevAnon(e.target.checked)} />
          </label>
        </div>

        {revFiles.length > 0 && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 20px 0 20px' }}>
            {revFiles.map((f, idx) => (
              <span key={idx} style={{ fontSize: 12, opacity: .8 }}>{f.name}</span>
            ))}
          </div>
        )}

        <div style={{ padding: '10px 20px 30px' }}>
          {revLoading ? (
            <div style={{ opacity: .6 }}>Завантаження відгуків…</div>
          ) : (
            reviews.map((r) => (
              <div key={r.id || r._id} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, margin: '10px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <strong>
                    {r.is_anonymous ? 'Анонім' :
                      ((r.user?.first_name || r.first_name || '') + ' ' + (r.user?.last_name || r.last_name || '')).trim() || r.user_name || r.username || 'Користувач'}
                  </strong>
                  <span style={{ opacity: .6, fontSize: 13 }}>
                    {new Date(r.created_at || r.createdAt || r.updated_at || Date.now()).toLocaleDateString('uk-UA')}
                  </span>
                  <span style={{ marginLeft: 'auto' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <img key={i} src={i < (Number(r.rating) || 0) ? star : starGray} alt="" style={{ height: 14, verticalAlign: 'middle' }} />
                    ))}
                  </span>
                </div>
                {(r.comment || r.text) && <div style={{ margin: '4px 0 8px 0' }}>{r.comment || r.text}</div>}
                {!!(r.images?.length) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {r.images.map((img, i) => {
                      const src = typeof img === 'string'
                        ? normSrc(img)
                        : normSrc(img?.url || img?.src || img?.path || img?.image_url || img?.imageUrl);
                      return src ? <img key={i} src={src} alt="" style={{ height: 64, borderRadius: 8 }} /> : null;
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Report modal */}
      {showReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowReport(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420,
              maxWidth: '90%',
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              padding: 20
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 12 }}>
              Виберіть причину скарги:
            </div>

            {[
              'Порушення авторських прав',
              'Недостовірна або оманлива інформація',
              'Заборонений або обмежений товар',
              'Нечесна або шкідлива продукція'
            ].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReportReason(r)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  margin: '8px 0',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: reportReason === r ? '#ffe5e5' : '#fff'
                }}
              >
                {r}
              </button>
            ))}

            <button
              type="button"
              onClick={async () => {
                if (!reportReason) return;
                try {
                  setReporting(true);
                  const res = await fetch('/api/reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      productId: (product && product.id) || id,
                      reason: reportReason
                    })
                  });
                  const j = await res.json().catch(() => ({}));
                  if (res.ok) {
                    setShowReport(false);
                    setReportReason('');
                    setReportToast('Ваша скарга на товар прийнята на розгляд');
                    setTimeout(() => setReportToast(''), 3000);
                  } else {
                    setReportToast((j && j.message) || 'Не вдалося надіслати скаргу');
                    setTimeout(() => setReportToast(''), 3000);
                  }
                } finally {
                  setReporting(false);
                }
              }}
              disabled={!reportReason || reporting}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '10px 14px',
                borderRadius: 10,
                background: '#f1f59',
                border: '1px solid #e5e7eb',
                cursor: !reportReason || reporting ? 'not-allowed' : 'pointer',
                opacity: !reportReason || reporting ? 0.7 : 1
              }}
            >
              Поскаржитися на товар
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {reportToast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fff',
            border: '1px solid #e5e7eb',
            padding: '10px 14px',
            borderRadius: 999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1001
          }}
        >
          {reportToast}
        </div>
      )}
    </>
  );
}
