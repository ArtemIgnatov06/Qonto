// pages/ProductNew.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import '../Styles/Profile.css';
import '../Styles/ProductNew.css';

const API = process.env.REACT_APP_API || '';

function stringifyData(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  try { return JSON.stringify(data); } catch { return String(data); }
}
function extractAxiosErr(err, t) {
  if (err?.response) {
    const { status, statusText, data } = err.response;
    const msg =
      data?.message ||
      data?.error ||
      (Array.isArray(data?.errors) && data.errors.filter(Boolean).join(', ')) ||
      stringifyData(data) ||
      statusText ||
      'Server error';
    return `HTTP ${status} — ${msg}`;
  }
  if (err?.request) return t('errors.serverUnavailable');
  return err?.message || t('productNew.errors.saveFailed');
}

const ProductNew = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    qty: 1,
    preview_image_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // категории
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catErr, setCatErr] = useState('');

  useEffect(() => {
    document.title = t('productNew.metaTitle');
  }, [t]);

  // загрузка категорий
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatLoading(true);
      setCatErr('');
      try {
        const res = await axios.get(`${API}/api/categories`, { withCredentials: true });
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (!cancelled) setCategories(items);
      } catch (e) {
        if (!cancelled) setCatErr('Не удалось загрузить категории');
      } finally {
        if (!cancelled) setCatLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // авто-выбор первой категории после загрузки (чтобы не было плейсхолдера)
  useEffect(() => {
    if (!catLoading && !catErr && categories.length && !form.category) {
      setForm(prev => ({ ...prev, category: categories[0].name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catLoading, catErr, categories]);

  if (!user) return <div className="profile-page">{t('auth.required')}</div>;
  if (user.seller_status !== 'approved') {
    return <div className="profile-page">{t('productNew.waitForApproval')}</div>;
  }

  const validImageUrl = (u) =>
    /^https?:\/\/.+\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(u || '');

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);

    const priceNum = Number(form.price);
    const qtyNum = Number.isFinite(Number(form.qty))
      ? Math.max(1, parseInt(form.qty, 10))
      : 1;

    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setErr(t('productNew.errors.priceMustBeNonNegative'));
      return;
    }

    if (form.preview_image_url && !validImageUrl(form.preview_image_url)) {
      setErr(t('productNew.hint.supported'));
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      price: priceNum,
      qty: qtyNum,
      preview_image_url: form.preview_image_url.trim() || null,
    };

    setSaving(true);
    try {
      let url = `${API}/api/products`;
      let resp;
      try {
        resp = await axios.post(url, payload, { withCredentials: true });
      } catch (e1) {
        const status = e1?.response?.status;
        if (status === 404 || status === 405) {
          url = `${API}/products`;
          resp = await axios.post(url, payload, { withCredentials: true });
        } else {
          throw e1;
        }
      }

      const data = resp?.data || {};
      if (data?.ok || data?.item || data?.id) {
        navigate('/');
        return;
      }

      const fallback =
        data?.message ||
        data?.error ||
        (Array.isArray(data?.errors) && data.errors.filter(Boolean).join(', ')) ||
        stringifyData(data);
      setErr(fallback || t('productNew.errors.saveFailed'));
    } catch (e) {
      console.error('Add product failed:', e);
      setErr(extractAxiosErr(e, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <h2>{t('productNew.title')}</h2>
      <form className="card card-narrow" onSubmit={submit}>
        <div className="form-row">
          <label htmlFor="pn-title">{t('productNew.fields.name')}</label>
          <input
            id="pn-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('productNew.placeholders.name')}
            required
            aria-label={t('productNew.fields.name')}
          />
        </div>

        {/* select категорий из API — без плейсхолдера */}
        <div className="form-row">
          <label htmlFor="pn-category">{t('productNew.fields.category')}</label>

          {catLoading ? (
            <div className="text-muted">{t('common.loading')}</div>
          ) : catErr ? (
            <div className="msg error" role="alert">{catErr}</div>
          ) : (
            <select
              id="pn-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
              aria-label={t('productNew.fields.category')}
              disabled={!categories.length}
            >
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="form-row">
          <label htmlFor="pn-price">{t('productNew.fields.price')}</label>
          <input
            id="pn-price"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="0.00"
            required
            aria-label={t('productNew.fields.price')}
          />
        </div>

        <div className="form-row">
          <label htmlFor="pn-qty">{t('productNew.fields.qty')}</label>
          <input
            id="pn-qty"
            type="number"
            min="1"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: e.target.value })}
            placeholder="1"
            aria-label={t('productNew.fields.qty')}
          />
        </div>

        <div className="form-row">
          <label htmlFor="pn-desc">{t('productNew.fields.description')}</label>
          <textarea
            id="pn-desc"
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('productNew.placeholders.description')}
            aria-label={t('productNew.fields.description')}
          />
        </div>

        {/* Превью-картинка по URL */}
        <div className="form-row">
          <label htmlFor="pn-img">{t('productNew.fields.previewUrl')}</label>
          <input
            id="pn-img"
            type="url"
            value={form.preview_image_url}
            onChange={(e) => setForm({ ...form, preview_image_url: e.target.value })}
            placeholder="https://example.com/image.jpg"
            aria-label={t('productNew.fields.previewUrl')}
          />
          <small>{t('productNew.hint.supported')}</small>
        </div>

        {validImageUrl(form.preview_image_url) && (
          <div className="thumb-preview">
            <img
              src={form.preview_image_url}
              alt={t('productNew.previewAlt')}
              className="thumb-fixed"
            />
          </div>
        )}

        <div className="profile-actions">
          <button
            className="btn-primary"
            type="submit"
            disabled={saving || catLoading || !!catErr || !form.category.trim()}
            aria-busy={saving}
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button className="btn-logout" type="button" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </button>
        </div>

        {err && (
          <div className="msg error" role="alert">
            {err}
          </div>
        )}
      </form>
    </div>
  );
};

export default ProductNew;
