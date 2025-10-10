import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../Hooks/useAuth';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import { useTranslation } from 'react-i18next';
import '../App.css';
import '../Styles/MyProducts.css';

const API = process.env.REACT_APP_API || '';

export default function MyProducts() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { convertFromUAH, formatMoney } = useCurrency();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => { document.title = t('myProducts.metaTitle'); }, [t]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!user) return;
      setLoading(true);
      setErr('');
      try {
        let r;
        try {
          r = await axios.get(`${API}/api/my/products`, { withCredentials: true });
        } catch (e1) {
          if ([404, 405].includes(e1?.response?.status)) {
            r = await axios.get(`${API}/my/products`, { withCredentials: true });
          } else { throw e1; }
        }
        const list = Array.isArray(r.data?.items) ? r.data.items : [];
        if (!cancel) setItems(list);
      } catch (e) {
        if (!cancel) setErr(e?.response?.data?.message || e.message || 'Error');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [user]);

  if (!user) return <div className="page"><p>{t('auth.required')}</p></div>;
  if (user.seller_status !== 'approved') {
    return <div className="page"><p>{t('productNew.waitForApproval')}</p></div>;
  }

  return (
    <div className="page">
      <div className="card card-compact">
        <div className="mp-header">
          <h2 className="heading-large">{t('myProducts.title')}</h2>
          <Link className="btn-primary" to="/product/new">{t('myProducts.addNew')}</Link>
        </div>

        {loading && <p className="text-muted">{t('common.loading')}</p>}
        {err && <p className="text-danger">{err}</p>}

        {!loading && !err && (
          items.length ? (
            <div className="products-grid products-grid-3">
              {items.map(p => {
                const priceText = formatMoney(convertFromUAH(Number(p.price) || 0));
                return (
                  <div className="product-card" key={p.id}>
                    <Link to={`/product/${p.id}`} className="mp-block-link">
                      <img
                        className="product-thumb"
                        src={p.preview_image_url || '/placeholder.svg'}
                        alt={p.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder.svg'; }}
                      />
                    </Link>

                    <div className="product-body">
                      <div className="product-title mp-titlebar">
                        <Link to={`/product/${p.id}`} className="link-plain"><span>{p.title}</span></Link>
                      </div>

                      {p.category && <div className="text-muted mp-category">{p.category}</div>}
                      {p.description && <div className="product-desc">{p.description}</div>}

                      <div className="row-center gap-12">
                        <div className="product-price">{priceText}</div>
                        <div className="row gap-8">
                          <Link className="btn-secondary" to={`/product/${p.id}/edit`}>
                            {t('product.edit')}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted">{t('myProducts.empty')}</p>
          )
        )}
      </div>
    </div>
  );
}
