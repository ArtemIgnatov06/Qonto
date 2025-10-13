// client/src/Pages/ChatThread.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { authSocket } from '../lib/socket';
import AvatarCircle from '../Components/AvatarCircle';
import '../Styles/ChatThread.css';

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
        <div className="mt-8">
          <img
            src={href}
            alt={m.attachment_name || ''}
            className="attachment-img"
          />
        </div>
      );
    }
    return (
      <div className="mt-8">
        <a href={href} target="_blank" rel="noreferrer">📎 {m.attachment_name || 'Вложение'}</a>
      </div>
    );
  };

  const MsgActions = ({ m }) => {
    if (m.sender_id !== user.id || m.deleted_at) return null;
    const isEditing = editingId === m.id;
    return (
      <div className="msg-actions">
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
      <h2 className="mb-12">{t('chat.thread') || 'Диалог'}</h2>

      <div className="card chat-card">
        {/* header (sticky) */}
        <div className="chat-header row-center gap-12">
          <div className="row-center gap-12">
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
              <div className="fw-700">
                {(other?.firstName || '') + ' ' + (other?.lastName || '')}
              </div>
              <div className="muted-12">
                {typing
                  ? (t('chat.typing') || 'печатает…')
                  : (other?.online ? (t('chat.online') || 'в сети') : (t('chat.offline') || 'не в сети'))}
              </div>
            </div>
          </div>

          {/* icon buttons */}
          <div className="row gap-6">
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
        <div ref={boxRef} className="chat-messages">
          {(msgs || []).map((m) => {
            const mine = m.sender_id === user.id;
            const isEditing = editingId === m.id;
            return (
              <div
                key={m.id}
                className={`message ${mine ? 'me' : 'other'}`}
              >
                <div
                  className="bubble-wrap"
                >
                  <div
                    className={`bubble ${mine ? 'me' : ''}`}
                  >
                    {m.deleted_at ? (
                      <div className="deleted">
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
                        className="edit-input"
                      />
                    ) : (
                      <>
                        {m.body ? <div className="prewrap">{m.body}</div> : null}
                        {renderAttachment(m)}
                      </>
                    )}

                    <div className="row gap-6">
                      <div className="time">
                        {new Date(m.created_at).toLocaleString()}
                        {m.edited_at && !m.deleted_at ? ' · ' + (t('chat.edited') || 'отредактировано') : ''}
                      </div>
                    </div>
                  </div>

                  {/* hover actions */}
                  <div className={`hover-actions ${mine ? 'me' : 'other'}`}>
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
        <div className="pm-input-bar row gap-8">
          {/* attachments preview */}
          {files.length > 0 && (
            <div className="attachments-preview">
              {files.map((f, idx) => (
                <div key={idx} className="preview-chip">
                  {f.type.startsWith('image/')
                    ? <img src={URL.createObjectURL(f)} alt="" className="preview-img" />
                    : <span>📄 {f.name}</span>}
                </div>
              ))}
              <button className="btn-link" onClick={() => setFiles([])}>Очистить</button>
            </div>
          )}

          <label htmlFor="chat-file-input" className="ghost-btn" title="Вложение">📎</label>
          <input
            id="chat-file-input"
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="hidden"
          />

          <input
            type="text"
            value={text}
            onChange={handleTyping}
            placeholder={t('chat.placeholder') || 'Напишите сообщение...'}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            className="input-text"
            disabled={blocked}
          />

          <button
            onClick={send}
            disabled={blocked}
            className="primary-btn"
            title={blocked ? 'Вы заблокировали пользователя' : undefined}
          >
            {blocked ? (t('chat.blocked') || 'Заблокировано') : (t('chat.send') || 'Отправить')}
          </button>
        </div>
      </div>
    </div>
  );
}
