// client/src/Pages/ProfilePublic.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../Hooks/useAuth';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AvatarCircle from '../Components/AvatarCircle';
import '../Styles/ProfilePublic.css';

function makeAbs(url) {
  if (!url) return null;
  return String(url).startsWith('http') ? url : `http://localhost:5050${url}`;
}

export default function ProfilePublic() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { id: routeId } = useParams();
  const viewedUserId = routeId ? Number(routeId) : user?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

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

  // инициалы из snake/camel
  const first = data.first_name || data.firstName || '';
  const last  = data.last_name  || data.lastName  || '';
  const initials = `${first ? first[0] : ''}${last ? last[0] : ''}`.toUpperCase() || 'U';

  const startChat = async () => {
    try {
      if (!user) return navigate('/auth');
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

  // загрузка аватара без второго круга
  const onPickFile = () => fileRef.current?.click();
  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('avatar', f);
    setUploading(true);
    try {
      const { data: resp } = await axios.post(
        'http://localhost:5050/api/me/avatar',
        fd,
        { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const newUrl = makeAbs(resp.url || resp.avatarUrl);
      if (newUrl) setData((p) => ({ ...p, avatarUrl: newUrl }));
    } catch (e2) {
      alert(e2?.response?.data?.error || 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="profile-page">
      {/* Шапка */}
      <div className="profile-header">
        <h2 className="profile-title">
          {t('profile.publicTitle') || 'Видимый профиль'}
        </h2>
        {isMe && (
          <Link
            to="/profile"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className={`link-profile ${hover ? 'is-hover' : ''}`}
          >
            {t('profile.title') || 'Личный профиль'}
          </Link>
        )}
      </div>

      <div className="profile-grid">
        {/* Левая колонка: аватар + онлайн + рейтинг */}
        <div className="card card-center">
          <div className="profile-avatar-stack">
            <AvatarCircle
              src={data.avatarUrl}
              firstName={first}
              lastName={last}
              username={data.username}
              email={data.contactEmail}
              initials={initials}
              size={112}
              showDot
              online={!!data.online}
            />

            {isMe && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="hidden"
                />
                <button
                  className="btn-primary mt-8"
                  onClick={onPickFile}
                  disabled={uploading}
                  aria-busy={uploading}
                >
                  {uploading ? (t('common.loading') || 'Загрузка…') : (t('profile.uploadPhoto') || 'Загрузить фото')}
                </button>
              </>
            )}

            <div className="muted mt-6">
              {data.online ? (t('chat.online') || 'в сети') : (t('chat.offline') || 'не в сети')}
            </div>
          </div>

          <div className="mt-16">
            <div className="muted">{t('product.rating') || 'Рейтинг'}</div>
            <div className="value-28-600">
              {data.rating != null ? data.rating : '—'}
            </div>
            <div className="muted mt-8">
              {t('profile.soldCount') || 'Продано товаров'}
            </div>
            <div className="value-22-600">{data.soldCount}</div>
          </div>

          {!isMe ? (
            <button onClick={startChat} className="btn-primary mt-16">
              {t('chat.writeToSeller') || 'Написать продавцу'}
            </button>
          ) : (
            <Link to="/chats" className="btn-primary link-btn mt-16">
              {t('chat.chats') || 'Чаты'}
            </Link>
          )}
        </div>

        {/* Правая колонка: ФИО + связь */}
        <div className="card profile-info-grid">
          <div>
            <div className="muted muted-12 upper">
              {t('forms.firstName') || 'Имя'}
            </div>
            <div className="value-18">{first || '—'}</div>
          </div>
          <div>
            <div className="muted muted-12 upper">
              {t('forms.lastName') || 'Фамилия'}
            </div>
            <div className="value-18">{last || '—'}</div>
          </div>
          <div className="divider-top pt-12">
            <div className="muted muted-12 upper">
              {t('profile.contact') || 'Связь'}
            </div>
            <div className="value-18">{data.contactEmail || 'не указана'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
