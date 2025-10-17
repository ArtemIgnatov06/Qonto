// client/src/Pages/ChatThread.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { authSocket } from '../lib/socket';
import AvatarCircle from '../Components/AvatarCircle';
import '../Styles/ChatThread.css';
import AttachIcon from '../assets/green-add.png';
import SendIcon from '../assets/send.png';
import BackArrow from '../assets/planex-invert.png';

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

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const boxRef = useRef(null);
  const typingTimer = useRef(null);
  const taRef = useRef(null);

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

  const send = async () => {
    const body = text.trim();
    if (!body && files.length === 0) return;

    const fd = new FormData();
    if (body) fd.append('body', body);
    files.forEach((f) => fd.append('files', f));

    setText('');
    setFiles([]);

    try {
      await axios.post(`${API}/api/chats/${id}/messages`, fd, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTimeout(load, 80);
    } catch {}
  };

  // textarea autosize
  const onMsgChange = (e) => {
    const v = e.target.value;
    setText(v);
    const el = taRef.current;
    if (!el) return;
    const LINE = 24, MIN_H = 55, MAX_LINES = 3, BORDER = 4, PAD_SINGLE = 27, PAD_MULTI = 16;
    el.style.height = 'auto';
    const innerMeasured = el.scrollHeight - BORDER;
    const oneLineInner = PAD_SINGLE + LINE;
    const isMulti = innerMeasured > oneLineInner + 0.5;
    const pads = isMulti ? PAD_MULTI : PAD_SINGLE;
    const innerMax = pads + LINE * MAX_LINES;
    const innerClamped = Math.max(oneLineInner, Math.min(innerMeasured, innerMax));
    const finalH = Math.max(MIN_H, innerClamped + BORDER);
    el.style.height = `${finalH}px`;
    el.classList.toggle('multiline', isMulti);
  };

  const startEdit = (m) => { setEditingId(m.id); setEditText(m.body || ''); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };
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
          <img src={href} alt={m.attachment_name || ''} className="attachment-img" />
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

  const items = msgs || [];
  const fmtTime = (d) => new Date(d).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtDay  = (d) => new Date(d).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' });

  return (
    <div className="dialog-page chats-page">
      <div className="dialog-header">
        <a className="dialog-back" href="/chats">
          <img src={BackArrow} alt="Назад" />
          <span>
            Чат з {(other?.firstName || other?.username || 'користувачем') + (other?.lastName ? ' ' + other.lastName : '')}
          </span>
        </a>
      </div>

      <div className="dialog-card">
        <div ref={boxRef} className="dialog-box">
          {(() => {
            let prevDay = null;
            return items.flatMap((m) => {
              const dayKey = new Date(m.created_at).toDateString();
              const sep = (prevDay !== dayKey)
                ? <div key={`sep-${m.id}`} className="day-sep">{fmtDay(m.created_at)}</div>
                : null;
              prevDay = dayKey;

              const mine = m.sender_id === user.id;
              const isEditing = editingId === m.id;

              const timeNode = <div className={`time-inline ${mine ? 'left' : 'right'}`}>{fmtTime(m.created_at)}</div>;

              return [
                sep,
                <div key={m.id} className={`message ${mine ? 'me' : 'other'}`}>
                  {!mine && (
                    <div className="msg-avatar">
                      <AvatarCircle
                        src={other?.avatarUrl}
                        firstName={other?.firstName}
                        lastName={other?.lastName}
                        username={other?.username}
                        size={28}
                      />
                    </div>
                  )}

                  {mine ? timeNode : null}

                  <div className="bubble-wrap">
                    <div className={`bubble ${mine ? 'me' : ''}`}>
                      {m.deleted_at ? (
                        <div className="deleted">{t('chat.deleted') || 'Сообщение удалено'}</div>
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
                    </div>

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

                  {!mine ? timeNode : null}
                </div>,
              ];
            });
          })()}
        </div>

        <div className="pm-input-bar">
          <div className="composer-bar">
            <div className="composer-field">
              <textarea
                ref={taRef}
                id="msg-input"
                className={`msg-input ${text ? 'is-filled' : ''}`}
                placeholder="Повідомлення"
                aria-label="Повідомлення"
                rows={1}
                value={text}
                onChange={onMsgChange}
              />
              <div className="msg-tools">
                <button
                  type="button"
                  className="msg-attach-btn"
                  aria-label="Прикрепить файл"
                  onClick={() => document.getElementById('chat-file-input').click()}
                >
                  <img className="msg-attach-img" src={AttachIcon} alt="" />
                </button>
                <button
                  type="button"
                  className="msg-send-btn"
                  aria-label="Відправити"
                  onClick={send}
                >
                  <img className="msg-send-img" src={SendIcon} alt="" />
                </button>
              </div>
              <input
                id="chat-file-input"
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
