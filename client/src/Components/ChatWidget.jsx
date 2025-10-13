// client/src/Components/ChatWidget.jsx
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import '../Styles/chat-widget.css';

/* ────────────────────────────────────────────────────────────────────────── */
/* Пузырь */
function Bubble({ role, children }) {
  return (
    <div className={`cw-row ${role}`}>
      <div className="cw-bubble">{children}</div>
    </div>
  );
}

/* Инпут + кнопки */
function Composer({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState([]);
  const taRef = useRef(null);

  // авто-высота
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    const LINE = 24,
      BORDER = 4,
      PAD1 = { t: 13.5, b: 13.5 },
      PADM = { t: 8, b: 8 },
      MIN = 55,
      MAXL = 5;

    const mirror = document.createElement('div');
    const cs = getComputedStyle(el);
    Object.assign(mirror.style, {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      overflowWrap: 'break-word',
      boxSizing: 'border-box',
      border: '0',
      font: cs.font,
      letterSpacing: cs.letterSpacing,
      lineHeight: cs.lineHeight,
      width: cs.width,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
    });
    document.body.appendChild(mirror);

    const setPads = (m) => {
      const p = m ? PADM : PAD1;
      el.style.paddingTop = p.t + 'px';
      el.style.paddingBottom = p.b + 'px';
      mirror.style.paddingTop = p.t + 'px';
      mirror.style.paddingBottom = p.b + 'px';
      el.classList.toggle('multiline', m);
    };
    const measure = (t, m) => {
      setPads(m);
      mirror.textContent = t?.length ? t : ' ';
      return mirror.offsetHeight;
    };

    const autosize = () => {
      el.classList.toggle('is-filled', !!el.value.trim());
      const inner1 = PAD1.t + PAD1.b + LINE;
      const ms = measure(el.value, false);
      const multi = ms > inner1 + 0.5;
      const mm = measure(el.value, multi);
      const p = multi ? PADM : PAD1;
      const innerMax = p.t + p.b + LINE * MAXL;
      const clamped = Math.max(inner1, Math.min(mm, innerMax));
      el.style.height = Math.max(MIN, clamped + BORDER) + 'px';
      el.style.overflowY = mm > innerMax + 0.5 ? 'auto' : 'hidden';
    };

    autosize();
    el.addEventListener('input', autosize);
    window.addEventListener('resize', autosize);
    return () => {
      el.removeEventListener('input', autosize);
      window.removeEventListener('resize', autosize);
      document.body.removeChild(mirror);
    };
  }, []);

  function send() {
    const text = value.trim();
    if (!text && files.length === 0) return;
    onSend({ text, files });
    setValue('');
    setFiles([]);
    if (taRef.current) {
      taRef.current.style.height = '55px';
      taRef.current.classList.remove('multiline', 'is-filled');
    }
  }

  function onAttach(e) {
    const list = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...list]);
    e.target.value = '';
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="cw-composer">
      <textarea
        ref={taRef}
        className="cw-input"
        placeholder="Повідомлення"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
      />
      <div className="cw-actions">
        <label className="cw-attach" title="Прикріпити">
          <input type="file" multiple onChange={onAttach} />
          <img src="/img/chat/attach.svg" alt="" />
        </label>
        <button className="cw-send" onClick={send} disabled={disabled}>
          <img src="/img/chat/send.svg" alt="" />
        </button>
      </div>
      {!!files.length && (
        <div className="cw-pending">
          {files.map((f, i) => (
            <div className="cw-file" key={i}>
              <span className="name">{f.name}</span>
              <button
                onClick={() =>
                  setFiles(files.filter((_, k) => k !== i))
                }
                aria-label="Убрати"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Виджет (кнопка + поповер). По умолчанию НЕ авто-открывается при ошибках.  */
export default function ChatWidget({ autoOpenOnError = false }) {
  const rootRef = useRef(null);
  const popRef = useRef(null);
  const launcherRef = useRef(null);
  const scrollRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errText, setErrText] = useState('');

  const [msgs, setMsgs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('qonto.ai.chat') || '[]');
    } catch {
      return [];
    }
  });

  // стартовое приветствие
  useEffect(() => {
    if (msgs.length === 0) {
      setMsgs([
        {
          role: 'assistant',
          content: 'Привіт! Я AI-консультант Qonto. Що шукаєш?',
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem('qonto.ai.chat', JSON.stringify(msgs));
    } catch {}
  }, [msgs]);

  // позиционирование поповера под кнопкой
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = launcherRef.current;
    const el = popRef.current;
    if (!anchor || !el) return;
    const r = anchor.getBoundingClientRect();
    const top = r.top - 16; // над кнопкой
    const idealLeft = r.left - 360 + r.width; // ширина поповера ~360-420
    const width = Math.min(420, window.innerWidth - 16 - 16);
    const left = Math.min(
      Math.max(idealLeft, 8),
      window.innerWidth - width - 8
    );
    Object.assign(el.style, {
      top: `${Math.max(8, top - 420)}px`,
      left: `${left}px`,
      width: `${width}px`,
    });
  }, [open]);

  // клик вне — закрыть
  useEffect(() => {
    function onDoc(e) {
      const pop = popRef.current;
      const btn = launcherRef.current;
      const insidePop = pop && pop.contains(e.target);
      const onBtn = btn && btn.contains(e.target);
      if (!insidePop && !onBtn) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // автоскролл вниз
  useEffect(() => {
    const c = scrollRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [msgs, loading, open]);

  // необязательный автопоказ при необработанных ошибках (по флагу)
  useEffect(() => {
    if (!autoOpenOnError) return;
    const onRejection = (ev) => {
      setErrText(ev?.reason?.message || 'Виникла помилка на сервері.');
      setOpen(true);
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () =>
      window.removeEventListener('unhandledrejection', onRejection);
  }, [autoOpenOnError]);

  async function send({ text, files }) {
    setLoading(true);
    setErrText('');
    const user = { role: 'user', content: text };
    setMsgs((m) => [...m, user]);

    try {
      const fd = new FormData();
      fd.append(
        'messages',
        JSON.stringify([...msgs, user].map(({ role, content }) => ({ role, content })))
      );
      (files || []).forEach((f) => fd.append('files', f, f.name));

      const res = await fetch('/api/ai/chat', { method: 'POST', body: fd });
      const data = res.ok
        ? await res.json()
        : { reply: 'Виникла помилка на сервері.' };

      setMsgs((m) => [
        ...m,
        { role: 'assistant', content: data.reply || 'Ок.' },
      ]);
      if (!res.ok && !autoOpenOnError) {
        // Если запретили автопоказ — просто оставим текст в чате, без всплытий
        setErrText('Виникла помилка на сервері.');
      }
    } catch {
      setMsgs((m) => [
        ...m,
        { role: 'assistant', content: 'Проблема з мережею, спробуй ще раз.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const launcherLabel = useMemo(
    () => (open ? 'Закрити чат' : 'AI-Консультант'),
    [open]
  );

  return (
    <div
      ref={rootRef}
      className="cw-root"
      style={{
        position: 'fixed',
        inset: 'auto 16px 16px auto',
        zIndex: 9999,
        pointerEvents: 'none', // кликается только кнопка/модал
      }}
    >
      {/* Кнопка запуска */}
      <button
        ref={launcherRef}
        type="button"
        className="cw-launcher"
        aria-label="AI-Консультант"
        onClick={() => setOpen((v) => !v)}
        style={{ pointerEvents: 'auto' }}
      >
        {launcherLabel}
      </button>

      {/* Поповер */}
      {open && (
        <div
          ref={popRef}
          className="cw-popover"
          role="dialog"
          aria-label="AI чат"
          style={{
            position: 'fixed',
            pointerEvents: 'auto',
            maxHeight: '80vh',
          }}
        >
          <div className="cw-head">
            <span className="cw-title">AI-Консультант</span>
            <button
              className="cw-close"
              onClick={() => setOpen(false)}
              aria-label="Закрити"
            >
              ×
            </button>
          </div>

          {!!errText && <div className="cw-error">{errText}</div>}

          <div className="cw-scroll" ref={scrollRef}>
            {msgs.map((m, i) => (
              <Bubble key={i} role={m.role}>
                {m.content}
              </Bubble>
            ))}
            {loading && (
              <div className="cw-typing" aria-live="polite">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <Composer onSend={send} disabled={loading} />
        </div>
      )}
    </div>
  );
}
