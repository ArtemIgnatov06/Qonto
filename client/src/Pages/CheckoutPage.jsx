// client/src/Pages/CheckoutPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CheckoutPage() {
  const API = process.env.REACT_APP_API || '';
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [summary, setSummary] = useState({ items: [], subtotal: 0 });

  const [address, setAddress] = useState({ country: '', city: '', street: '', postal: '' });
  const [payment, setPayment] = useState({ cardNumber: '', exp: '', cvc: '' });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // показываем сводку корзины
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/cart`, { credentials: 'include' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.message || 'Ошибка');
        const items = Array.isArray(d.items) ? d.items : [];
        const subtotal = items.reduce((s, it) => s + it.qty * Number(it.price), 0);
        setSummary({ items, subtotal });
      } catch (e) {
        setError(e.message || 'Сервер недоступен');
      }
    })();
  }, [API]);

  async function submit() {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address, payment })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || 'Платёж не прошёл');
      alert(`Заказ №${d.order_id} оплачен. Карта: ${d.brand?.toUpperCase()} •••• ${d.last4}`);
      nav('/');
    } catch (e) {
      setError(e.message || 'Ошибка оформления');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1>Оформление заказа</h1>
      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}

      <div style={{ marginBottom: 16, background: '#fafafa', padding: 12, borderRadius: 8 }}>
        <strong>Состав заказа:</strong>{' '}
        {summary.items.length === 0 ? 'Корзина пуста' :
          `${summary.items.length} поз., на ${summary.subtotal.toFixed(2)} ₴`}
      </div>

      {step === 1 && (
        <div>
          <h3>1) Адрес доставки</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 700 }}>
            <input placeholder="Страна" value={address.country} onChange={e => setAddress({ ...address, country: e.target.value })} />
            <input placeholder="Город" value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} />
            <input placeholder="Улица, дом" style={{ gridColumn: '1 / span 2' }} value={address.street} onChange={e => setAddress({ ...address, street: e.target.value })} />
            <input placeholder="Почтовый индекс" value={address.postal} onChange={e => setAddress({ ...address, postal: e.target.value })} />
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => nav('/cart')}>&larr; Назад к корзине</button>
            <button style={{ marginLeft: 8 }} onClick={() => setStep(2)} disabled={!address.country || !address.city || !address.street || !address.postal}>
              Далее: оплата →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3>2) Оплата (демо)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, maxWidth: 700 }}>
            <input placeholder="Номер карты" value={payment.cardNumber} onChange={e => setPayment({ ...payment, cardNumber: e.target.value })} />
            <input placeholder="MM/YY" value={payment.exp} onChange={e => setPayment({ ...payment, exp: e.target.value })} />
            <input placeholder="CVC" value={payment.cvc} onChange={e => setPayment({ ...payment, cvc: e.target.value })} />
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setStep(1)}>&larr; Назад: адрес</button>
            <button style={{ marginLeft: 8 }} disabled={loading || summary.items.length === 0} onClick={submit}>
              {loading ? 'Оплачиваем…' : 'Оплатить и оформить'}
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
            Это демо-оплата: данные карты не сохраняются, проверка по алгоритму Луна.
            Для продакшена интегрируй Stripe/WayForPay/… (токенизация).
          </div>
        </div>
      )}
    </div>
  );
}
