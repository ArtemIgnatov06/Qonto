// client/src/Pages/AdminDeletions.jsx
import React, { useEffect, useMemo, useState } from 'react';
import '../App.css';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import '../Styles/AdminDeletions.css';

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
            <div className="table-wrap">
              <table
                className="table admin-table"
                aria-label={t('adminDeletions.tableAria')}
              >
                <thead>
                  <tr>
                    <th className="th-cell">{t('adminDeletions.cols.productId')}</th>
                    <th className="th-cell">{t('adminDeletions.cols.title')}</th>
                    <th className="th-cell">{t('adminDeletions.cols.category')}</th>
                    <th className="th-cell">{t('adminDeletions.cols.price')}</th>
                    <th className="th-cell">{t('adminDeletions.cols.seller')}</th>
                    <th className="th-cell">{t('adminDeletions.cols.admin')}</th>
                    <th className="th-cell">{t('adminDeletions.cols.reason')}</th>
                    <th className="th-cell">{t('adminDeletions.cols.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((d) => (
                    <tr key={d.id} className="admin-row">
                      <td className="pad-12-16">{d.product_id}</td>
                      <td className="pad-12-16">{d.title}</td>
                      <td className="pad-12-16">{d.category}</td>
                      <td className="pad-12-16">{money.format(Number(d.price) || 0)}</td>
                      <td className="pad-12-16">
                        {d.seller_first_name} {d.seller_last_name} ({d.seller_username})
                      </td>
                      <td className="pad-12-16">
                        {d.admin_first_name} {d.admin_last_name} ({d.admin_username})
                      </td>
                      <td className="td-reason">{d.reason}</td>
                      <td className="pad-12-16">
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
