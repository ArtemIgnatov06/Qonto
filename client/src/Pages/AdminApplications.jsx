// client/src/Pages/AdminApplications.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../Hooks/useAuth';

export default function AdminApplications() {
  const { user } = useAuth();
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const abortRef = useRef(null);

  // стабилизируем функцию загрузки, чтобы можно было положить её в зависимости
  const load = useCallback(async () => {
    // отменяем предыдущий фетч, если ещё не завершился
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
      setItems(data);
    } catch (e) {
      if (e.name !== 'AbortError') {
        setErr(e.message || 'Ошибка загрузки');
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const decide = async (id, action) => {
    const body =
      action === 'reject'
        ? { action, reason: prompt('Причина отказа?') || '' }
        : { action };

    const res = await fetch(`http://localhost:5050/admin/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      alert('Не удалось сохранить решение');
      return;
    }
    await load(); // перезагрузим список после решения
  };

  if (!user) return <div>Нужно войти.</div>;
  if (user.role !== 'admin') return <div>Доступ только для администраторов.</div>;

  return (
    <div className="container">
      <h2>Заявки продавцов</h2>

      <div style={{ marginBottom: 12 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Ожидают</option>
          <option value="approved">Одобрены</option>
          <option value="rejected">Отклонены</option>
        </select>
        <button onClick={load} style={{ marginLeft: 8 }}>
          Обновить
        </button>
      </div>

      {loading && <div>Загрузка…</div>}
      {err && <div style={{ color: 'red' }}>{err}</div>}

      {items.map((a) => (
        <div key={a.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div>
            <b>{a.company_name}</b> (ИНН: {a.tax_id})
          </div>
          <div>
            Пользователь: {a.first_name} {a.last_name} · {a.email} · {a.phone}
          </div>
          {a.price_list_url && (
            <div>
              <a href={a.price_list_url} target="_blank" rel="noreferrer">
                Прайс-лист
              </a>
            </div>
          )}
          {a.comment && <div style={{ opacity: 0.8 }}>Комментарий: {a.comment}</div>}

          {a.status === 'pending' ? (
            <div style={{ marginTop: 8 }}>
              <button onClick={() => decide(a.id, 'approve')}>Принять</button>
              <button onClick={() => decide(a.id, 'reject')} style={{ marginLeft: 8 }}>
                Отклонить
              </button>
            </div>
          ) : (
            <i>Статус: {a.status}</i>
          )}
        </div>
      ))}

      {!items.length && !loading && <div>Нет заявок.</div>}
    </div>
  );
}
