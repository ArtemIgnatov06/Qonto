// client/src/Pages/ChatThread.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { authSocket } from '../lib/socket';
import AvatarCircle from '../Components/AvatarCircle';

const API = 'http://localhost:5050';

export default function ChatThread() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useParams();

  const [thread, setThread] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [other, setOther] = useState(null);

  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [typing, setTyping] = useState(false);

  const [muted, setMuted] = useState(false);
  const [archived, setArchived] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // редактирование
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const boxRef = useRef(null);
  const typingTimer = useRef(null);

  const scrollBottom = () => {
    const el = boxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const normalizeIncoming = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.items && Array.isArray(payload.items)) return payload.items;
    if (payload.item) return [payload.item];
    return [payload];
  };

  const load = async () => {
    const { data } = await axios.get(`${API}/api/chats/${id}/messages`, { withCredentials: true });
    setThread(data.thread);
    setMsgs(data.items || []);
    setMuted(!!data.thread?.muted_by_me);
    setArchived(!!data.thread?.archived_by_me);
    setBlocked(!!data.thread?.blocked_by_me);

    const otherId = user?.id === data.thread.seller_id ? data.thread.buyer_id : data.thread.seller_id;
    const u = await axios.get(`${API}/api/users/${otherId}/public`, { withCredentials: true });
    setOther(u.data);

    setTimeout(scrollBottom, 0);
    await axios.post(`${API}/api/chats/${id}/read`, {}, { withCredentials: true }).catch(() => {});
  };

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});

    const s = authSocket(user.id);
    s.emit('thread:join', Number(id));

    const onNew = (payload) => {
      const items = normalizeIncoming(payload);
      if (!items.length) return;
      const tid = Number(items[0].thread_id || payload.thread_id);
      if (tid !== Number(id)) return;

      setMsgs((prev) => ([...(prev || []), ...items]));
      setTimeout(scrollBottom, 0);

      const hasForeign = items.some((m) => m.sender_id !== user.id);
      if (hasForeign) {
        axios.post(`${API}/api/chats/${id}/read`, {}, { withCredentials: true }).catch(() => {});
      }
    };

    const onAck = (payload) => {
      const items = normalizeIncoming(payload);
      if (!items.length) return;
      const tid = Number(items[0].thread_id || payload.thread_id);
      if (tid !== Number(id)) return;
      setMsgs((prev) => ([...(prev || []), ...items]));
      setTimeout(scrollBottom, 0);
    };

    const onTyping = (p) => {
      if (Number(p.threadId) !== Number(id)) return;
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 1500);
    };

    const onUpdate = (payload) => {
      const { thread_id, item } = payload || {};
      if (Number(thread_id) !== Number(id) || !item) return;
      setMsgs((prev) => (prev || []).map(m => m.id === item.id ? item : m));
    };

    s.on('chat:message', onNew);
    s.on('chat:message:ack', onAck);
    s.on('thread:typing', onTyping);
    s.on('chat:message:update', onUpdate);

    return () => {
      s.off('chat:message', onNew);
      s.off('chat:message:ack', onAck);
      s.off('thread:typing', onTyping);
      s.off('chat:message:update', onUpdate);
      clearTimeout(typingTimer.current);
    };
    // eslint-disable-next-line
  }, [id, user]);

  // actions
  const toggleMute = async () => {
    try {
      const { data } = await axios.post(`${API}/api/chats/${id}/mute`, { mute: !muted }, { withCredentials: true });
      setMuted(!!data.muted);
    } catch {}
  };
  const toggleArchive = async () => {
    try {
      const { data } = await axios.post(`${API}/api/chats/${id}/archive`, { archive: !archived }, { withCredentials: true });
      setArchived(!!data.archived);
    } catch {}
  };
  const toggleBlock = async () => {
    try {
      const { data } = await axios.post(`${API}/api/chats/${id}/block`, { block: !blocked }, { withCredentials: true });
      setBlocked(!!data.blocked);
    } catch {}
  };

  const send = async () => {
    const body = text.trim();
    if (!body && files.length === 0) return;
    if (blocked) return;

    const fd = new FormData();
    if (body) fd.append('body', body);
    files.forEach((f) => fd.append('files', f));

    setText('');
    setFiles([]);

    try {
      await axios.post(`${API}/api/chats/${id}/messages`, fd, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTimeout(load, 80);
    } catch {}
  };

  const handleTyping = (e) => {
    const v = e.target.value;
    setText(v);
    authSocket(user.id).emit('thread:typing', { threadId: Number(id), from: user.id });
  };

  // edit / delete
  const startEdit = (m) => {
    setEditingId(m.id);
    setEditText(m.body || '');
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };
  const saveEdit = async (m) => {
    const body = editText.trim();
    await axios.patch(`${API}/api/messages/${m.id}`, { body }, { withCredentials: true });
    cancelEdit();
  };
  const removeMsg = async (m) => {
    if (!window.confirm(t('chat.deleteConfirm') || 'Удалить сообщение?')) return;
    await axios.delete(`${API}/api/messages/${m.id}`, { withCredentials: true });
  };

  if (!user) return <div className="profile-page">{t('auth.required')}</div>;
  if (!msgs) return <div className="profile-page">{t('common.loading') || 'Загрузка…'}</div>;

  const renderAttachment = (m) => {
    if (!m.attachment_url || m.deleted_at) return null;
    const href = `${API}${m.attachment_url}`;
    if (m.attachment_type?.startsWith?.('image/')) {
      return (
        <div style={{ marginTop: 8 }}>
          <img
            src={href}
            alt={m.attachment_name || ''}
            style={{ maxWidth: 280, maxHeight: 360, borderRadius: 12, display: 'block' }}
          />
        </div>
      );
    }
    return (
      <div style={{ marginTop: 8 }}>
        <a href={href} target="_blank" rel="noreferrer">📎 {m.attachment_name || 'Вложение'}</a>
      </div>
    );
  };

  const MsgActions = ({ m }) => {
    if (m.sender_id !== user.id || m.deleted_at) return null;
    const isEditing = editingId === m.id;
    return (
      <div className="msg-actions" style={{ opacity: 0, transition: 'opacity .15s' }}>
        {!isEditing && (
          <>
            <button className="icon-btn" title="Редактировать" onClick={() => startEdit(m)}>✏️</button>
            <button className="icon-btn" title="Удалить" onClick={() => removeMsg(m)}>🗑</button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="profile-page">
      <h2 style={{ marginBottom: 12 }}>{t('chat.thread') || 'Диалог'}</h2>

      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          height: '72vh',
          maxWidth: 720,
          margin: '0 auto',
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(0,0,0,.06)',
          overflow: 'hidden'
        }}
      >
        {/* header (sticky) */}
        <div
          className="chat-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: 12,
            borderBottom: '1px solid #eef0f3',
            background: '#fff',
            position: 'sticky',
            top: 0,
            zIndex: 1
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AvatarCircle
              src={other?.avatarUrl}
              firstName={other?.firstName}
              lastName={other?.lastName}
              username={other?.username}
              email={other?.contactEmail}
              size={40}
              showDot
              online={!!other?.online}
            />
            <div>
              <div style={{ fontWeight: 700 }}>
                {(other?.firstName || '') + ' ' + (other?.lastName || '')}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {typing
                  ? (t('chat.typing') || 'печатает…')
                  : (other?.online ? (t('chat.online') || 'в сети') : (t('chat.offline') || 'не в сети'))}
              </div>
            </div>
          </div>

          {/* icon buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="ghost-btn" onClick={toggleMute} title={muted ? 'Размутить' : 'Мут'}>
              {muted ? '🔊' : '🔇'}
            </button>
            <button className="ghost-btn" onClick={toggleArchive} title={archived ? 'Разархивировать' : 'В архив'}>
              {archived ? '📂' : '🗄️'}
            </button>
            <button className="ghost-btn" onClick={toggleBlock} title={blocked ? 'Разблокировать' : 'Заблокировать'}>
              {blocked ? '🚫' : '⛔'}
            </button>
          </div>
        </div>

        {/* messages */}
        <div
          ref={boxRef}
          className="chat-messages"
          style={{ overflowY: 'auto', padding: 16, background: '#f8fafc' }}
        >
          {(msgs || []).map((m) => {
            const mine = m.sender_id === user.id;
            const isEditing = editingId === m.id;
            return (
              <div
                key={m.id}
                className={`message ${mine ? 'me' : 'other'}`}
                style={{
                  display: 'flex',
                  justifyContent: mine ? 'flex-end' : 'flex-start',
                  marginBottom: 10
                }}
              >
                <div
                  className="bubble-wrap"
                  style={{ position: 'relative', maxWidth: 520 }}
                  onMouseEnter={(e) => {
                    const a = e.currentTarget.querySelector('.msg-actions');
                    if (a) a.style.opacity = 1;
                  }}
                  onMouseLeave={(e) => {
                    const a = e.currentTarget.querySelector('.msg-actions');
                    if (a) a.style.opacity = 0;
                  }}
                >
                  <div
                    className="bubble"
                    style={{
                      background: mine ? '#dbeafe' : '#fff',
                      border: '1px solid #e5e7eb',
                      padding: 10,
                      borderRadius: 12,
                      boxShadow: '0 1px 0 rgba(0,0,0,.03)'
                    }}
                  >
                    {m.deleted_at ? (
                      <div style={{ fontStyle: 'italic', color: '#6b7280' }}>
                        {t('chat.deleted') || 'Сообщение удалено'}
                      </div>
                    ) : isEditing ? (
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) saveEdit(m);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 8,
                          border: '1px solid #cbd5e1', outline: 'none'
                        }}
                      />
                    ) : (
                      <>
                        {m.body ? <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div> : null}
                        {renderAttachment(m)}
                      </>
                    )}

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                      <div className="time" style={{ fontSize: 11, color: '#6b7280' }}>
                        {new Date(m.created_at).toLocaleString()}
                        {m.edited_at && !m.deleted_at ? ' · ' + (t('chat.edited') || 'отредактировано') : ''}
                      </div>
                    </div>
                  </div>

                  {/* hover actions */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -8,
                      right: mine ? -8 : 'auto',
                      left: mine ? 'auto' : -8,
                      display: 'flex',
                      gap: 4
                    }}
                  >
                    <MsgActions m={m} />
                    {editingId === m.id && (
                      <>
                        <button className="icon-btn" title="Сохранить" onClick={() => saveEdit(m)}>✅</button>
                        <button className="icon-btn" title="Отмена" onClick={cancelEdit}>✖️</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* footer (sticky) */}
        <div
          className="pm-input-bar"
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: 12,
            borderTop: '1px solid #eef0f3',
            background: '#fff',
            position: 'sticky',
            bottom: 0
          }}
        >
          {/* attachments preview */}
          {files.length > 0 && (
            <div style={{ position: 'absolute', bottom: '100%', left: 12, marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {files.map((f, idx) => (
                <div key={idx} style={{ fontSize: 12, border: '1px solid #eee', borderRadius: 8, padding: 6, background: '#fff' }}>
                  {f.type.startsWith('image/')
                    ? <img src={URL.createObjectURL(f)} alt="" style={{ height: 56, borderRadius: 6 }} />
                    : <span>📄 {f.name}</span>}
                </div>
              ))}
              <button className="btn-link" onClick={() => setFiles([])}>Очистить</button>
            </div>
          )}

          <label htmlFor="chat-file-input" className="ghost-btn" title="Вложение" style={{ cursor: 'pointer' }}>📎</label>
          <input
            id="chat-file-input"
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            style={{ display: 'none' }}
          />

          <input
            type="text"
            value={text}
            onChange={handleTyping}
            placeholder={t('chat.placeholder') || 'Напишите сообщение...'}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            style={{
              flex: 1, height: 40, padding: '0 12px', borderRadius: 12,
              border: '1px solid #e5e7eb', outline: 'none', fontSize: 14, background: '#f8fafc'
            }}
            disabled={blocked}
          />

          <button
            onClick={send}
            disabled={blocked}
            className="primary-btn"
            style={{
              height: 40, padding: '0 16px', background: blocked ? '#9ca3af' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: blocked ? 'not-allowed' : 'pointer'
            }}
            title={blocked ? 'Вы заблокировали пользователя' : undefined}
          >
            {blocked ? (t('chat.blocked') || 'Заблокировано') : (t('chat.send') || 'Отправить')}
          </button>
        </div>
      </div>

      {/* лёгкие стили для кнопок */}
      <style>{`
        .ghost-btn, .icon-btn {
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          height: 36px;
          min-width: 36px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .ghost-btn:hover, .icon-btn:hover { background: #e5e7eb; }
        .icon-btn { height: 28px; min-width: 28px; font-size: 13px; }
      `}</style>
    </div>
  );
}
