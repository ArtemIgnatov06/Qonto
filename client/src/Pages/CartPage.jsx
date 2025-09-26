// client/src/Pages/CartPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import '../Styles/CartPage.css';

export default function CartPage() {
  const API = process.env.REACT_APP_API || '';
  const nav = useNavigate();
  const { t } = useTranslation();
  const { convertFromUAH, formatMoney } = useCurrency();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API}/api/cart`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || t('errors.generic'));
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setError(e.message || t('errors.serverUnavailable'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotalUAH = useMemo(
    () => items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0),
    [items]
  );

  async function setQty(pid, qty) {
    await fetch(`${API}/api/cart/${pid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ qty }),
    });
    window.dispatchEvent(new Event('cart:changed'));
    load();
  }
  async function removeItem(pid) {
    await fetch(`${API}/api/cart/${pid}`, { method: 'DELETE', credentials: 'include' });
    window.dispatchEvent(new Event('cart:changed'));
    load();
  }

  if (loading) return <div className="pad-24 ta-center">{t('common.loading')}</div>;
  if (error) return <div className="pad-24">{t('common.errorWithMsg', { msg: error })}</div>;

  return (
    <div className="cart-page">
      <h1>{t('cart.pageTitle')}</h1>

      {items.length === 0 ? (
        <div>
          {t('cart.empty')}
          <div className="mt-12">
            <button onClick={() => nav('/')}>&larr; {t('cart.continueShopping')}</button>
          </div>
        </div>
      ) : (
        <>
          <table className="cart-table" aria-label={t('cart.tableAria')}>
            <thead>
              <tr>
                <th className="th-left">{t('cart.cols.product')}</th>
                <th>{t('cart.cols.price')}</th>
                <th>{t('cart.cols.qty')}</th>
                <th>{t('cart.cols.sum')}</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const priceUAH = Number(it.price) || 0;
                const qty = Number(it.qty) || 0;
                const rowSumUAH = priceUAH * qty;

                const priceText = formatMoney(convertFromUAH(priceUAH));
                const rowSumText = formatMoney(convertFromUAH(rowSumUAH));

                return (
                  <tr key={it.product_id} className="row-divider">
                    <td>{it.title}</td>
                    <td>{priceText}</td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={(e) =>
                          setQty(
                            it.product_id,
                            Math.max(1, parseInt(e.target.value || '1', 10))
                          )
                        }
                        className="w-64"
                        aria-label={t('cart.qtyInputAria', { title: it.title })}
                      />
                    </td>
                    <td>{rowSumText}</td>
                    <td>
                      <button
                        onClick={() => removeItem(it.product_id)}
                        aria-label={t('cart.removeItemAria', { title: it.title })}
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="cart-footer">
            <button onClick={() => nav('/')}>&larr; {t('cart.continueShopping')}</button>
            <div className="subtotal-line">
              {t('cart.subtotal')}: <strong>{formatMoney(convertFromUAH(subtotalUAH))}</strong>
              <button onClick={() => nav('/checkout')} className="ml-12">
                {t('cart.checkout')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
