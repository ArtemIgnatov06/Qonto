    import React, { useEffect, useMemo, useRef, useState } from "react";
import "../Styles/chat.css";

/** Сообщение в чат-ленте */
function MessageBubble({ role, content, files = [] }) {
  return (
    <div className={`msg ${role}`}>
      <div className="msg-bubble">
        <div className="msg-text">{content}</div>
        {!!files.length && (
          <div className="msg-files">
            {files.map((f, i) => (
              <a key={i} href={f.previewURL || "#"} target="_blank" rel="noreferrer" className="msg-file">
                {f.name || "attachment"}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Поле ввода + кнопки */
function MessageInput({ onSend, disabled }) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState([]);
  const taRef = useRef(null);

  // авто-высота текстового поля (как у тебя в HTML)
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    const LINE = 24;
    const BORDER = 4;
    const PAD_SINGLE = { t: 13.5, b: 13.5 };
    const PAD_MULTI = { t: 8, b: 8 };
    const MIN_H = 55;
    const MAX_LINES = 5;

    const mirror = document.createElement("div");
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";
    mirror.style.overflowWrap = "break-word";
    mirror.style.boxSizing = "border-box";
    mirror.style.border = "0";
    const cs = getComputedStyle(el);
    mirror.style.font = cs.font;
    mirror.style.letterSpacing = cs.letterSpacing;
    mirror.style.lineHeight = cs.lineHeight;
    mirror.style.width = cs.width;
    mirror.style.paddingLeft = cs.paddingLeft;
    mirror.style.paddingRight = cs.paddingRight;
    document.body.appendChild(mirror);

    function setPads(multiline) {
      const p = multiline ? PAD_MULTI : PAD_SINGLE;
      el.style.paddingTop = p.t + "px";
      el.style.paddingBottom = p.b + "px";
      mirror.style.paddingTop = p.t + "px";
      mirror.style.paddingBottom = p.b + "px";
      el.classList.toggle("multiline", multiline);
    }

    function measureInnerHeight(text, multiline) {
      setPads(multiline);
      mirror.textContent = text?.length ? text : " ";
      return mirror.offsetHeight;
    }

    function autosize() {
      const innerOneLine = PAD_SINGLE.t + PAD_SINGLE.b + LINE;
      const single = measureInnerHeight(el.value, false);
      const isMulti = single > innerOneLine + 0.5;
      const measured = measureInnerHeight(el.value, isMulti);
      const pads = isMulti ? PAD_MULTI : PAD_SINGLE;
      const innerMax = pads.t + pads.b + LINE * MAX_LINES;
      const clamped = Math.max(innerOneLine, Math.min(measured, innerMax));
      const finalH = Math.max(MIN_H, clamped + BORDER);
      el.style.height = finalH + "px";
      el.style.overflowY = measured > innerMax + 0.5 ? "auto" : "hidden";
      el.classList.toggle("is-filled", !!el.value.trim());
    }

    autosize();
    el.addEventListener("input", autosize);
    window.addEventListener("resize", autosize);
    return () => {
      el.removeEventListener("input", autosize);
      window.removeEventListener("resize", autosize);
      document.body.removeChild(mirror);
    };
  }, []);

  function handleAttach(e) {
    const list = Array.from(e.target.files || []);
    const withPreview = list.map((f) => {
      let previewURL = null;
      try {
        previewURL = URL.createObjectURL(f);
      } catch {}
      return { file: f, name: f.name, previewURL };
    });
    setFiles((prev) => [...prev, ...withPreview]);
    e.target.value = "";
  }

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    const text = value.trim();
    if (!text && files.length === 0) return;
    onSend({ text, files });
    setValue("");
    setFiles([]);
    // сбрасываем высоту textarea
    if (taRef.current) {
      taRef.current.style.height = "55px";
      taRef.current.classList.remove("multiline", "is-filled");
    }
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="composer">
      <textarea
        ref={taRef}
        className="msg-input"
        placeholder="Повідомлення"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        rows={2}
      />
      <div className="composer-actions">
        <label className="attach">
          <input type="file" multiple onChange={handleAttach} />
          <img src="/img/chat/attach.svg" alt="" />
        </label>
        <button className="send" onClick={submit} disabled={disabled}>
          <img src="/img/chat/send.svg" alt="" />
        </button>
      </div>

      {!!files.length && (
        <div className="pending-files">
          {files.map((f, i) => (
            <div className="pending-file" key={i} title={f.name}>
              <span className="name">{f.name}</span>
              <button onClick={() => removeFile(i)} aria-label="Убрать">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Главная страница чата */
export default function Chat() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Привіт! Я AI-консультант Qonto. Чим можу допомогти?" }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    // автоскролл к последнему сообщению
    const c = scrollRef.current;
    if (!c) return;
    c.scrollTop = c.scrollHeight;
  }, [messages, loading]);

  async function sendToServer({ text, files }) {
    setLoading(true);

    const userMsg = { role: "user", content: text, files };
    setMessages((m) => [...m, userMsg]);

    try {
      // Если у тебя JSON-эндпоинт:
      // const res = await fetch("/api/ai/chat", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })) })
      // });

      // Если файлы нужны — отправляй form-data:
      const fd = new FormData();
      fd.append("messages", JSON.stringify([...messages, userMsg].map(({ role, content }) => ({ role, content }))));
      (files || []).forEach((f) => fd.append("files", f.file, f.name));

      const res = await fetch("/api/ai/chat", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();

      // ожидаем { reply: "..." }
      const assistantMsg = { role: "assistant", content: data.reply || "Ок." };
      setMessages((m) => [...m, assistantMsg]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Вибач, сталася помилка. Повтори ще раз." }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-page">
      {/* заглушка названия магазина, как просил */}
      <h3 className="chat-title" aria-label="Чат з Super Noname Store">Чат з Super Noname Store</h3>

      <div className="chat-card">
        <div className="chat-scroll" ref={scrollRef}>
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} files={m.files} />
          ))}
          {loading && (
            <div className="typing">
              <span className="dot"></span><span className="dot"></span><span className="dot"></span>
            </div>
          )}
        </div>

        <MessageInput onSend={sendToServer} disabled={loading} />
      </div>
    </div>
  );
}
