import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import '../Styles/Profile.css';
import '../Styles/ProductEdit.css';

const API = process.env.REACT_APP_API || '';

const validImageUrl = (u) => /^https?:\/\/.+\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(u || '');

export default function ProductEdit() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '', description: '', price: '', category: '', qty: 1, preview_image_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catErr, setCatErr] = useState('');

  useEffect(() => { document.title = t('productEdit.metaTitle'); }, [t]);

  // load product
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        let r;
        try {
          r = await axios.get(`${API}/api/products/${id}`, { withCredentials: true });
        } catch (e1) {
          if ([404,405].includes(e1?.response?.status)) {
            r = await axios.get(`${API}/products/${id}`, { withCredentials: true });
          } else { throw e1; }
        }
        const p = r.data?.item || r.data;
        if (!p) throw new Error('Not found');
        if (!cancel) {
          setForm({
            title: p.title || '',
            description: p.description || '',
            price: String(p.price ?? ''),
            category: p.category || '',
            qty: p.qty ?? 1,
            preview_image_url: p.preview_image_url || ''
          });
        }
      } catch (e) {
        if (!cancel) setErr(e?.response?.data?.message || e.message || t('productEdit.errors.loadFailed'));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [id, t]);

  // load categories
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
        if (!cancelled) setCatErr(t('productEdit.errors.categoriesLoadFailed'));
      } finally {
        if (!cancelled) setCatLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  if (!user) return <div className="page"><p>{t('auth.required')}</p></div>;
  if (user.seller_status !== 'approved') {
    return <div className="page"><p>{t('productNew.waitForApproval')}</p></div>;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');

    const priceNum = Number(form.price);
    const qtyNum = Number.isFinite(Number(form.qty)) ? Math.max(1, parseInt(form.qty, 10)) : 1;
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
      let r;
      try {
        r = await axios.put(`${API}/api/products/${id}`, payload, { withCredentials: true });
      } catch (e1) {
        if ([404,405].includes(e1?.response?.status)) {
          r = await axios.put(`${API}/products/${id}`, payload, { withCredentials: true });
        } else { throw e1; }
      }
      if (r.status >= 200 && r.status < 300) {
        navigate('/my/products');
        return;
      }
      setErr(r.data?.message || t('productEdit.errors.saveFailed'));
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || t('productEdit.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="card card-narrow">
        <div className="row-center gap-12">
          <h2 className="heading-large">{t('productEdit.title')}</h2>
        </div>

        {loading ? (
          <p className="text-muted">{t('common.loading')}</p>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="form-row">
              <label htmlFor="pe-title">{t('productNew.fields.name')}</label>
              <input
                id="pe-title"
                value={form.title}
                onChange={(e)=>setForm({...form, title:e.target.value})}
                required
              />
            </div>

            <div className="form-row">
              <label htmlFor="pe-category">{t('productNew.fields.category')}</label>
              {catLoading ? (
                <div className="text-muted">{t('common.loading')}</div>
              ) : catErr ? (
                <div className="msg error" role="alert">{catErr}</div>
              ) : (
                <select
                  id="pe-category"
                  value={form.category}
                  onChange={(e)=>setForm({...form, category:e.target.value})}
                  required
                  disabled={!categories.length}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-row">
              <label htmlFor="pe-price">{t('productNew.fields.price')}</label>
              <input
                id="pe-price"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e)=>setForm({...form, price:e.target.value})}
                required
              />
            </div>

            <div className="form-row">
              <label htmlFor="pe-qty">{t('productNew.fields.qty')}</label>
              <input
                id="pe-qty"
                type="number"
                min="1"
                value={form.qty}
                onChange={(e)=>setForm({...form, qty:e.target.value})}
              />
            </div>

            <div className="form-row">
              <label htmlFor="pe-desc">{t('productNew.fields.description')}</label>
              <textarea
                id="pe-desc"
                rows={5}
                value={form.description}
                onChange={(e)=>setForm({...form, description:e.target.value})}
              />
            </div>

            <div className="form-row">
              <label htmlFor="pe-img">{t('productNew.fields.previewUrl')}</label>
              <input
                id="pe-img"
                type="url"
                value={form.preview_image_url}
                onChange={(e)=>setForm({...form, preview_image_url:e.target.value})}
                placeholder="https://example.com/image.jpg"
              />
              <small>{t('productNew.hint.supported')}</small>
            </div>

            {validImageUrl(form.preview_image_url) && (
              <div className="thumb-preview">
                <img src={form.preview_image_url} alt="preview" className="thumb-fixed" />
              </div>
            )}

            <div className="profile-actions">
              <button className="btn-primary" type="submit" disabled={saving} aria-busy={saving}>
                {saving ? t('common.saving') : t('productEdit.save')}
              </button>
              <button className="btn-logout" type="button" onClick={()=>navigate('/my/products')}>
                {t('common.cancel')}
              </button>
            </div>

            {err && <div className="msg error" role="alert">{err}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
