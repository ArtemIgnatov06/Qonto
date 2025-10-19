// client/src/Pages/CartPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../Styles/CartPage.css';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext.jsx';

import imgPoroshok from '../assets/poroshok2.png';
import imgArrow     from '../assets/arrow.png';
import imgDiscount  from '../assets/discount.png';
import imgStar      from '../assets/star.png';
import imgFav       from '../assets/favorites.png';
import imgBasket    from '../assets/basket.png';
import imgEmpty     from '../assets/cart-empty.png';

/* ---------- helpers: placeholder + безопасная нормализация с прокси ---------- */
const IMG_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
      <rect width="100%" height="100%" fill="#f2f2f2"/>
      <g fill="#c7c7c7">
        <rect x="60" y="90" width="120" height="80" rx="8"/>
        <circle cx="120" cy="80" r="18"/>
      </g>
    </svg>`
  );

const normalizeImg = (raw, API) => {
  const url = (raw || '').toString().trim();
  if (!url) return IMG_PLACEHOLDER;

  // Абсолютные URL: если внешний домен — через прокси
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      const apiHost = API ? new URL(API).hostname : '';
      if (typeof window !== 'undefined' &&
          u.hostname !== window.location.hostname &&
          u.hostname !== apiHost) {
        return `${API}/api/proxy-img?u=${encodeURIComponent(url)}`;
      }
    } catch {}
    return url;
  }

  // Относительные пути из БД: поддержка '/...' и 'filename.jpg'
  if (url.startsWith('/')) return `${API}${url}`;
  return `${API}/uploads/${url}`;
};

// максимально щедрый поиск изображения в объекте продукта
const pickImage = (p = {}) =>
  p.preview_image_url ||
  p.previewImageUrl ||
  p.image_url ||
  p.imageUrl ||
  p.image_main ||
  p.mainImage ||
  p.thumbnail ||
  p.image ||
  (Array.isArray(p.images) && (p.images.find(Boolean) || '')) ||
  (Array.isArray(p.photos) && (p.photos.find(Boolean) || '')) ||
  (Array.isArray(p.media) && p.media.find(m => m?.url)?.url) ||
  '';

export default function CartPage() {
  const { t } = useTranslation();
  const { convertFromUAH, formatMoney } = useCurrency();
  const API = process.env.REACT_APP_API || '';
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [personal, setPersonal] = useState([]);
  const [personalErr, setPersonalErr] = useState('');

  const getTitle = (it) =>
    it.title || it.product?.title || it.name || t('common.unknown', 'Без назви');

  const getLink = (it) =>
    `/product/${it.product_id || it.id || it.product?._id || it.product?.id || ''}`;

  const getQty = (it) => Number(it.qty) || 1;
  const getPriceUAH = (it) => Number(it.price) || Number(it.product?.price) || 0;

  const getImg = (it) =>
    normalizeImg(
      it.preview_image_url ||
      it.image_url ||
      it.previewImageUrl ||
      it.imageUrl ||
      it.thumbnail ||
      it.image ||
      pickImage(it.product),
      API
    );

  const subtotalUAH = useMemo(
    () => items.reduce((s, it) => s + getQty(it) * getPriceUAH(it), 0),
    [items]
  );
  const subtotalText = useMemo(
    () => formatMoney(convertFromUAH(subtotalUAH)),
    [subtotalUAH, convertFromUAH, formatMoney]
  );

  /* ---------- загрузка корзины + принудительная гидрация товаров ---------- */
  async function fetchProductById(id) {
    if (!id) return null;
    const urls = [
      `${API}/api/products/${id}`,
      `${API}/api/product/${id}`,
      `${API}/api/products?id=${id}`,
      `${API}/api/catalog/products/${id}`,
    ];
    for (const url of urls) {
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) continue;
        const dd = await r.json().catch(() => ({}));
        // возможные оболочки
        const prod =
          dd?.product ||
          dd?.data ||
          (Array.isArray(dd) ? dd[0] : dd) ||
          dd;
        if (prod && (prod.id || prod._id)) return prod;
      } catch {}
    }
    return null;
  }

  async function loadCart() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API}/api/cart`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || 'Сервер тимчасово недоступний');
      const base = Array.isArray(d.items) ? d.items : [];

      // Гидрируем каждую позицию — подтягиваем название/цену/картинку
      const hydrated = await Promise.all(
        base.map(async (it) => {
          const id = it.product_id || it.id || it.product?._id || it.product?.id;
          let product = it.product;
          if (!product) {
            product = await fetchProductById(id);
          }
          if (product) {
            const img = pickImage(product);
            it.product = { ...product };
            if (!it.preview_image_url && !it.image_url && !it.image) {
              it.image_url = img;
            }
            if (!it.title && product.title) it.title = product.title;
            if (!it.price && (product.price || product.current_price)) {
              it.price = Number(product.price || product.current_price);
            }
          }
          return it;
        })
      );

      setItems(hydrated);
    } catch (e) {
      setItems([]);
      setError(e.message || 'Сталася помилка');
    } finally {
      setLoading(false);
    }
  }

  // —1 штука: уменьшаем qty через PATCH, при 0 — сервер удалит позицию
  async function decOne(productId, currentQty) {
    const API = process.env.REACT_APP_API || '';
    try {
      const nextQty = Number(currentQty) - 1;
      const r = await fetch(`${API}/api/cart/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ qty: nextQty })
      });
      if (!r.ok) throw new Error('decOne failed');
      window.dispatchEvent(new CustomEvent('cart:changed', { detail: { type: 'dec', productId } }));
      await loadCart();
    } catch (e) {
      console.error(e);
    }
  }

  // удалить позицию целиком
  async function removeLine(productId) {
    const API = process.env.REACT_APP_API || '';
    try {
      const r = await fetch(`${API}/api/cart/${productId}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error('removeLine failed');
      window.dispatchEvent(new CustomEvent('cart:changed', { detail: { type: 'remove', productId } }));
      await loadCart();
    } catch (e) {
      console.error(e);
    }
  }

  /* ---------- рекомендации ---------- */
  async function loadPersonal() {
    setPersonalErr('');
    try {
      const r = await fetch(`${API}/api/reco/personal`, { credentials: 'include' });
      if (!r.ok) throw new Error('fallback');
      const dd = await r.json().catch(() => ({}));
      let arr = dd?.items || dd?.data || dd;
      if (!Array.isArray(arr)) throw new Error('fallback');
      setPersonal(arr.slice(0, 8));
    } catch {
      try {
        const r2 = await fetch(`${API}/api/products?limit=8&sort=popular`, { credentials: 'include' });
        const dd2 = await r2.json().catch(() => ({}));
        const arr2 = dd2?.items || dd2?.data || dd2;
        if (Array.isArray(arr2)) {
          setPersonal(arr2.slice(0, 8));
          return;
        }
        setPersonal([
          { id: 'p1', title: 'Пральний порошок, 2 кг', price: 207, image: imgPoroshok },
          { id: 'p2', title: 'Гель для прання, 1 л',   price: 189, image: imgPoroshok },
          { id: 'p3', title: 'Кондиціонер, 900 мл',    price: 165, image: imgPoroshok },
          { id: 'p4', title: 'Капсули для прання',     price: 239, image: imgPoroshok },
        ]);
      } catch (e) {
        setPersonalErr(e.message || 'Не вдалося завантажити рекомендації');
      }
    }
  }

  useEffect(() => {
    loadCart();
    loadPersonal();

    const onChange = () => loadCart();
    window.addEventListener('cart:changed', onChange);
    window.addEventListener('focus', onChange);
    return () => {
      window.removeEventListener('cart:changed', onChange);
      window.removeEventListener('focus', onChange);
    };
  }, [API]);

  const isEmpty = !items || items.length === 0;

  if (loading) {
    return (
      <div className="cart-page">
        <div className="pad-24 ta-center">{t('common.loading', 'Завантаження…')}</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="cart-page">
        <div className="pad-24 ta-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      {isEmpty ? (
        <EmptyState onGoShop={() => navigate('/catalog')} />
      ) : (
        <FilledCart
          items={items}
          getImg={getImg}
          getTitle={getTitle}
          getLink={getLink}
          getQty={getQty}
          getPriceUAH={getPriceUAH}
          subtotalText={subtotalText}
          onDecOne={decOne}
          onRemoveLine={removeLine}
          onCheckout={() => navigate('/checkout')}
        />
      )}

      {/* Хіт продаж */}
      <section className="cart-section">
        <div className="cart-section-header">
          <h3 className="hits-title">{t('cart.hits', 'Хіт продаж')}</h3>
          <a className="link-all" href="/catalog">
            <span className="text">{t('cart.allCategories', 'Усі категорії')}</span>
            <span className="icon"><img src={imgArrow} alt="" /></span>
          </a>
        </div>
        <div className="cards-grid">
          <ProductCard title="Пральний порошок, 2 кг" priceNow="207 грн" priceOld="259 грн" rating="4,4" image={imgPoroshok} />
          <ProductCard title="Гель для прання, 1 л"     priceNow="189 грн" priceOld="229 грн" rating="4,7" image={imgPoroshok} />
          <ProductCard title="Кондиціонер, 900 мл"      priceNow="165 грн" priceOld="199 грн" rating="4,6" image={imgPoroshok} />
          <ProductCard title="Капсули для прання"       priceNow="239 грн" priceOld="289 грн" rating="4,8" image={imgPoroshok} />
        </div>
      </section>

      {/* Спеціально для вас */}
      <section className="cart-section">
        <div className="cart-section-header">
          <h3 className="for-you-title">Спеціально для вас</h3>
          <a className="link-more" href="/catalog">
            <span className="text">Дивитися більше</span>
            <span className="icon"><img src={imgArrow} alt="" /></span>
          </a>
        </div>

        {personalErr && <div className="pad-24 ta-center">{personalErr}</div>}

        <div className="cards-grid">
          {personal.map((p, idx) => {
            const title = p.title || p.name || `Товар ${idx + 1}`;
            const price = p.price != null ? `${p.price}.00 грн` : undefined;
            const link = `/product/${p.id || p._id || p.product_id || ''}`;
            const img = normalizeImg(pickImage(p) || p.image, API) || imgPoroshok;

            return (
              <ProductCard
                key={p.id || p._id || idx}
                title={title}
                priceNow={price || '—'}
                priceOld={p.old_price ? `${p.old_price} грн` : undefined}
                rating={p.rating ? String(p.rating) : '4,7'}
                image={img}
                link={link}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ onGoShop }) {
  return (
    <div className="empty-wrap">
      <div className="empty-title">Кошик порожній</div>
      <img className="empty-illustration" src={imgEmpty} alt="" />
      <p className="empty-text">Додайте товари до кошика, щоб оформити замовлення.</p>
      <div className="frame-303">
        <button className="rect-55" type="button" onClick={onGoShop}>Перейти до покупок</button>
        <Link to="/wishlist" className="rect-54">У вишлист</Link>
      </div>
    </div>
  );
}

function FilledCart({ items, getImg, getTitle, getLink, getQty, getPriceUAH, subtotalText, onCheckout, onDecOne, onRemoveLine }) {
  return (
    <div className="filled-wrap">
      <h1 className="filled-title">Корзина</h1>

      {items.map((it, i) => {
        const img = getImg(it);
        const title = getTitle(it);
        const link = getLink(it);
        const qty = getQty(it);
        const priceUAH = getPriceUAH(it);

        return (
          <div key={it.id || it.product_id || i} className="filled-row">
            <div className="photo-wrap">
              <img
                className="cart-thumb"
                src={img}
                alt={title}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.src = IMG_PLACEHOLDER; }}
              />
            </div>

            <div className="filled-info">
              <Link className="filled-name" to={link}>{title}</Link>
              <div className="filled-price">{priceUAH} ₴</div>
            </div>

            <div className="filled-controls">
              <button className="del-btn" type="button" title="Видалити 1 шт" aria-label="Видалити 1 шт" onClick={() => onDecOne(it.product_id || it.id, qty)}>−</button>
              <span className="qty-val">{qty}</span>
              <button className="del-btn danger" type="button" title="Видалити позицію" aria-label="Видалити позицію" onClick={() => onRemoveLine(it.product_id || it.id)}>🗑</button>
            </div>

            <div className="filled-sum">{priceUAH * qty} ₴</div>
          </div>
        );
      })}

      <div className="filled-total">
        <div className="total-left">Разом:</div>
        <div className="total-right">{subtotalText}</div>
      </div>

      <div className="filled-actions">
        <button type="button" className="rect-55" onClick={onCheckout}>Оформити</button>
        <Link to="/catalog" className="rect-54">Продовжити покупки</Link>
      </div>
    </div>
  );
}

function ProductCard({ className = '', title, priceNow, priceOld, rating, image, link = '/product/placeholder' }) {
  const imgSrc = image || imgPoroshok;
  return (
    <div className={`product-card ${className}`}>
      <div className="card-frame" />
      <div className="photo-mask">
        <img
          className="photo-img"
          src={imgSrc}
          alt={title}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.opacity = '0.25'; }}
        />
        <a className="product-link" href={link} aria-label={title} />
        <div className="badge">
          <div className="badge-bg" />
          <img className="badge-img" src={imgDiscount} alt="-20%" />
        </div>
      </div>

      <div className="title">{title}</div>

      <div className="rating">
        <span className="star"><img src={imgStar} alt="" /></span>
        <div className="val">{rating}</div>
      </div>

      <div className="price-row">
        <div className="price-now">{priceNow}</div>
        <div className="price-old">{priceOld}</div>
        <button className="btn-ghost" type="button" aria-label="В обране">
          <img src={imgFav} alt="" />
        </button>
        <button className="btn-green" type="button" aria-label="В корзину">
          <img src={imgBasket} alt="" />
        </button>
      </div>
    </div>
  );
}
