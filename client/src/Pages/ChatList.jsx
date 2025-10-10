// client/src/Pages/ChatList.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import AvatarCircle from '../Components/AvatarCircle';
import '../Styles/ChatList.css';

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
      <div className="card card-no-padding">
        {items.length === 0 && <div className="empty-pad-16">{t('common.empty') || 'Пусто'}</div>}

        {items.map((c) => {
          const iamSeller = user.id === c.seller_id;

          const otherFirst = iamSeller ? c.buyer_first_name : c.seller_first_name;
          const otherLast  = iamSeller ? c.buyer_last_name  : c.seller_last_name;
          const otherUser  = iamSeller ? c.buyer_username   : c.seller_username;
          const otherEmail = iamSeller ? c.buyer_email      : c.seller_email;

          const otherAvatar =
            c.other_avatar_url ??
            (iamSeller ? c.buyer_avatar_url : c.seller_avatar_url) ??
            c.avatar_url;

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
              className="row gap-12 chat-item"
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

              <div className="flex-1 min-w-0">
                <div className="row-center gap-8">
                  <div className="name-ellipsis">
                    {otherName}
                  </div>

                  {/* Чипы состояния */}
                  {archived && (
                    <span className="chip chip-archived" title="В архиве">
                      Архив
                    </span>
                  )}
                  {blocked && (
                    <span className="chip chip-blocked" title="Пользователь заблокирован вами">
                      Блок
                    </span>
                  )}
                </div>

                <div className="muted ellipsis">
                  {c.last_text || t('chat.noMessages') || 'Пока нет сообщений'}
                </div>
              </div>

              {/* Правый блок: иконка mute + бейджи */}
              <div className="right-controls">
                {muted && (
                  <span title="Чат в муте" aria-label="muted" className="icon-16">🔇</span>
                )}

                {/* Красный бейдж — только для замьюченных чатов */}
                {muted && mutedUnread > 0 && (
                  <span
                    title="Сообщений, которые «посереют»"
                    className="badge badge-muted"
                  >
                    {mutedUnread}
                  </span>
                )}

                {/* Обычный счётчик непрочитанного — если чат не в муте */}
                {!muted && unread > 0 && (
                  <span
                    title={t('chat.unread') || 'Непрочитанные'}
                    className="badge badge-unread"
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
