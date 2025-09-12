// client/src/Pages/ProfilePublic.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AvatarUploader from '../Components/AvatarUploader';
import { useAuth } from '../Hooks/useAuth';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function makeAbs(url) {
  if (!url) return null;
  return String(url).startsWith('http') ? url : `http://localhost:5050${url}`;
}

export default function ProfilePublic() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { id: routeId } = useParams(); // поддержка /profile/public/:id
  const viewedUserId = routeId ? Number(routeId) : user?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!viewedUserId) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `http://localhost:5050/api/users/${viewedUserId}/public`,
          { withCredentials: true }
        );
        setData({ ...data, avatarUrl: makeAbs(data.avatarUrl) });
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [viewedUserId]);

  if (!viewedUserId) return <div className="profile-page">{t('auth.required')}</div>;
  if (loading) return <div className="profile-page">{t('common.loading') || 'Загрузка…'}</div>;
  if (!data) return <div className="profile-page">Профиль не найден</div>;

  const isMe = user?.id && Number(user.id) === Number(viewedUserId);

  // Буква-фолбэк, если нет аватарки
  const letter = (
    (data.firstName && data.firstName[0]) ||
    (data.lastName && data.lastName[0]) ||
    (data.username && data.username[0]) ||
    (data.contactEmail && data.contactEmail[0]) ||
    'U'
  ).toUpperCase();

  const startChat = async () => {
    try {
      if (!user) return navigate('/auth'); // если не авторизован — на логин
      const { data: resp } = await axios.post(
        'http://localhost:5050/api/chats/start',
        { seller_id: Number(viewedUserId) },
        { withCredentials: true }
      );
      navigate(`/chats/${resp.id}`);
    } catch (e) {
      alert(e?.response?.data?.error || 'Не удалось открыть чат');
    }
  };

  return (
    <div className="profile-page">
      {/* Шапка страницы */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 24,
          marginBottom: 20
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            color: '#111827'
          }}
        >
          {t('profile.publicTitle') || 'Видимый профиль'}
        </h2>

        {/* ПОКАЗЫВАЕМ ссылку только если это мой профиль */}
        {isMe && (
          <Link
            to="/profile"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#6d28d9',
              textDecoration: hover ? 'underline' : 'none',
              lineHeight: 1.3
            }}
          >
            {t('profile.title') || 'Личный профиль'}
          </Link>
        )}
      </div>

      <div className="profile-grid">
        {/* Левая колонка: фото + онлайн + рейтинг + продажи */}
        <div className="card" style={{ textAlign: 'center', overflow: 'visible' }}>
          {isMe ? (
            <>
              {/* Индикатор рисует сам AvatarUploader — передаем online.
                  Если в вашем AvatarUploader нет фолбэка-буквы, он просто проигнорирует лишние пропсы — это нормально. */}
              <AvatarUploader
                initialUrl={data.avatarUrl}
                online={data.online}
                onUploaded={(url) => setData((p) => ({ ...p, avatarUrl: url }))}
              />
              <div className="muted" style={{ marginTop: 6 }}>
                {data.online ? (t('chat.online') || 'в сети') : (t('chat.offline') || 'не в сети')}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  position: 'relative',           // точка позиционируется по кругу
                  width: 112,
                  height: 112,
                  borderRadius: '50%',
                  overflow: 'visible',            // точка выходит за край
                  background: data.avatarUrl ? '#e5e7eb' : '#2563eb',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {data.avatarUrl ? (
                  <img
                    src={data.avatarUrl}
                    alt="avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  />
                ) : (
                  <span
                    style={{
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 42,
                      lineHeight: 1,
                      userSelect: 'none'
                    }}
                  >
                    {letter}
                  </span>
                )}

                {/* Зелёная точка СНАРУЖИ круга — видна целиком */}
                <span
                  title={data.online ? (t('chat.online') || 'в сети') : (t('chat.offline') || 'не в сети')}
                  style={{
                    position: 'absolute',
                    right: -4,
                    bottom: -4,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: data.online ? '#22c55e' : '#9ca3af',
                    border: '3px solid #fff',
                    boxShadow: '0 2px 6px rgba(0,0,0,.12)',
                    pointerEvents: 'none',
                    zIndex: 2
                  }}
                />
              </div>

              {/* подпись под аватаркой */}
              <div className="muted" style={{ marginTop: 2 }}>
                {data.online ? (t('chat.online') || 'в сети') : (t('chat.offline') || 'не в сети')}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div className="muted">{t('product.rating') || 'Рейтинг'}</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>
              {data.rating != null ? data.rating : '—'}
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              {t('profile.soldCount') || 'Продано товаров'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{data.soldCount}</div>
          </div>

          {/* Кнопки действий под карточкой */}
          {!isMe ? (
            <button
              onClick={startChat}
              className="btn-primary"
              style={{ marginTop: 16 }}
            >
              {t('chat.writeToSeller') || 'Написать продавцу'}
            </button>
          ) : (
            <Link
              to="/chats"
              className="btn-primary"
              style={{ marginTop: 16, display: 'inline-block', textDecoration: 'none' }}
            >
              {t('chat.chats') || 'Чаты'}
            </Link>
          )}
        </div>

        {/* Правая: ФИО + связь (только чтение) */}
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div>
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>
              {t('forms.firstName') || 'Имя'}
            </div>
            <div style={{ fontSize: 18 }}>{data.firstName || '—'}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>
              {t('forms.lastName') || 'Фамилия'}
            </div>
            <div style={{ fontSize: 18 }}>{data.lastName || '—'}</div>
          </div>
          <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>
              {t('profile.contact') || 'Связь'}
            </div>
            <div style={{ fontSize: 18 }}>{data.contactEmail || 'не указана'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
