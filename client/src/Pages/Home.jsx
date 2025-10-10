// client/src/Pages/Home.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import ChatWidget from '../Components/ChatWidget';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import '../App.css';
import '../Styles/Home.css';

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

export default function Home() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { convertFromUAH, formatMoney } = useCurrency();

  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);

  const [categories, setCategories] = useState([]);
  const [catName, setCatName] = useState('');
  const [catLoading, setCatLoading] = useState(true);
  const [catErr, setCatErr] = useState('');

  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const locale = useMemo(
    () => (i18n.language?.startsWith('ua') || i18n.language?.startsWith('uk') ? 'uk-UA' : 'ru-RU'),
    [i18n.language]
  );

  useEffect(() => {
    document.title = t('meta.title.home');
  }, [t]);

  // 1) читаем ?category=... из URL при заходе/смене адресной строки
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get('category') || '';
    setCategory(cat);
  }, [location.search]);

  const loadCategories = async () => {
    setCatLoading(true);
    setCatErr('');
    try {
      const { r, data } = await fetchJsonWithFallback(`${API}/api/categories`, { credentials: 'include' });
      if (!r.ok) throw new Error(pickMessage(r, data, t('home.errors.categoriesLoadFailed')));
      const items = Array.isArray(data.items) ? data.items : [];
      setCategories(items);

      // ВАЖНО: не сбрасываем category, даже если её нет в списке,
      // потому что мы могли прийти из каталога с произвольным значением в URL.
      // Если хочешь автоочистку — раскомментируй:
      // if (category && !items.some(c => c.name === category)) setCategory('');
    } catch (e) {
      setCatErr(e.message || t('home.errors.categoriesLoadFailed'));
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const { r, data } = await fetchJsonWithFallback(`${API}/api/products`, { credentials: 'include' });
        if (!r.ok) {
          console.error('Catalog(all) error:', r.status, data);
          throw new Error(pickMessage(r, data, t('home.errors.loadFailed')));
        }
        if (!abort) {
          const arr = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
          setAllItems(arr);
        }
      } catch (e) {
        if (!abort) setError(e.message || t('home.errors.loadFailed'));
      }
    })();
    return () => { abort = true; };
  }, [t]);

  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const url = new URL(`${API}/api/products`);
        if (category) url.searchParams.set('category', category);

        const { r, data } = await fetchJsonWithFallback(url.toString(), { credentials: 'include' });
        if (!r.ok) {
          console.error('Catalog(list) error:', r.status, data);
          throw new Error(pickMessage(r, data, t('home.errors.loadFailed')));
        }
        if (!abort) {
          const list = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
          setItems(list);
        }
      } catch (e) {
        if (!abort) setError(e.message || t('home.errors.loadFailed'));
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [category, t]);

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
      setItems(prev => prev.filter(i => i.id !== product.id));
      setAllItems(prev => prev.filter(i => i.id !== product.id));
    } catch (e) {
      alert(e.message || t('home.errors.deleteFailed'));
    }
  };

  // 2) меняем категорию в селекте и синхронизируем URL
  const onChangeCategory = (val) => {
    setCategory(val);
    const params = new URLSearchParams(location.search);
    if (val) params.set('category', val);
    else params.delete('category');
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

  return (
    <div className="page page-home">
      <div className="card card-compact">
        <h2 className="heading-large">{t('home.title')}</h2>

        {/* Фильтр по категории */}
        <div className="form-row mb-12">
          <label htmlFor="category" className="label-block mb-6">
            {t('home.filters.category')}
          </label>

          {catLoading ? (
            <div className="text-muted">{t('common.loading')}</div>
          ) : catErr ? (
            <div className="msg error" role="alert">{catErr}</div>
          ) : (
            <select
              id="category"
              value={category}
              onChange={(e) => onChangeCategory(e.target.value)}
              className="select-md"
              aria-label={t('home.filters.category')}
            >
              <option value="">{t('home.filters.all')}</option>
              {categories.map(c => (
                <option value={c.name} key={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── NEW: форма добавления категории для админа */}
        {user?.role === 'admin' && (
          <div className="form-row mb-16">
            <label htmlFor="new-category" className="label-block mb-6">
              {t('home.filters.addCategory')}
            </label>
            <div className="row gap-8">
              <input
                id="new-category"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder={t('home.placeholders.categoryName')}
                aria-label={t('home.placeholders.categoryName')}
              />
              <button
                type="button"
                className="btn-primary"
                disabled={catLoading || !catName.trim()}
                onClick={submitNewCategory}
              >
                {t('home.buttons.add')}
              </button>
            </div>
            {catErr && <div className="msg error mt-6" role="alert">{catErr}</div>}
          </div>
        )}

        {loading && <p className="text-muted">{t('common.loading')}</p>}
        {error && <p className="text-danger">{t('home.errors.loadFailed')}: {error}</p>}

        {!loading && !error && (
          items.length ? (
            <div className="products-grid products-grid-3">
              {items.map(p => {
                const priceText = formatMoney(convertFromUAH(Number(p.price) || 0));
                return (
                  <div className="product-card" key={p.id}>
                    <Link to={`/product/${p.id}`} className="block">
                      <img
                        className="product-thumb"
                        src={p.preview_image_url || '/placeholder.svg'}
                        alt={p.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                    </Link>

                    <div className="product-body">
                      <div className="product-title row-center gap-8">
                        <Link to={`/product/${p.id}`} className="link-plain">
                          <span>{p.title}</span>
                        </Link>

                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleAdminDelete(p)}
                            className="btn-logout btn-compact"
                            title={t('home.buttons.deleteProduct')}
                            aria-label={t('home.buttons.deleteProduct')}
                          >
                            {t('common.delete')}
                          </button>
                        )}
                      </div>

                      {p.category && (
                        <div className="text-muted product-category">
                          {p.category}
                        </div>
                      )}

                      {p.description && (
                        <div className="product-desc">{p.description}</div>
                      )}

                      <div className="row-center gap-12">
                        <div className="product-price">{priceText}</div>

                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleBuy(p)}
                          title={t('product.buy')}
                          aria-label={t('product.buy')}
                        >
                          {t('product.buy')}
                        </button>
                      </div>

                      {p.seller_name && (
                        <div className="product-seller mt-6">
                          {t('home.seller')}: {p.seller_name}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted">{t('home.empty')}</p>
          )
        )}
      </div>

      <ChatWidget visible />
    </div>
  );
}
