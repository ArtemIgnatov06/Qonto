// client/src/Pages/Search.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { catalogItems } from '../data/catalogItems';
import '../Styles/Home.css';
import planex from '../assets/planex.png';
import cartPng from '../assets/cart.png';
import * as WL from '../lib/wishlist.js';

const API = process.env.REACT_APP_API || 'http://localhost:5050';

/* --------------------------- утилиты fetch --------------------------- */
function pickMessage(r, data, fallback) {
  return (
    data?.message ||
    data?.error ||
    (Array.isArray(data?.errors) && data.errors.filter(Boolean).join(', ')) ||
    `${r?.status || ''} ${r?.statusText || ''}`.trim() ||
    fallback
  );
}
async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  const txt = await r.text();
  const data = txt ? (() => { try { return JSON.parse(txt); } catch { return {}; } })() : {};
  return { r, data };
}
function useQuery() {
  const { search } = useLocation();
  return useMemo(() => Object.fromEntries(new URLSearchParams(search)), [search]);
}

/* --------------------------- изображения товара --------------------------- */
function makeAbs(u) {
  if (!u || typeof u !== 'string') return '';
  const s = u.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return `${API}${s}`;
  return `${API}/${s}`;
}
function getImageCandidates(p) {
  const cand = [
    p.image_url, p.preview_image_url, p.main_image_url, p.mainImageUrl,
    p.cover_url, p.photo_url, p.image, p.thumbnail_url,
    p.images && p.images[0]?.url, p.photos && p.photos[0]?.url,
    p.urls && p.urls.main, p.files && p.files.main,
  ].filter(Boolean).map(makeAbs);

  const bases = [
    `${API}/uploads/products/${p.id}/main`,
    `${API}/uploads/${p.id}/main`,
    `${API}/api/products/${p.id}/image`,
    `${API}/products/${p.id}/image`,
    `${API}/uploads/images/${p.id}`,
  ];
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'];
  bases.forEach(b => exts.forEach(ext => cand.push(`${b}.${ext}`)));
  return [...new Set(cand.filter(Boolean))];
}
function ProductImage({ product, alt }) {
  const candidates = getImageCandidates(product);
  const [idx, setIdx] = React.useState(0);
  const url = candidates[idx] || '/placeholder.svg';
  return (
    <img
      className="pcard-img"
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        if (idx < candidates.length - 1) setIdx(i => i + 1);
        else { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder.svg'; }
      }}
    />
  );
}

/* --------------------------- DualRange --------------------------- */
function DualRange({ min = 0, max = 100000, valueMin, valueMax, onChange }) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo));
  const vMin = clamp(valueMin ?? min, min, max);
  const vMax = clamp(valueMax ?? max, min, max);
  const left = ((vMin - min) / (max - min)) * 100;
  const right = 100 - ((vMax - min) / (max - min)) * 100;

  return (
    <div className="dr-wrap" aria-label="Слайдер ціни">
      <div className="dr-track" />
      <div className="dr-progress" style={{ left: `${left}%`, right: `${right}%` }} />
      <input
        type="range" min={min} max={max} value={vMin}
        onChange={(e)=>onChange({ from: clamp(+e.target.value, min, vMax), to: vMax })}
        className="dr-range dr-range--min" aria-label="Мінімальна ціна"
      />
      <input
        type="range" min={min} max={max} value={vMax}
        onChange={(e)=>onChange({ from: vMin, to: clamp(+e.target.value, vMin, max) })}
        className="dr-range dr-range--max" aria-label="Максимальна ціна"
      />
      <div className="dr-thumb" style={{ left: `calc(${100 - right}% - 5px)` }} />
    </div>
  );
}

/* ============================ Search Page ============================ */
export default function Search() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { q = '' } = useQuery();

  // данные
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // избранное
  const [favIds, setFavIds] = useState(() => new Set(WL.getIds()));
  useEffect(() => {
    const sync = () => setFavIds(new Set(WL.getIds()));
    window.addEventListener('wishlist:changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('wishlist:changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // фильтры
  const [flt, setFlt] = useState({
    inStock: false, outStock: false, hit: false, isNew: false,
    promo: 'any', ratingMin: 0, priceFrom: '', priceTo: '',
    catsChecked: new Set(),
  });

  // загрузка
  const pageSize = 24;
  const load = async (p = 1) => {
    setLoading(true);
    try {
      const url = `${API}/api/search?q=${encodeURIComponent(q)}&page=${p}&pageSize=${pageSize}`;
      const { r, data } = await fetchJson(url, { credentials: 'include' });
      if (!r.ok) throw new Error(pickMessage(r, data, 'Search failed'));
      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      setTotal(Number(data.total || list.length));
      setPage(Number(data.page || p));
    } catch (e) {
      console.error(e); setItems([]); setTotal(0);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(1); /* eslint-disable-line */ }, [q]);

  // отображение (локальные фильтры на текущей странице)
  const viewItems = useMemo(() => {
    const from = Number.isFinite(Number(flt.priceFrom)) && flt.priceFrom !== '' ? Number(flt.priceFrom) : null;
    const to   = Number.isFinite(Number(flt.priceTo)) && flt.priceTo !== '' ? Number(flt.priceTo) : null;
    const cats = flt.catsChecked;

    return items.filter(p => {
      if (cats.size > 0) {
        const name = (p.category || p.category_name || '').trim();
        if (!cats.has(name)) return false;
      }
      const inStock = Boolean(p.in_stock ?? p.inStock ?? p.available);
      if (flt.inStock && !inStock) return false;
      if (flt.outStock && inStock) return false;

      const isHit = Boolean(p.is_hit ?? p.hit ?? (p.orders_count > 20));
      if (flt.hit && !isHit) return false;

      const isNew = Boolean(p.is_new ?? p.new ?? (Date.now() - new Date(p.created_at || 0).getTime() < 1000*60*60*24*30));
      if (flt.isNew && !isNew) return false;

      const hasPromo = Number(p.old_price) > Number(p.price) || Number(p.discount_percent) > 0;
      if (flt.promo === 'yes' && !hasPromo) return false;
      if (flt.promo === 'no' && hasPromo) return false;

      const r = Number(p.rating ?? p.avg_rating);
      if (Number.isFinite(r) && r < flt.ratingMin) return false;

      const price = Number(p.price);
      if (from !== null && price < from) return false;
      if (to   !== null && price > to) return false;

      return true;
    });
  }, [items, flt]);

  // утилиты
  const moneyUAH = (n) => (Number(n) || 0).toLocaleString('uk-UA') + ' ₴';
  const getDiscountPct = (p) => {
    if (Number.isFinite(p?.discount_percent)) return Math.max(0, Math.round(p.discount_percent));
    const old = Number(p?.old_price); const price = Number(p?.price);
    if (old > price && price > 0) return Math.round((1 - price / old) * 100);
    return null;
  };
  const getRating = (p) => {
    const r = Number(p?.rating ?? p?.avg_rating);
    return Number.isFinite(r) ? Math.max(0, Math.min(5, r)) : null;
  };
  const handleBuy = (p) => nav(`/product/${p.id}`);

  return (
    <div className="page page-home" style={{ paddingRight: 0 }}>
      {/* сетка + правая колонка */}
      <div
        className="catalog-layout"
        style={{
          display:'grid',
          gridTemplateColumns:'max-content 320px',
          gap:24,
          width:'max-content',
          margin:'0 auto',
          alignItems:'start'
        }}
      >
        {/* ЛЕВАЯ КОЛОНКА — заголовок + грид */}
        <div className="products-col">
          {/* заголовок на одной линии со стартом сетки */}
          <div
            className="search-head"
            style={{ width:'calc(268px * 4 + 16px * 3)', margin:'0 0 16px', display:'flex', alignItems:'center', gap:10 }}
          >
            <button
              type="button"
              onClick={() => nav(-1)}
              style={{ border:'none', background:'transparent', padding:0, cursor:'pointer', display:'inline-flex', alignItems:'center' }}
              aria-label="Назад"
              title="Назад"
            >
              <img src={planex} alt="Назад" style={{ width:24, height:24, display:'block' }}/>
            </button>
            <div>
              <h2 style={{ margin:0, fontWeight:600 }}>
                Результати пошуку <span style={{ color:'#35C65E' }}>“{q}”</span>
              </h2>
              <div className="muted" style={{ marginTop:4 }}>Знайдено {total} товар(ів)</div>
            </div>
          </div>

          {/* грид товаров */}
          {loading ? (
            <p className="text-muted">Завантаження…</p>
          ) : viewItems.length ? (
            <div
              className="products-grid products-grid-4"
              style={{ display:'grid', gridTemplateColumns:'repeat(4, 268px)', columnGap:16, rowGap:16, justifyContent:'center' }}
            >
              {viewItems.map((p) => {
                const priceText = moneyUAH(p.price);
                const oldPriceText = Number(p?.old_price) > Number(p?.price) ? moneyUAH(p.old_price) : null;
                const discount = getDiscountPct(p);
                const rating = getRating(p);
                const isFav = favIds.has(p.id);

                return (
                  <div className="pcard" key={p.id} style={{ position: 'relative' }}>
                    {/* кликабельная карточка снизу — кнопки выше по z-index */}
                    <Link to={`/product/${p.id}`} className="pcard-link" />

                    {/* Фото + бейдж */}
                    <div className="pcard-photo">
                      <div className="pcard-photo-bg" />
                      <ProductImage product={p} alt={p.title} />
                      {discount !== null && (
                        <span className="pcard-badge" aria-label={`-${discount}%`}>
                          <span className="pcard-badge-bg" />
                          <span className="pcard-badge-txt">-{discount}%</span>
                        </span>
                      )}
                    </div>

                    {/* Рамка */}
                    <span className="pcard-frame" aria-hidden="true" />

                    {/* Заголовок */}
                    <div className="pcard-title" title={p.title}>{p.title}</div>

                    {/* Рейтинг */}
                    {rating !== null && (
                      <>
                        <span className="pcard-star" aria-hidden="true">
                          <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.53956 0.945312L9.25112 3.09285C9.61658 4.18592 10.231 5.17911 11.046 5.99408C11.861 6.80905 12.8542 7.42352 13.9472 7.78898L16.0948 8.5005L13.9472 9.21206C12.8542 9.57752 11.861 10.1919 11.046 11.0069C10.231 11.8219 9.61658 12.8151 9.25112 13.9081L8.53956 16.0557L7.82804 13.9081C7.46258 12.8151 6.84811 11.8219 6.03314 11.0069C5.21817 10.1919 4.22498 9.57752 3.13192 9.21206L0.984375 8.5005L3.13192 7.78898C4.22498 7.42352 5.21817 6.80905 6.03314 5.99408C6.84811 5.17911 7.46258 4.18592 7.82804 3.09285L8.53956 0.945312Z" fill="#7AD293"/>
                          </svg>
                        </span>
                        <span className="pcard-rating">{rating.toFixed(1)}</span>
                      </>
                    )}

                    {/* Цена + кнопки */}
                    <div className="pcard-price">
                      <span className="pcard-price-now">{priceText}</span>
                      {oldPriceText && <span className="pcard-price-old">{oldPriceText}</span>}

                      {/* В избранное */}
                      <button
                        type="button"
                        className="pcard-btn pcard-btn--ghost"              // поднято чуть выше
                        title="В обране"
                        aria-label="В обране"
                        onClick={(e) => { e.preventDefault(); WL.toggle(p); }}
                      >
                        <svg width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M15.2246 0.75C18.019 0.75 20.2498 3.015 20.25 5.99414C20.25 7.81105 19.4674 9.51946 17.9502 11.4463C16.4239 13.3846 14.2268 15.4572 11.5088 18.0156L11.5078 18.0166L10.5 18.9688L9.49219 18.0166L9.49121 18.0156L7.55273 16.1816C5.71675 14.4287 4.19444 12.8999 3.0498 11.4463C1.53256 9.51946 0.75 7.81105 0.75 5.99414C0.750204 3.015 2.98099 0.75 5.77539 0.75C7.36492 0.750127 8.91095 1.52247 9.92188 2.74512L10.5 3.44434L11.0781 2.74512C12.0891 1.52247 13.6351 0.750126 15.2246 0.75Z"
                            stroke={isFav ? '#35C65E' : '#363535'}
                            strokeWidth="1.5"
                            fill={isFav ? '#35C65E' : 'none'}
                          />
                        </svg>
                      </button>

                      {/* В корзину (клик не проваливается, выше по z-index) */}
                      <button
                        type="button"
                        className="pcard-btn pcard-btn--green"                
                        title="У кошик"
                        aria-label="У кошик"
                        onClick={(e) => { e.preventDefault(); handleBuy(p); }}
                      >
                      <img
                        src={cartPng}
                        alt="У кошик"
                        style={{ width: 20, height: 20, display: 'block', objectFit: 'contain' }}
                        draggable={false}
                      />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted">Нічого не знайдено.</p>
          )}

          {/* пагинация */}
          {total > pageSize && (
            <div className="pager" style={{ display:'flex', gap:12, alignItems:'center', marginTop:16 }}>
              <button disabled={page <= 1} onClick={() => load(page - 1)}>Назад</button>
              <span>{page}</span>
              <button disabled={(page * pageSize) >= total} onClick={() => load(page + 1)}>Вперед</button>
            </div>
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА — фильтры */}
        <aside className="filters-sidebar" aria-label="Фільтри пошуку">
          {/* Ціна */}
          <div className="fg">
            <div className="fg-title">Ціна</div>
            <DualRange
              min={0}
              max={100000}
              valueMin={flt.priceFrom === '' ? 0 : +flt.priceFrom}
              valueMax={flt.priceTo === '' ? 100000 : +flt.priceTo}
              onChange={({ from, to }) => setFlt(s => ({ ...s, priceFrom: from, priceTo: to }))}
            />
            <div className="fg-row">
              <span>від</span>
              <input type="number" inputMode="numeric" value={flt.priceFrom}
                     onChange={(e)=>setFlt(s=>({...s,priceFrom:e.target.value}))}
                     className="fg-input-underline w-80" placeholder="0"/>
              <span>до</span>
              <input type="number" inputMode="numeric" value={flt.priceTo}
                     onChange={(e)=>setFlt(s=>({...s,priceTo:e.target.value}))}
                     className="fg-input-underline w-100" placeholder="100000"/>
            </div>
          </div>

          {/* Наявність */}
          <div className="fg">
            <div className="fg-title">Наявність</div>
            <label className="chk">
              <input type="checkbox" checked={flt.inStock} onChange={e=>setFlt(s=>({...s,inStock:e.target.checked}))}/>
              <span>В наявності</span>
            </label>
            <label className="chk">
              <input type="checkbox" checked={flt.outStock} onChange={e=>setFlt(s=>({...s,outStock:e.target.checked}))}/>
              <span>Немає в наявності</span>
            </label>
          </div>

          {/* Акційний товар */}
          <div className="fg">
            <div className="fg-title">Акційний товар</div>
            <label className="chk">
              <input type="radio" name="promo" checked={flt.promo==='yes'} onChange={()=>setFlt(s=>({...s,promo:'yes'}))}/>
              <span>Так</span>
            </label>
            <label className="chk">
              <input type="radio" name="promo" checked={flt.promo==='no'} onChange={()=>setFlt(s=>({...s,promo:'no'}))}/>
              <span>Ні</span>
            </label>
            <label className="chk">
              <input type="radio" name="promo" checked={flt.promo==='any'} onChange={()=>setFlt(s=>({...s,promo:'any'}))}/>
              <span>Будь-який</span>
            </label>
          </div>

          {/* Категорія товарів */}
          <div className="fg">
            <div className="fg-title">Категорія товарів</div>
            <div className="cat-scroll">
              {catalogItems.map(ci => {
                const name = ci.title;
                const checked = flt.catsChecked.has(name);
                return (
                  <label key={ci.key} className="chk">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(flt.catsChecked);
                        if (e.target.checked) next.add(name); else next.delete(name);
                        setFlt(s => ({ ...s, catsChecked: next }));
                      }}
                    />
                    <span>{name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Рейтинг */}
          <div className="fg">
            <div className="fg-title">Рейтинг</div>
            <div className="star-row" role="group" aria-label="Мінімальний рейтинг">
              {[1,2,3,4,5].map(v => (
                <button
                  key={v}
                  type="button"
                  className={`star-btn ${flt.ratingMin >= v ? 'on' : ''}`}
                  onClick={() => setFlt(s => ({ ...s, ratingMin: v }))}
                  title={`від ${v}+`}
                  aria-pressed={flt.ratingMin >= v}
                >
                  <svg width="31" height="31" viewBox="0 0 31 31" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M9.58194 25.8615C8.82538 26.3179 7.892 25.6407 8.09113 24.7798L9.45416 18.8873C9.53763 18.5265 9.41481 18.149 9.13495 17.9064L4.56232 13.9421C3.89479 13.3633 4.25074 12.2666 5.1309 12.1902L11.1772 11.6654C11.5464 11.6333 11.8676 11.3998 12.0118 11.0584L14.3562 5.51145C14.7004 4.69718 15.8543 4.69718 16.1985 5.51145L18.5428 11.0584C18.6871 11.3998 19.0083 11.6333 19.3775 11.6654L25.4238 12.1902C26.3039 12.2666 26.6599 13.3633 25.9924 13.9421L21.4197 17.9064C21.1399 18.149 21.017 18.5265 21.1005 18.8873L22.4636 24.7798C22.6627 25.6407 21.7293 26.3179 20.9727 25.8615L15.7939 22.7374C15.4762 22.5457 15.0785 22.5457 14.7608 22.7374L9.58194 25.8615Z"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Популярність */}
          <div className="fg">
            <div className="fg-title">Популярність</div>
            <label className="chk">
              <input type="checkbox" checked={flt.hit} onChange={e=>setFlt(s=>({...s,hit:e.target.checked}))}/>
              <span>Хіт продажів</span>
            </label>
            <label className="chk">
              <input type="checkbox" checked={flt.isNew} onChange={e=>setFlt(s=>({...s,isNew:e.target.checked}))}/>
              <span>Новинка</span>
            </label>
          </div>
        </aside>
      </div>
    </div>
  );
}
