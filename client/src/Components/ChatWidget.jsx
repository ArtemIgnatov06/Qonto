// client/src/components/ChatWidget.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../App.css';

const TypingIndicator = () => (
  <div className="message message-ai typing-indicator">
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
  </div>
);

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesRef = useRef(null);
  const bottomRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    // плавно или мгновенно
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  // Когда открывается виджет — прокрутка вниз
  useEffect(() => {
    if (open) {
      // немного задержим, чтобы содержимое отрендерилось
      setTimeout(scrollToBottom, 50);
    }
  }, [open, scrollToBottom]);

  // Прокрутка после добавления новых сообщений или исчезновения индикатора
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
      const res = await axios.post('http://localhost:5050/api/chat', { message: userMessage });
      // небольшая пауза, чтобы анимация была заметней (опционально)
      // await new Promise(r => setTimeout(r, 300));
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: res.data.reply },
      ]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Ошибка ответа от ИИ 😞' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="chat-widget">
      {open ? (
        <div className="chat-box">
          <div className="chat-header">
            <div>Чат с ИИ</div>
            <button
              className="close-button"
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>
          <div
            className="chat-messages"
            ref={messagesRef}
            style={{ overflowY: 'auto', flexGrow: 1, padding: '8px 12px' }}
          >
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
          <div className="chat-input-area" style={{ display: 'flex', gap: 8, padding: '8px 12px' }}>
            <input
              type="text"
              className="chat-input"
              placeholder="Напиши сообщение..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ flexGrow: 1 }}
              disabled={isTyping}
            />
            <button
              className="button send-button"
              onClick={sendMessage}
              disabled={isTyping}
              style={{ minWidth: 80 }}
            >
              {isTyping ? '...' : 'Отправить'}
            </button>
          </div>
        </div>
      ) : (
        <button className="button open-widget" onClick={() => setOpen(true)}>
          Чат💬
        </button>
      )}
    </div>
  );
}
