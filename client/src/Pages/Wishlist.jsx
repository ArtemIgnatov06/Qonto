// client/src/Pages/Wishlist.jsx
import React, { useEffect, useState } from 'react';
import * as WL from '../lib/wishlist.js';
import { Link, useNavigate } from 'react-router-dom';
import '../Styles/Wishlist.css';

import imgPoroshok from '../assets/poroshok2.png';
import imgArrow     from '../assets/arrow.png';
import imgDiscount  from '../assets/discount.png';
import imgStar      from '../assets/star.png';
import imgFav       from '../assets/favorites.png';
import imgBasket    from '../assets/basket.png';
import imgEmpty     from '../assets/wishlist-empty.png';
import imgPlane     from '../assets/catalog/planex.png';

// ✅ встроенный SVG-плейсхолдер (не требует файла на диске)
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

// — выбор src (локальные относительные, абсолютные и внешние через прокси) —
function pickImageSrc(p, API) {
  const raw =
    p?.preview_image_url ||
    p?.image_url ||
    p?.image ||
    (Array.isArray(p?.images) ? p.images[0] : '') ||
    '';

  if (!raw) return IMG_PLACEHOLDER;

  // абсолютный URL?
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

  // относительный путь из БД
  if (raw.startsWith('/')) return `${API}${raw}`;
  return `${API}/uploads/${raw}`;
}

export default function WishlistPage(){
  const [items, setItems] = useState(WL.getItems());
  const navigate = useNavigate();
  const API = process.env.REACT_APP_API || '';

  useEffect(() => {
    const h = () => setItems(WL.getItems());
    window.addEventListener('wishlist:changed', h);
    window.addEventListener('storage', h);
    return () => {
      window.removeEventListener('wishlist:changed', h);
      window.removeEventListener('storage', h);
    };
  }, []);

  // разово догружаем данные из БД, если в localStorage не хватало полей
  useEffect(() => {
    const lacking = items.filter(p =>
      !(p.preview_image_url || p.image_url || (Array.isArray(p.images) && p.images.length)) ||
      p.price == null || !p.title
    );
    if (!lacking.length) return;

    let stop = false;
    (async () => {
      const patches = await Promise.all(lacking.map(async (p) => {
        try {
          const r = await fetch(`${API}/api/products/${p.id}`);
          const d = await r.json().catch(() => ({}));
          const it = d?.item || d;
          if (!r.ok || !it) return null;
          return {
            id: p.id,
            title: it.title ?? p.title ?? '',
            price: it.price ?? p.price ?? null,
            preview_image_url: it.preview_image_url ?? it.image_url ?? null,
            image_url: it.image_url ?? it.preview_image_url ?? null,
            images: Array.isArray(it.images) ? it.images : undefined
          };
        } catch { return null; }
      }));
      if (stop) return;
      patches.filter(Boolean).forEach(WL.upsert);
      setItems(WL.getItems());
    })();
    return () => { stop = true; };
  }, [items, API]);

  const isEmpty = !items || items.length === 0;

  return (
    <div className="wishlist-page">
      {isEmpty ? <EmptyState onGoShop={() => navigate('/catalog')} /> : (
        <FilledWishlist items={items} />
      )}

      <Section title="Хіт продаж" ctaText="Усі категорії" ctaHref="/catalog">
        <div className="cards-grid">
          <ProductCard title="Пральний порошок, 2 кг" priceNow="207 грн" priceOld="259 грн" rating="4,4" image={imgPoroshok} />
          <ProductCard title="Гель для прання, 1 л"     priceNow="189 грн" priceOld="229 грн" rating="4,7" image={imgPoroshok} />
          <ProductCard title="Кондиціонер, 900 мл"      priceNow="165 грн" priceOld="199 грн" rating="4,6" image={imgPoroshok} />
          <ProductCard title="Капсули для прання"       priceNow="239 грн" priceOld="289 грн" rating="4,8" image={imgPoroshok} />
        </div>
      </Section>

      <Section title="Спеціально для вас" ctaText="Більше товарів" ctaHref="/catalog">
        <div className="cards-grid">
          <ProductCard title="Пральний порошок, 2 кг" priceNow="207 грн" priceOld="259 грн" rating="4,4" image={imgPoroshok} />
          <ProductCard title="Гель для прання, 1 л"     priceNow="189 грн" priceOld="229 грн" rating="4,7" image={imgPoroshok} />
          <ProductCard title="Кондиціонер, 900 мл"      priceNow="165 грн" priceOld="199 грн" rating="4,6" image={imgPoroshok} />
          <ProductCard title="Капсули для прання"       priceNow="239 грн" priceOld="289 грн" rating="4,8" image={imgPoroshok} />
        </div>
      </Section>
    </div>
  );
}

function EmptyState({ onGoShop }){
  return (
    <div className="wl-empty">
      <div className="wl-empty__title">Список бажань порожній</div>
      <img className="wl-empty__img" src={imgEmpty} alt="" />
      <button onClick={onGoShop} className="wl-btn" type="button">
        <span className="wl-btn__text">За покупками</span>
        <img className="wl-btn__icon" src={imgPlane} alt="" aria-hidden="true" />
      </button>
    </div>
  );
}

function FilledWishlist({ items }){
  const API = process.env.REACT_APP_API || '';

  async function toCart(id){
    try{
      await fetch(`${API}/api/cart`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify({ product_id:id, qty:1 })
      });
      window.dispatchEvent(new CustomEvent('cart:changed', { detail:{ type:'add', productId:id, qty:1 } }));
    }catch{}
  }
  function removeOne(id){ WL.remove(id); }

  return (
    <div className="wl-filled">
      <h1 className="wl-filled__title">Список бажань</h1>
      {items.map((p) => {
        const image = pickImageSrc(p, API);
        return (
          <div key={p.id} className="wl-row">
            <img
              className="wl-row__img"
              src={image}
              alt={p.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.src = IMG_PLACEHOLDER; }}
            />
            <div className="wl-row__info">
              <Link to={`/product/${p.id}`} className="wl-row__name">{p.title}</Link>
            </div>
            <div className="wl-row__price">
              {Number(p.price ?? 0).toLocaleString('uk-UA', { style: 'currency', currency: 'UAH' })}
            </div>
            <div className="wl-row__actions">
              <button className="wl-ghost" type="button" title="Удалить из списка" onClick={() => removeOne(p.id)}>×</button>
              <button className="wl-green" type="button" title="В корзину" onClick={() => toCart(p.id)}>+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, ctaText, ctaHref, children }){
  return (
    <section className="wl-section">
      <div className="wl-section__hdr">
        <h3 className="wl-h3">{title}</h3>
        <a className="wl-link" href={ctaHref}>
          <span className="text">{ctaText}</span>
          <span className="icon"><img src={imgArrow} alt="" /></span>
        </a>
      </div>
      {children}
    </section>
  );
}

function ProductCard({ title, priceNow, priceOld, rating, image }){
  return (
    <div className="wl-card">
      <div className="wl-card__frame" />
      <div className="wl-card__photo">
        <img className="img" src={image} alt={title} />
        <a className="link" href="/product/placeholder" aria-label={title} />
        <div className="badge">
          <div className="badge__bg" />
          <img className="badge__img" src={imgDiscount} alt="-20%" />
        </div>
      </div>

      <div className="wl-card__title">{title}</div>
      <div className="wl-card__rating">
        <span className="star"><img src={imgStar} alt="" /></span>
        <div className="val">{rating}</div>
      </div>
      <div className="wl-card__bottom">
        <div className="price-now">{priceNow}</div>
        <div className="price-old">{priceOld}</div>
        <button className="btn-ghost" type="button" aria-label="В обране"><img src={imgFav} alt="" /></button>
        <button className="btn-green" type="button" aria-label="В корзину"><img src={imgBasket} alt="" /></button>
      </div>
    </div>
  );
}
