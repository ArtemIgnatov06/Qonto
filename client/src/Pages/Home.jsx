import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import ChatWidget from '../Components/ChatWidget';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import '../App.css';
import '../Styles/Home.css';
import { catalogItems } from '../data/catalogItems'; // путь подправь под свой
import BannerCarousel from '../Components/BannerCarousel';
import * as WL from '../lib/wishlist.js'; // ✅ добавили библиотеку вишлиста

const API = process.env.REACT_APP_API || '';

function pickMessage(r, data, fallback) {
  return (
    data?.message ||
    data?.error ||
    (Array.isArray(data?.errors) && data.errors.filter(Boolean).join(', ')) ||
    `${r?.status || ''} ${r?.statusText || ''}`.trim() ||
    fallback
  );
}

async function fetchJsonWithFallback(pathApiFirst, opts) {
  let r = await fetch(pathApiFirst, opts);
  let raw = await r.text();
  let data = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
  if (r.ok) return { r, data };

  if (r.status === 404 || r.status === 405) {
    const pathNoApi = pathApiFirst.replace('/api/', '/');
    r = await fetch(pathNoApi, opts);
    raw = await r.text();
    data = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
  }
  return { r, data };
}
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
        type="range"
        min={min}
        max={max}
        value={vMin}
        onChange={(e) => onChange({ from: clamp(+e.target.value, min, vMax), to: vMax })}
        className="dr-range dr-range--min"
        aria-label="Мінімальна ціна"
      />
      <input
        type="range"
        min={min}
        max={max}
        value={vMax}
        onChange={(e) => onChange({ from: vMin, to: clamp(+e.target.value, vMin, max) })}
        className="dr-range dr-range--max"
        aria-label="Максимальна ціна"
      />
      
      <div className="dr-thumb" style={{ left: `calc(${100 - right}% - 5px)` }} />
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { convertFromUAH, formatMoney } = useCurrency();

  const [allItems, setAllItems] = useState([]);
  const [itemsByCat, setItemsByCat] = useState([]); // из API по выбранной категории
  const [categories, setCategories] = useState([]);
  const [catName, setCatName] = useState('');
  const [catLoading, setCatLoading] = useState(true);
  const [catErr, setCatErr] = useState('');

  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Избранное: берём из localStorage через wishlist.js и держим синхронно
  const [favIds, setFavIds] = useState(() => new Set(WL.getIds()));
  useEffect(() => {
    const sync = () => setFavIds(new Set(WL.getIds()));
    sync();
    window.addEventListener('wishlist:changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('wishlist:changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // фильтры (правая панель)
  const [flt, setFlt] = useState({
    inStock: false,
    outStock: false,
    hit: false,
    isNew: false,
    promo: 'any',           // 'any' | 'yes' | 'no'
    ratingMin: 0,           // 0..5
    priceFrom: '',
    priceTo: '',
    catsChecked: new Set(), // чекбоксы справа (мультиселект)
  });

  useEffect(() => { document.title = t('meta.title.home'); }, [t]);

  // синк url -> category
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setCategory(params.get('category') || '');
  }, [location.search]);

  // категории
  const loadCategories = async () => {
    setCatLoading(true);
    setCatErr('');
    try {
      const { r, data } = await fetchJsonWithFallback(`${API}/api/categories`, { credentials: 'include' });
      if (!r.ok) throw new Error(pickMessage(r, data, t('home.errors.categoriesLoadFailed')));
      const items = Array.isArray(data.items) ? data.items : [];
      setCategories(items);
    } catch (e) {
      setCatErr(e.message || t('home.errors.categoriesLoadFailed'));
    } finally {
      setCatLoading(false);
    }
  };
  useEffect(() => { loadCategories(); /* eslint-disable-next-line */ }, []);

  // все товары (для локальной фильтрации)
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const { r, data } = await fetchJsonWithFallback(`${API}/api/products`, { credentials: 'include' });
        if (!r.ok) throw new Error(pickMessage(r, data, t('home.errors.loadFailed')));
        if (!abort) {
          const arr = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
          setAllItems(arr);
        }
      } catch (e) {
        if (!abort) setError(e.message || t('home.errors.loadFailed'));
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [t]);

  // товары по выбранной категории (серв. фильтр)
  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const url = new URL(`${API}/api/products`);
        if (category) url.searchParams.set('category', category);
        const { r, data } = await fetchJsonWithFallback(url.toString(), { credentials: 'include' });
        if (!r.ok) throw new Error(pickMessage(r, data, t('home.errors.loadFailed')));
        if (!abort) {
          const list = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
          setItemsByCat(list);
        }
      } catch (e) {
        if (!abort) setError(e.message || t('home.errors.loadFailed'));
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [category, t]);

  // текущее множество для отображения: берем список с сервера по категории (или все), затем применяем локальные фильтры
  const viewItems = useMemo(() => {
    const base = category ? itemsByCat : allItems;
    if (!base?.length) return [];

    const from = Number.isFinite(Number(flt.priceFrom)) && flt.priceFrom !== '' ? Number(flt.priceFrom) : null;
    const to   = Number.isFinite(Number(flt.priceTo)) && flt.priceTo !== '' ? Number(flt.priceTo) : null;

    const cats = flt.catsChecked;

    return base.filter(p => {
      // категории справа (если выбрано хоть что-то)
      if (cats.size > 0) {
        const name = (p.category || p.category_name || '').trim();
        if (!cats.has(name)) return false;
      }

      // наличие
      const inStock = Boolean(p.in_stock ?? p.inStock ?? p.available);
      if (flt.inStock && !inStock) return false;
      if (flt.outStock && inStock) return false;

      // популярность/новинка — эвристики по полям
      const isHit = Boolean(p.is_hit ?? p.hit ?? (p.orders_count > 20));
      if (flt.hit && !isHit) return false;

      const isNew = Boolean(p.is_new ?? p.new ?? (Date.now() - new Date(p.created_at || p.createdAt || 0).getTime() < 1000 * 60 * 60 * 24 * 30));
      if (flt.isNew && !isNew) return false;

      // промо
      const hasPromo = Number(p.old_price) > Number(p.price) || Number(p.discount_percent) > 0;
      if (flt.promo === 'yes' && !hasPromo) return false;
      if (flt.promo === 'no' && hasPromo) return false;

      // рейтинг
      const r = Number(p.rating ?? p.avg_rating);
      if (Number.isFinite(r) && r < flt.ratingMin) return false;

      // цена
      const price = Number(p.price);
      if (from !== null && price < from) return false;
      if (to   !== null && price > to) return false;

      return true;
    });
  }, [allItems, itemsByCat, category, flt]);

  // утилиты
  const money = (uah) => formatMoney(convertFromUAH(Number(uah) || 0));
  const getDiscountPct = (p) => {
    if (Number.isFinite(p?.discount_percent)) return Math.max(0, Math.round(p.discount_percent));
    const old = Number(p?.old_price);
    const price = Number(p?.price);
    if (old > price && price > 0) return Math.round((1 - price / old) * 100);
    return null;
  };
  const getRating = (p) => {
    const r = Number(p?.rating ?? p?.avg_rating);
    return Number.isFinite(r) ? Math.max(0, Math.min(5, r)) : null;
  };

  const onChangeCategory = (val) => {
    setCategory(val);
    const params = new URLSearchParams(location.search);
    if (val) params.set('category', val); else params.delete('category');
    navigate({ pathname: '/', search: params.toString() ? `?${params}` : '' }, { replace: false });
  };

  const submitNewCategory = async () => {
    const name = (catName || '').trim();
    if (!name) return;
    setCatErr('');
    try {
      const { r, data } = await fetchJsonWithFallback(`${API}/admin/categories`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!r.ok) throw new Error(pickMessage(r, data, t('home.errors.categoryCreateFailed')));
      setCatName('');
      await loadCategories();
    } catch (e) {
      setCatErr(e.message || t('home.errors.categoryCreateFailed'));
    }
  };

  const handleBuy = (product) => navigate(`/product/${product.id}`);

  const handleAdminDelete = async (product) => {
    const reason = window.prompt(t('home.prompts.deleteReason', { title: product.title }));
    if (!reason) return;
    try {
      const { r, data } = await fetchJsonWithFallback(
        `${API}/api/admin/products/${product.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        }
      );
      if (!r.ok) throw new Error(pickMessage(r, data, t('home.errors.deleteFailed')));
      // локально выкидываем из обоих наборов
      setAllItems(prev => prev.filter(i => i.id !== product.id));
      setItemsByCat(prev => prev.filter(i => i.id !== product.id));
    } catch (e) {
      alert(e.message || t('home.errors.deleteFailed'));
    }
  };

  return (
  <div className="page page-home" style={{ paddingRight: 0 }}>
    {loading && <p className="text-muted">{t('common.loading')}</p>}
    {error && <p className="text-danger">{t('home.errors.loadFailed')}: {error}</p>}
    
    <div className="hero-wrap">
      <BannerCarousel />
    </div>
    {/* макет: контент + правая панель */}
    <div
      className="catalog-layout"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 24,
        alignItems: 'start'
      }}
    >
      {/* ЛЕВАЯ КОЛОНКА — грид товаров */}
<div className="products-col">
  {!loading && !error && (
    viewItems.length ? (
      <div
        className="products-grid products-grid-4"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 268px)', // 4 фикс-колонки как в макете
          columnGap: 16,                           // маленький горизонтальный отступ
          rowGap: 16,
          justifyContent: 'center',                // на всякий случай
        }}
      >
              {viewItems.map(p => {
                const priceText = money(p.price);
                const oldPriceText = Number(p?.old_price) > Number(p?.price) ? money(p.old_price) : null;
                const discount = getDiscountPct(p);
                const rating = getRating(p);
                const isFav = favIds.has(p.id);

                return (
                  <div className="pcard" key={p.id} style={{ position: 'relative' }}>
                    <Link to={`/product/${p.id}`} className="pcard-link" />

                    {/* Фото + бейдж */}
                    <div className="pcard-photo">
                      <div className="pcard-photo-bg" />
                      <img
                        className="pcard-img"
                        src={p.preview_image_url || '/placeholder.svg'}
                        alt={p.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                      {discount !== null && (
                        <span className="pcard-badge" aria-label={`-${discount}%`}>
                          <span className="pcard-badge-bg" />
                          <span className="pcard-badge-txt">-{discount}%</span>
                        </span>
                      )}
                    </div>

                    {/* Внешняя рамка */}
                    <span className="pcard-frame" aria-hidden="true" />

                    {/* Заголовок */}
                    <div className="pcard-title" title={p.title}>{p.title}</div>

                    {/* Рейтинг справа */}
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

                    {/* Цена + старая цена + кнопки */}
                    <div className="pcard-price">
                      <span className="pcard-price-now">{priceText}</span>
                      {oldPriceText && <span className="pcard-price-old">{oldPriceText}</span>}

                      {/* В избранное */}
                      <button
                        type="button"
                        className="pcard-btn pcard-btn--ghost"
                        title={t('favorites', 'В обране')}
                        aria-label={t('favorites', 'В обране')}
                        onClick={(e) => {
                          e.preventDefault();
                          // ✅ используем wishlist.js — он сохранит в localStorage и разошлет событие
                          WL.toggle(p);
                        }}
                      >
                        <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M15.2246 1.25C18.019 1.25 20.2498 3.515 20.25 6.49414C20.25 8.31105 19.4674 10.0195 17.9502 11.9463C16.4239 13.8846 14.2268 15.9572 11.5088 18.5156L11.5078 18.5166L10.5 19.4688L9.49219 18.5166L9.49121 18.5156L7.55273 16.6816C5.71675 14.9287 4.19444 13.3999 3.0498 11.9463C1.53256 10.0195 0.75 8.31105 0.75 6.49414C0.750204 3.515 2.98099 1.25 5.77539 1.25C7.36492 1.25013 8.91095 2.02247 9.92188 3.24512L10.5 3.94434L11.0781 3.24512C12.0891 2.02247 13.6351 1.25013 15.2246 1.25Z"
                            stroke={isFav ? '#35C65E' : '#363535'}
                            strokeWidth="1.5"
                            fill={isFav ? '#35C65E' : 'none'}
                          />
                        </svg>
                      </button>

                      {/* В корзину */}
                      <button
                        type="button"
                        className="pcard-btn pcard-btn--green"
                        title={t('cart.cart', 'У кошик')}
                        aria-label={t('cart.cart', 'У кошик')}
                        onClick={() => handleBuy(p)}
                      >
                        <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <mask id={`cart-${p.id}`} fill="white">
                            <path d="M16 16.5C14.89 16.5 14 17.39 14 18.5C14 19.0304 14.2107 19.5391 14.5858 19.9142C14.9609 20.2893 15.4696 20.5 16 20.5C16.5304 20.5 17.0391 20.2893 17.4142 19.9142C17.7893 19.5391 18 19.0304 18 18.5C18 17.9696 17.7893 17.4609 17.4142 17.0858C17.0391 16.7107 16.5304 16.5 16 16.5ZM0 0.5V2.5H2L5.6 10.09L4.24 12.54C4.09 12.82 4 13.15 4 13.5C4 14.0304 4.21071 14.5391 4.58579 14.9142C4.96086 15.2893 5.46957 15.5 6 15.5H18V13.5H6.42C6.3537 13.5 6.29011 13.4737 6.24322 13.4268C6.19634 13.3799 6.17 13.3163 6.17 13.25C6.17 13.2 6.18 13.16 6.2 13.13L7.1 11.5H14.55C15.3 11.5 15.96 11.08 16.3 10.47L19.88 4C19.95 3.84 20 3.67 20 3.5C20 3.23478 19.8946 2.98043 19.7071 2.79289C19.5196 2.60536 19.2652 2.5 19 2.5H4.21L3.27 0.5M6 16.5C4.89 16.5 4 17.39 4 18.5C4 19.0304 4.21071 19.5391 4.58579 19.9142C4.96086 15.2893 5.46957 15.5 6 15.5C6.53043 15.5 7.03914 15.5 7.41421 19.9142C7.78929 19.5391 8 19.0304 8 18.5C8 17.9696 7.78929 17.4609 7.41421 17.0858C7.03914 16.7107 6.53043 16.5 6 16.5Z"/>
                          </mask>
                          <path d="M3.27 0.5V-0.25H0V0.5V1.25H3.27В0.5Z" fill="#35C65E" mask={`url(#cart-${p.id})`} />
                          <path d="M20 15.5H18V13.5H20V15.5Z" fill="#35C65E" mask={`url(#cart-${p.id})`} />
                          <path d="M18 13.5V15.5H6V13.5H18Z" fill="#35C65E" mask={`url(#cart-${p.id})`} />
                          <path d="M4 18.5C4 17.39 4.89 16.5 6 16.5V18C5.71843 18 5.5 18.2184 5.5 18.5H4З" fill="#35C65E" mask={`url(#cart-${p.id})`} />
                          <path d="M14 18.5C14 17.39 14.89 16.5 16 16.5V18C15.7184 18 15.5 18.2184 15.5 18.5H14З" fill="#35C65E" mask={`url(#cart-${p.id})`} />
                          <path d="M19 2.5H4.21L3.27 0.5H0V2.5H2L5.6 10.09L4.24 12.54C4.09 12.82 4 13.15 4 13.5C4 14.0304 4.21071 14.5391 4.58579 14.9142C4.96086 15.2893 5.46957 15.5 6 15.5H18V13.5H6.42C6.3537 13.5 6.29011 13.4737 6.24322 13.4268C6.19634 13.3799 6.17 13.3163 6.17 13.25C6.17 13.2 6.18 13.16 6.2 13.13L7.1 11.5H14.55C15.3 11.5 15.96 11.08 16.3 10.47L19.88 4C19.95 3.84 20 3.67 20 3.5C20 3.23478 19.8946 2.98043 19.7071 2.79289C19.5196 2.60536 19.2652 2.5 19 2.5H4.21L3.27 0.5M6 16.5C4.89 16.5 4 17.39 4 18.5C4 19.0304 4.21071 19.5391 4.58579 19.9142C4.96086 15.2893 5.46957 15.5 6 15.5H18V13.5H6.42Z" fill="#35C65E" mask={`url(#cart-${p.id})`} />
                        </svg>
                      </button>
                    </div>

                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleAdminDelete(p)}
                        className="btn-logout btn-compact pcard-admin-del"
                        title={t('home.buttons.deleteProduct')}
                        aria-label={t('home.buttons.deleteProduct')}
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted">{t('home.empty')}</p>
          )
        )}
      </div>

      {/* ПРАВАЯ КОЛОНКА — фильтры */}
      <aside className="filters-sidebar" aria-label="Фільтри каталогу">
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
   const name = ci.title;                // показываем локализованное имя из каталога
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
       {/* невыбранная звезда из твоего SVG; цвет управляем через CSS */}
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

    {/*<ChatWidget autoOpenOnError={false} /> */}
  </div>
);

}