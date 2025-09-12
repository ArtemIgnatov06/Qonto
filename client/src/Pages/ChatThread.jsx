// client/src/Pages/ChatThread.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';

const API = 'http://localhost:5050';

export default function ChatThread() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useParams();
  const [thread, setThread] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [other, setOther] = useState(null);
  const [text, setText] = useState('');
  const boxRef = useRef(null);

  const scrollBottom = () => {
    const el = boxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const load = async () => {
    const { data } = await axios.get(`${API}/api/chats/${id}/messages`, { withCredentials: true });
    setThread(data.thread);
    setMsgs(data.items || []);
    const otherId = user?.id === data.thread.seller_id ? data.thread.buyer_id : data.thread.seller_id;
    const u = await axios.get(`${API}/api/users/${otherId}/public`, { withCredentials:true });
    setOther(u.data);
    setTimeout(scrollBottom, 0);
  };

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});
    const int1 = setInterval(load, 5000);
    const int2 = setInterval(() => {
      fetch(`${API}/api/heartbeat`, { method:'POST', credentials:'include' }).catch(()=>{});
    }, 20000);
    return () => { clearInterval(int1); clearInterval(int2); };
    // eslint-disable-next-line
  }, [id, user]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    await axios.post(`${API}/api/chats/${id}/messages`, { body }, { withCredentials: true });
    await load();
  };

  if (!user) return <div className="profile-page">{t('auth.required')}</div>;
  if (!msgs) return <div className="profile-page">{t('common.loading') || 'Загрузка…'}</div>;

  // Буква-фолбэк для собеседника
  const otherLetter = (
    (other?.firstName && other.firstName[0]) ||
    (other?.lastName && other.lastName[0]) ||
    (other?.username && other.username[0]) ||
    (other?.contactEmail && other.contactEmail[0]) ||
    'U'
  ).toUpperCase();

  return (
    <div className="profile-page">
      <h2>{t('chat.thread') || 'Диалог'}</h2>

      <div className="card" style={{ display:'flex', flexDirection:'column', height: '70vh' }}>
        {/* header */}
        <div className="chat-header">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ position:'relative', width:36, height:36 }}>
              <div
                style={{
                  width:36,
                  height:36,
                  borderRadius:'50%',
                  overflow:'visible',                        // даем точке выходить за край
                  background: other?.avatarUrl ? '#e5e7eb' : '#2563eb',
                  display:'grid',
                  placeItems:'center'
                }}
              >
                {other?.avatarUrl ? (
                  <img
                    alt=""
                    src={other.avatarUrl}
                    style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }}
                  />
                ) : (
                  <span
                    style={{
                      color:'#fff',
                      fontWeight:700,
                      fontSize:14,
                      lineHeight:1,
                      userSelect:'none'
                    }}
                  >
                    {otherLetter}
                  </span>
                )}
              </div>
              {/* индикатор онлайн поверх круга */}
              <span
                style={{
                  position:'absolute', right:-2, bottom:-2,
                  width:12, height:12, borderRadius:'50%',
                  background: other?.online ? '#10b981' : '#9ca3af',
                  border:'2px solid #fff',
                  boxShadow:'0 0 0 1px rgba(0,0,0,.06)',
                  pointerEvents:'none'
                }}
              />
            </div>
            <div style={{ fontWeight:600 }}>
              {(other?.firstName || '') + ' ' + (other?.lastName || '')}
              <div className="muted" style={{ fontSize:12 }}>
                {other?.online ? (t('chat.online') || 'в сети') : (t('chat.offline') || 'не в сети')}
              </div>
            </div>
          </div>
        </div>

        {/* messages */}
        <div
          ref={boxRef}
          className="chat-messages"
          style={{ flex: 1, overflowY: 'auto', padding: 12 }}
        >
          {msgs.map(m => (
            <div key={m.id} className={`message ${m.sender_id === user.id ? 'message-user' : 'message-ai'}`}>
              <div className="bubble">{m.body}</div>
              <div className="time">{new Date(m.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* input — компактный БЕЗ конфликта классов чата с ИИ */}
        <div
          className="pm-input-bar"
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: 12,
            borderTop: '1px solid #eef0f3',
            background: '#fafbfc'
          }}
        >
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t('chat.placeholder') || 'Напишите сообщение...'}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            style={{
              flex: 1,
              height: 40,            // нормальная высота поля
              padding: '0 12px',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              outline: 'none',
              fontSize: 14
            }}
          />
          <button
            onClick={send}
            style={{
              height: 40,            // кнопка такой же высоты
              padding: '0 16px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t('chat.send') || 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  );
}
