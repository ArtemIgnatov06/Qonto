// client/src/Pages/ChatList.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';

const API = 'http://localhost:5050';

export default function ChatList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState(null);

  useEffect(() => {
    (async () => {
      const role = user?.seller_status === 'approved' ? 'seller' : 'all';
      const { data } = await axios.get(`${API}/api/chats/my?role=${role}`, { withCredentials: true });
      setItems(data.items || []);
    })().catch(() => setItems([]));
  }, [user]);

  if (!user) return <div className="profile-page">{t('auth.required')}</div>;
  if (!items) return <div className="profile-page">{t('common.loading') || 'Загрузка…'}</div>;

  return (
    <div className="profile-page">
      <h2>{t('chat.chats') || 'Чаты'}</h2>
      <div className="card" style={{ padding: 0 }}>
        {items.length === 0 && <div style={{ padding: 16 }}>{t('common.empty') || 'Пусто'}</div>}
        {items.map((c) => {
          const iamSeller = user.id === c.seller_id;
          const otherName = iamSeller
            ? `${c.buyer_first_name || ''} ${c.buyer_last_name || ''}`.trim() || 'Покупатель'
            : `${c.seller_first_name || ''} ${c.seller_last_name || ''}`.trim() || 'Продавец';

          return (
            <Link key={c.id} to={`/chats/${c.id}`} style={{
              display:'flex', gap:12, padding:12, borderBottom:'1px solid #eee', textDecoration:'none', color:'inherit'
            }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'#e5e7eb' }} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600 }}>{otherName}</div>
                <div className="muted" style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {c.last_text || t('chat.noMessages') || 'Пока нет сообщений'}
                </div>
              </div>
              {!!c.unread && <span style={{
                alignSelf:'center', background:'#ef4444', color:'#fff', borderRadius:9999, padding:'2px 8px', fontSize:12
              }}>{c.unread}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
