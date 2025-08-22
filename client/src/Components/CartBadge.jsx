// client/src/Components/CartBadge.jsx
import { useEffect, useState } from 'react';

export default function CartBadge({ className = '' }) {
  const API = process.env.REACT_APP_API || '';
  const [count, setCount] = useState(0);

  async function load() {
    try {
      const r = await fetch(`${API}/api/cart`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      const items = Array.isArray(d.items) ? d.items : [];
      setCount(items.reduce((s, it) => s + Number(it.qty || 0), 0));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load(); // при монтировании
    const onChange = () => load();
    window.addEventListener('cart:changed', onChange);
    window.addEventListener('focus', onChange); // вернулись во вкладку — обновим
    return () => {
      window.removeEventListener('cart:changed', onChange);
      window.removeEventListener('focus', onChange);
    };
  }, [API]);

  return <span className={className}>Корзина{count ? ` (${count})` : ''}</span>;
}
