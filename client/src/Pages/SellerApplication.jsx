// client/src/Pages/SellerApplication.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import '../Styles/SellerApplication.css';

export default function SellerApplication() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    company_name: '',
    tax_id: '',
    price_list_url: '',
    comment: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    document.title = t('sellerApply.metaTitle');
  }, [t]);

  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        company_name: prev.company_name || `${user.first_name || ''} ${user.last_name || ''}`.trim()
      }));
    }
  }, [user]);

  if (!user) {
    return <div className="container pad-24-16">{t('auth.required')}</div>;
  }

  if (user.seller_status === 'approved') {
    return (
      <div className="container pad-24-16">
        <h2>{t('sellerApply.alreadySeller')}</h2>
        <button className="btn-login mt-12" onClick={() => navigate('/profile')}>
          {t('sellerApply.backToProfile')}
        </button>
      </div>
    );
  }

  if (user.seller_status === 'pending') {
    return (
      <div className="container pad-24-16">
        <h2>{t('sellerApply.pending.title')}</h2>
        <p>{t('sellerApply.pending.text')}</p>
        <button className="btn-login mt-12" onClick={() => navigate('/profile')}>
          {t('sellerApply.backToProfile')}
        </button>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch('http://localhost:5050/seller/apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.company_name.trim(),
          tax_id: form.tax_id.trim(),
          price_list_url: form.price_list_url.trim() || undefined,
          comment: form.comment.trim()
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || t('sellerApply.errors.submitFailed'));
      }

      setMsg(t('sellerApply.sent'));
      await refresh();
    } catch (e2) {
      setErr(e2.message || t('sellerApply.errors.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container page-container">
      <h2 className="mb-16">{t('sellerApply.title')}</h2>

      {/* Блок с личными данными пользователя */}
      <div className="user-info-box">
        <div className="grid-2 gap-12">
          <div>
            <label className="muted-12">{t('forms.firstName')}</label>
            <input value={user.first_name || ''} readOnly className="input w-full" />
          </div>
          <div>
            <label className="muted-12">{t('forms.lastName')}</label>
            <input value={user.last_name || ''} readOnly className="input w-full" />
          </div>
          <div>
            <label className="muted-12">Email</label>
            <input value={user.email || ''} readOnly className="input w-full" />
          </div>
          <div>
            <label className="muted-12">{t('sellerApply.fields.phone')}</label>
            <input value={user.phone || ''} readOnly className="input w-full" />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-grid-12">
        <div className="grid-2 gap-12">
          <div>
            <label className="label-12">
              {t('sellerApply.fields.company')} *
            </label>
            <input
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              required
              className="input w-full"
              placeholder={t('sellerApply.placeholders.company')}
              aria-label={t('sellerApply.fields.company')}
            />
          </div>

          <div>
            <label className="label-12">
              {t('sellerApply.fields.taxId')} *
            </label>
            <input
              name="tax_id"
              value={form.tax_id}
              onChange={handleChange}
              required
              className="input w-full"
              placeholder={t('sellerApply.placeholders.taxId')}
              aria-label={t('sellerApply.fields.taxId')}
            />
          </div>
        </div>

        <div>
          <label className="label-12">
            {t('sellerApply.fields.priceList')}
          </label>
          <input
            name="price_list_url"
            value={form.price_list_url}
            onChange={handleChange}
            className="input w-full"
            placeholder="https://..."
            aria-label={t('sellerApply.fields.priceList')}
          />
        </div>

        <div>
          <label className="label-12">
            {t('sellerApply.fields.comment')}
          </label>
          <textarea
            name="comment"
            value={form.comment}
            onChange={handleChange}
            className="input w-full textarea-vert"
            placeholder={t('sellerApply.placeholders.comment')}
            rows={6}
            aria-label={t('sellerApply.fields.comment')}
          />
        </div>

        <div className="row gap-12">
          <button
            type="submit"
            className="btn-login"
            disabled={submitting}
          >
            {submitting ? t('sellerApply.sending') : t('sellerApply.send')}
          </button>
          <button
            type="button"
            className="btn-login btn-grey"
            onClick={() => navigate('/profile')}
          >
            {t('sellerApply.backToProfile')}
          </button>
          {msg && <div className="msg-ok" role="status">{msg}</div>}
          {err && <div className="msg-err" role="alert">{err}</div>}
        </div>
      </form>
    </div>
  );
}
