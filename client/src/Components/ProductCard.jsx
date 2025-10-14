// client/src/Components/ProductCard.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import * as WL from '../lib/wishlist.js';

// ✅ встроенный SVG-плейсхолдер
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

function buildImgSrc(product, API) {
  const raw =
    product?.preview_image_url ||
    product?.image_url ||
    (Array.isArray(product?.images) ? product.images[0] : '') ||
    '';
  if (!raw) return IMG_PLACEHOLDER;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const apiHost = API ? new URL(API).hostname : '';
      if (typeof window !== 'undefined' &&
          u.hostname !== window.location.hostname &&
          u.hostname !== apiHost) {
        return `${API}/api/proxy-img?u=${encodeURIComponent(raw)}`;
      }
    } catch {}
    return raw;
  }
  if (raw.startsWith('/')) return `${API}${raw}`;
  return `${API}/uploads/${raw}`;
}

export default function ProductCard({ product, onBuy }) {
  const { t } = useTranslation();
  const { convertFromUAH, formatMoney } = useCurrency();
  const { id, title, price, seller_name, category } = product || {};
  const API = process.env.REACT_APP_API || '';

  const [isFav, setIsFav] = useState(() => WL.has(id));
  useEffect(() => { setIsFav(WL.has(id)); }, [id]);
  const toggleFav = () => { WL.toggle(product); setIsFav(WL.has(id)); };

  const priceUAH = useMemo(() => {
    const v = Number(price);
    return Number.isFinite(v) ? v : null;
  }, [price]);

  const imgSrc = useMemo(() => buildImgSrc(product, API), [product, API]);
  const priceText = useMemo(() => {
    if (priceUAH === null) return '—';
    const converted = convertFromUAH(priceUAH);
    return formatMoney(converted);
  }, [priceUAH, convertFromUAH, formatMoney]);

  return (
    <div className="product-card" aria-label={t('product.cardAria', { title })}>
      <Link to={`/product/${id}`} className="thumb" title={t('product.openDetails')} aria-label={t('product.openDetails')}>
        <img
          src={imgSrc}
          alt={title}
          className="thumb-fixed"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e)=>{ e.currentTarget.src = IMG_PLACEHOLDER; }}
        />
      </Link>

      <h3><Link to={`/product/${id}`} title={t('product.openDetails')}>{title}</Link></h3>
      <div className="meta"><span>{category}</span> · <span>{seller_name}</span></div>

      <div className="row">
        <div className="price" aria-label={t('product.priceAria', { price: priceText })}>{priceText}</div>
        <button
          onClick={toggleFav}
          className={`btn btn-heart ${isFav ? 'is-fav' : ''}`}
          type="button"
          aria-pressed={isFav}
          title={isFav ? t('wishlist.remove') : t('wishlist.add')}
        >♥</button>
        <button
          onClick={() => onBuy?.(product)}
          className="btn"
          type="button"
          aria-label={t('product.buy')}
          title={t('product.buy')}
        >{t('product.buy')}</button>
      </div>
    </div>
  );
}
