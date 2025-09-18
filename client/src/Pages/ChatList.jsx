// client/src/Pages/ChatList.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import AvatarCircle from '../Components/AvatarCircle';

const API = 'http://localhost:5050';

export default function ChatList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
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

          const otherFirst = iamSeller ? c.buyer_first_name : c.seller_first_name;
          const otherLast  = iamSeller ? c.buyer_last_name  : c.seller_last_name;
          const otherUser  = iamSeller ? c.buyer_username   : c.seller_username;
          const otherEmail = iamSeller ? c.buyer_email      : c.seller_email;

          // возможные варианты поля с аватаром
          const otherAvatar =
            c.other_avatar_url ??
            (iamSeller ? c.buyer_avatar_url : c.seller_avatar_url) ??
            c.avatar_url; // на всякий

          const otherName =
            (`${otherFirst || ''} ${otherLast || ''}`.trim()) ||
            otherUser || otherEmail || (t('chat.user') || 'Пользователь');

          const muted = !!c.muted_by_me;
          const archived = !!c.archived_by_me;
          const blocked = !!c.blocked_by_me;
          const mutedUnread = Number(c.muted_unread_for_me || 0);
          const unread = Number(c.unread || 0);

          return (
            <Link
              key={c.id}
              to={`/chats/${c.id}`}
              style={{
                display: 'flex',
                gap: 12,
                padding: 12,
                borderBottom: '1px solid #eee',
                textDecoration: 'none',
                color: 'inherit',
                alignItems: 'center'
              }}
            >
              {/* Аватар с безопасным фолбэком-буквой */}
              <AvatarCircle
                src={otherAvatar}
                firstName={otherFirst}
                lastName={otherLast}
                username={otherUser}
                email={otherEmail}
                size={40}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {otherName}
                  </div>

                  {/* Чипы состояния */}
                  {archived && (
                    <span
                      style={{
                        fontSize: 11,
                        color: '#6b7280',
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        padding: '0 6px',
                        borderRadius: 9999
                      }}
                      title="В архиве"
                    >
                      Архив
                    </span>
                  )}
                  {blocked && (
                    <span
                      style={{
                        fontSize: 11,
                        color: '#991b1b',
                        background: '#fee2e2',
                        border: '1px solid #fecaca',
                        padding: '0 6px',
                        borderRadius: 9999
                      }}
                      title="Пользователь заблокирован вами"
                    >
                      Блок
                    </span>
                  )}
                </div>

                <div
                  className="muted"
                  style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {c.last_text || t('chat.noMessages') || 'Пока нет сообщений'}
                </div>
              </div>

              {/* Правый блок: иконка mute + бейджи */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {muted && (
                  <span title="Чат в муте" aria-label="muted" style={{ fontSize: 16 }}>🔇</span>
                )}

                {/* Красный бейдж — только для замьюченных чатов */}
                {muted && mutedUnread > 0 && (
                  <span
                    title="Сообщений, которые «посереют»"
                    style={{
                      background: '#e53935',
                      color: '#fff',
                      borderRadius: 9999,
                      padding: '2px 8px',
                      fontSize: 12,
                      fontWeight: 700,
                      minWidth: 22,
                      textAlign: 'center'
                    }}
                  >
                    {mutedUnread}
                  </span>
                )}

                {/* Обычный счётчик непрочитанного — если чат не в муте */}
                {!muted && unread > 0 && (
                  <span
                    title={t('chat.unread') || 'Непрочитанные'}
                    style={{
                      background: '#9ca3af',
                      color: '#fff',
                      borderRadius: 9999,
                      padding: '2px 8px',
                      fontSize: 12,
                      fontWeight: 700,
                      minWidth: 22,
                      textAlign: 'center'
                    }}
                  >
                    {unread}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
