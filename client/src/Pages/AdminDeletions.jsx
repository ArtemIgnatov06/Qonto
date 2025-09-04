// client/src/Pages/AdminDeletions.jsx
import React, { useEffect, useMemo, useState } from 'react';
import '../App.css';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';

export default function AdminDeletions() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const locale = useMemo(
    () => (i18n.language?.startsWith('ua') || i18n.language?.startsWith('uk') ? 'uk-UA' : 'ru-RU'),
    [i18n.language]
  );
  const money = useMemo(() => new Intl.NumberFormat(locale, { style: 'currency', currency: 'UAH' }), [locale]);
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }), [locale]);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const r = await fetch('http://localhost:5050/admin/product-deletions', {
          credentials: 'include'
        });
        if (!r.ok) throw new Error('bad status');
        const data = await r.json();
        if (!abort) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (!abort) setError(t('adminDeletions.errors.loadFailed'));
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [t]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="page">
        <h2>{t('admin.accessDenied')}</h2>
      </div>
    );
  }

  return (
    <div className="page page-admin" aria-labelledby="deleted-title">
      <div className="card">
        <h2 id="deleted-title" className="heading-large">{t('adminDeletions.title')}</h2>

        {loading && <p className="text-muted">{t('common.loading')}</p>}
        {error && <p className="text-danger">{error}</p>}

        {!loading && !error && (
          items.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table
                className="table"
                style={{
                  width: '100%',
                  marginTop: 16,
                  borderCollapse: 'separate',
                  borderSpacing: '0 8px',
                }}
                aria-label={t('adminDeletions.tableAria')}
              >
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('adminDeletions.cols.productId')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('adminDeletions.cols.title')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('adminDeletions.cols.category')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('adminDeletions.cols.price')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('adminDeletions.cols.seller')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('adminDeletions.cols.admin')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('adminDeletions.cols.reason')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('adminDeletions.cols.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((d) => (
                    <tr
                      key={d.id}
                      style={{
                        background: '#fafafa',
                        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>{d.product_id}</td>
                      <td style={{ padding: '12px 16px' }}>{d.title}</td>
                      <td style={{ padding: '12px 16px' }}>{d.category}</td>
                      <td style={{ padding: '12px 16px' }}>{money.format(Number(d.price) || 0)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {d.seller_first_name} {d.seller_last_name} ({d.seller_username})
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {d.admin_first_name} {d.admin_last_name} ({d.admin_username})
                      </td>
                      <td style={{ padding: '12px 16px', color: '#d32f2f' }}>{d.reason}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {dateTime.format(new Date(d.created_at))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">{t('adminDeletions.empty')}</p>
          )
        )}
      </div>
    </div>
  );
}
