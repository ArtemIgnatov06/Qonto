// client/src/Components/ChatWidget.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../App.css';
import { useTranslation } from 'react-i18next';
import '../Styles/ChatWidget.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5050';

const TypingIndicator = () => (
  <div className="message message-ai typing-indicator">
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
  </div>
);

export default function ChatWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesRef = useRef(null);
  const bottomRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  useEffect(() => {
    if (open) setTimeout(scrollToBottom, 50);
  }, [open, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await axios.post(
        `${API_BASE}/api/chat`,
        { message: userMessage },
        { withCredentials: true }
      );
      setMessages(prev => [...prev, { role: 'ai', content: res.data.reply }]);
    } catch (err) {
      const msg =
        err?.response?.data?.reply ||
        err?.response?.data?.error ||
        (err?.response
          ? t('chat.error.http', { status: err.response.status, statusText: err.response.statusText })
          : t('chat.error.generic'));
      setMessages(prev => [...prev, { role: 'ai', content: msg }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div className="chat-widget">
      {open ? (
        <div className="chat-box">
          <div className="chat-header">
            <div className="chat-header__title">{t('chat.header')}</div>
            <button
              className="close-button"
              onClick={() => setOpen(false)}
              aria-label={t('chat.close')}
            >
              ✕
            </button>
          </div>

          <div className="chat-messages" ref={messagesRef}>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`message ${m.role === 'user' ? 'message-user' : 'message-ai'}`}
              >
                {m.content}
              </div>
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-area row gap-8">
            <input
              type="text"
              className="chat-input"
              placeholder={t('chat.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button
              className="button send-button"
              onClick={sendMessage}
              disabled={isTyping}
            >
              {isTyping ? t('chat.typing') : t('chat.send')}
            </button>
          </div>
        </div>
      ) : (
        <button className="button open-widget" onClick={() => setOpen(true)}>
          {t('chat.open')}
        </button>
      )}
    </div>
  );
}
