// client/src/Pages/ChatList.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import AvatarCircle from '../Components/AvatarCircle';
import '../Styles/ChatList.css';
import BackArrow from '../assets/planex-invert.png';
import NoChatsImg from '../assets/no-chats.png';
import TrashIcon from '../assets/green-trash.png';

const API = 'http://localhost:5050';

export default function ChatList() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [items, setItems] = useState(null);

  const pick = (obj, keys, fallback='') => {
    if (!obj) return fallback;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return fallback;
  };

  const normalizeArray = (data) => {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    return data.items || data.threads || data.list || data.data || [];
  };

  const load = async () => {
    const tryFetch = async (url) => {
      const { data } = await axios.get(url, { withCredentials: true });
      return normalizeArray(data);
    };

    try {
      let rows = await tryFetch(`${API}/api/chats/my`);
      if (!rows.length) {
        try { rows = await tryFetch(`${API}/api/chats`); } catch {}
      }
      setItems(rows);
    } catch (e) {
      console.warn('ChatList load error', e?.response?.status, e?.message);
      setItems([]);
    }
  };

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return <div className="profile-page">{t('auth.required')}</div>;
  if (items === null) return <div className="profile-page">{t('common.loading') || 'Завантаження…'}</div>;

  const isEmpty = (items || []).length === 0;

  const renderRow = (c) => {
    const iamSeller = (c.seller_id && user?.id === c.seller_id);

    const otherFirst = iamSeller ? c.buyer_first_name : (c.seller_first_name ?? c.other_first_name);
    const otherLast  = iamSeller ? c.buyer_last_name  : (c.seller_last_name  ?? c.other_last_name);
    const otherUser  = iamSeller ? c.buyer_username   : (c.seller_username  ?? c.other_username);
    const otherEmail = iamSeller ? c.buyer_email      : (c.seller_email     ?? c.other_email);

    // Priority now: server-computed full name -> First+Last -> username -> email
    const serverName = (c.other_name || '').trim();
    const nameFL = `${otherFirst || ''} ${otherLast || ''}`.trim();
    const otherName = serverName || nameFL || otherUser || otherEmail || (t('chat.user') || 'Користувач');

    const otherAvatar =
      pick(c, ['other_avatar_url','avatar_url'], null) ||
      (iamSeller ? c.buyer_avatar_url : c.seller_avatar_url) || null;

    const rawTime = pick(c, ['last_created_at','last_at'], null) ||
                    pick(c.last_message || {}, ['created_at','time'], null);
    const time = rawTime ? new Date(rawTime).toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit',hour12:false}) : '';

    const snippet = pick(c, ['last_text'], '') ||
                    pick(c.last_message || {}, ['body','text'], '');

    const unread = Number(pick(c, ['unread','unread_count','unreadMessages','unread_messages'], 0));
    const isUnread = unread > 0;

    return (
      <div key={c.id || `${otherName}-${time}`} className={`chat-row ${isUnread ? 'unread' : ''}`}>
        <Link to={`/chats/${c.id}`} className="chat-row-main">
          <div className="chat-row-left">
            <AvatarCircle
              src={otherAvatar}
              firstName={otherFirst}
              lastName={otherLast}
              username={otherUser}
              email={otherEmail}
              size={36}
            />
            <div className="chat-row-text">
              <div className="chat-row-name">{otherName}</div>
              <div className="chat-row-snippet">{snippet || (t('chat.noMessages') || 'Поки немає повідомлень')}</div>
            </div>
          </div>
          <div className="chat-row-right">
            {time && <div className="chat-row-time">{time}</div>}
            {isUnread && <div className="badge badge-unread">+{unread}</div>}
          </div>
        </Link>
        <button
          className="chat-row-delete"
          title={t('chat.deleteThread') || 'Видалити діалог'}
          onClick={async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!window.confirm(t('chat.deleteThreadConfirm') || 'Видалити діалог і всі повідомлення?')) return;
            setItems(prev => (prev || []).filter(x => (x.id ?? -1) !== (c.id ?? -2)));
            try {
              await axios.delete(`${API}/api/chats/${c.id}`, { withCredentials: true });
            } catch {
              load();
            }
          }}
        >
          <img src={TrashIcon} alt="delete" className="trash-img" />
        </button>
      </div>
    );
  };

  return (
    <div className="chats-page">
      <div className="chat-back-wrap">
        <Link to="/profile" className="chat-back">
          <img src={BackArrow} alt="Назад" className="chat-back-icon" />
          <span>{t('chat.chats', { defaultValue: 'Чати' })}</span>
        </Link>
      </div>

      {isEmpty ? (
        <div className="chat-empty-card">
          <div className="chat-empty">
            <div className="chat-empty-body">
              <div className="chat-empty-title">{t('chat.noChats', { defaultValue: 'Немає чатів' })}</div>
              <img src={NoChatsImg} alt={t('chat.noChatsAlt', { defaultValue: 'Немає чатів' })} className="chat-empty-illustration" />
            </div>
          </div>
        </div>
      ) : (
        <div className="chat-list-wrap">
          {items.map(renderRow)}
        </div>
      )}
    </div>
  );
}
