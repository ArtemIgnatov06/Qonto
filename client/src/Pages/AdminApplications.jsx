// client/src/Pages/AdminApplications.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import '../Styles/AdminApplications.css';

export default function AdminApplications() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [status, setStatus] = useState('pending'); // 'pending' | 'approved' | 'rejected'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const abortRef = useRef(null);

  const statusLabel = (s) =>
    s === 'approved' ? t('adminApplications.status.approved')
    : s === 'rejected' ? t('adminApplications.status.rejected')
    : t('adminApplications.status.pending');

  // загрузка списка
  const load = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setErr('');
    try {
      const res = await fetch(
        `http://localhost:5050/admin/applications?status=${status}`,
        { credentials: 'include', signal: controller.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      if (e.name !== 'AbortError') {
        setErr(e.message || t('adminApplications.errors.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [status, t]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const decide = async (id, action) => {
    const body =
      action === 'reject'
        ? { action, reason: prompt(t('adminApplications.prompts.rejectReason')) || '' }
        : { action };

    const res = await fetch(`http://localhost:5050/admin/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      alert(t('adminApplications.errors.saveDecision'));
      return;
    }
    await load();
  };

  if (!user) return <div>{t('auth.required')}</div>;
  if (user.role !== 'admin') return <div>{t('admin.only')}</div>;

  return (
    <div className="container" aria-live="polite">
      <h2>{t('adminApplications.title')}</h2>

      <div className="row-center gap-8 mb-12">
        <label htmlFor="statusSelect">{t('adminApplications.filters.status')}</label>
        <select
          id="statusSelect"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t('adminApplications.filters.status')}
        >
          <option value="pending">{t('adminApplications.status.pending')}</option>
          <option value="approved">{t('adminApplications.status.approved')}</option>
          <option value="rejected">{t('adminApplications.status.rejected')}</option>
        </select>
        <button onClick={load}>{t('common.refresh')}</button>
      </div>

      {loading && <div>{t('common.loading')}</div>}
      {err && <div className="text-danger">{err}</div>}

      {items.map((a) => (
        <div key={a.id} className="card mb-10">
          <div>
            <b>{a.company_name}</b> ({t('adminApplications.labels.inn')}: {a.tax_id})
          </div>
          <div>
            {t('adminApplications.labels.user')}: {a.first_name} {a.last_name} · {a.email} · {a.phone}
          </div>
          {a.price_list_url && (
            <div>
              <a href={a.price_list_url} target="_blank" rel="noreferrer">
                {t('adminApplications.links.priceList')}
              </a>
            </div>
          )}
          {a.comment && (
            <div className="text-dim">
              {t('adminApplications.labels.comment')}: {a.comment}
            </div>
          )}

          {a.status === 'pending' ? (
            <div className="mt-8 row gap-8">
              <button onClick={() => decide(a.id, 'approve')}>
                {t('common.approve')}
              </button>
              <button onClick={() => decide(a.id, 'reject')}>
                {t('common.reject')}
              </button>
            </div>
          ) : (
            <i>
              {t('adminApplications.labels.status')}: {statusLabel(a.status)}
            </i>
          )}
        </div>
      ))}

      {!items.length && !loading && <div>{t('adminApplications.empty')}</div>}
    </div>
  );
}
