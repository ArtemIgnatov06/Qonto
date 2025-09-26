import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import '../Styles/UserProducts.css';

const UserProducts = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const money = useMemo(() => {
    const lng = i18n.language || 'ru';
    const locale = lng.startsWith('ua') || lng.startsWith('uk') ? 'uk-UA' : 'ru-RU';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'UAH' });
  }, [i18n.language]);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await axios.get('/api/my-products', { withCredentials: true });
      setItems(data.items || []);
    } catch {
      setErr(t('userProducts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const remove = async (id) => {
    if (!window.confirm(t('userProducts.confirmDelete'))) return;
    try {
      await axios.delete(`/api/products/${id}`, { withCredentials: true });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      alert(t('userProducts.deleteFailed'));
    }
  };

  return (
    <div aria-live="polite">
      {loading && <p className="text-muted">{t('common.loading')}</p>}
      {err && <p className="text-danger">{err}</p>}

      {!loading && !items.length && (
        <p className="text-muted">{t('userProducts.empty')}</p>
      )}

      <ul className="up-list">
        {items.map((p) => (
          <li
            key={p.id}
            className="up-item"
            aria-label={t('userProducts.itemAria', { title: p.title })}
          >
            <div>
              <b>{p.title}</b> ({p.category}) — {money.format(Number(p.price) || 0)}
            </div>

            {p.description && (
              <div className="up-desc">{p.description}</div>
            )}

            <div className="up-actions mt-6">
              <button
                className="btn-edit"
                title={t('common.edit')}
                aria-label={t('common.edit')}
                // TODO: сюда повесить переход или модал редактирования
              >
                {t('common.edit')}
              </button>
              <button
                className="btn-delete"
                onClick={() => remove(p.id)}
                title={t('common.delete')}
                aria-label={t('common.delete')}
              >
                {t('common.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserProducts;
