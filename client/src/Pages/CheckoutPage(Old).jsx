// client/src/Pages/CheckoutPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import '../Styles/CheckoutPage.css';

export default function CheckoutPage() {
  const API = process.env.REACT_APP_API || '';
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const { convertFromUAH, formatMoney } = useCurrency();

  const [step, setStep] = useState(1);
  const [summary, setSummary] = useState({ items: [], subtotal: 0 }); // subtotal в UAH

  const [address, setAddress] = useState({ country: '', city: '', street: '', postal: '' });
  const [payment, setPayment] = useState({ cardNumber: '', exp: '', cvc: '' });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const locale = useMemo(
    () => (i18n.language?.startsWith('ua') || i18n.language?.startsWith('uk') ? 'uk-UA' : 'ru-RU'),
    [i18n.language]
  );

  useEffect(() => {
    document.title = t('checkout.title');
  }, [t]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/cart`, { credentials: 'include' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.message || t('errors.generic'));
        const items = Array.isArray(d.items) ? d.items : [];
        const subtotal = items.reduce(
          (s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0),
          0
        ); // в UAH
        setSummary({ items, subtotal });
      } catch (e) {
        setError(e.message || t('errors.serverUnavailable'));
      }
    })();
  }, [API, t]);

  const subtotalText = useMemo(
    () => formatMoney(convertFromUAH(summary.subtotal || 0)),
    [summary.subtotal, convertFromUAH, formatMoney]
  );

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address, payment }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || t('checkout.errors.paymentFailed'));
      alert(
        t('checkout.orderPaid', {
          id: d.order_id,
          brand: (d.brand || '').toString().toUpperCase(),
          last4: d.last4,
        })
      );
      nav('/');
    } catch (e) {
      setError(e.message || t('checkout.errors.submitFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="checkout-page">
      <h1>{t('checkout.title')}</h1>
      {error && <div className="error-msg">{error}</div>}

      <div className="summary-box">
        <strong>{t('checkout.summary')}</strong>{' '}
        {summary.items.length === 0
          ? t('cart.empty')
          : t('checkout.summaryLine', {
              count: summary.items.length,
              total: subtotalText,
            })}
      </div>

      {step === 1 && (
        <div>
          <h3>1) {t('checkout.address.title')}</h3>

          <div className="grid-2 gap-12 grid-max-700">
            <input
              placeholder={t('checkout.address.country')}
              value={address.country}
              onChange={(e) => setAddress({ ...address, country: e.target.value })}
              aria-label={t('checkout.address.country')}
            />
            <input
              placeholder={t('checkout.address.city')}
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              aria-label={t('checkout.address.city')}
            />
            <input
              placeholder={t('checkout.address.street')}
              className="street-span-2"
              value={address.street}
              onChange={(e) => setAddress({ ...address, street: e.target.value })}
              aria-label={t('checkout.address.street')}
            />
            <input
              placeholder={t('checkout.address.postal')}
              value={address.postal}
              onChange={(e) => setAddress({ ...address, postal: e.target.value })}
              aria-label={t('checkout.address.postal')}
            />
          </div>

          <div className="mt-16">
            <button onClick={() => nav('/cart')}>&larr; {t('checkout.backToCart')}</button>
            <button
              className="btn-ml-8"
              onClick={() => setStep(2)}
              disabled={!address.country || !address.city || !address.street || !address.postal}
            >
              {t('checkout.nextPayment')} →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3>2) {t('checkout.payment.title')}</h3>
          <div className="pay-grid">
            <input
              placeholder={t('checkout.payment.cardNumber')}
              value={payment.cardNumber}
              onChange={(e) => setPayment({ ...payment, cardNumber: e.target.value })}
              aria-label={t('checkout.payment.cardNumber')}
            />
            <input
              placeholder="MM/YY"
              value={payment.exp}
              onChange={(e) => setPayment({ ...payment, exp: e.target.value })}
              aria-label="MM/YY"
            />
            <input
              placeholder="CVC"
              value={payment.cvc}
              onChange={(e) => setPayment({ ...payment, cvc: e.target.value })}
              aria-label="CVC"
            />
          </div>
          <div className="mt-16">
            <button onClick={() => setStep(1)}>&larr; {t('checkout.backAddress')}</button>
            <button className="btn-ml-8" disabled={loading || summary.items.length === 0} onClick={submit}>
              {loading ? t('checkout.paying') : t('checkout.payAndPlace')}
            </button>
          </div>
          <div className="checkout-footnote">
            {t('checkout.demoNote.line1')}
            <br />
            {t('checkout.demoNote.line2')}
          </div>
        </div>
      )}
    </div>
  );
}
