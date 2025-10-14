import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import '../Styles/chat-widget.css';

/* Сообщение */
function Bubble({ role, children }) {
  return (
    <div className={`cw-row ${role}`}>
      <div className="cw-bubble">{children}</div>
    </div>
  );
}

/* Composer (внизу) */
function Composer({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState([]);
  const taRef = useRef(null);

  // авто-высота textarea 1–5 строк
  useEffect(() => {
    const el = taRef.current; if (!el) return;
    const LINE = 24, BORDER = 4, PAD1 = { t: 13.5, b: 13.5 }, PADM = { t: 8, b: 8 }, MIN = 55, MAXL = 5;
    const mirror = document.createElement('div');
    const cs = getComputedStyle(el);
    Object.assign(mirror.style, {
      position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap',
      wordWrap: 'break-word', overflowWrap: 'break-word', boxSizing: 'border-box',
      border: '0', font: cs.font, letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight,
      width: cs.width, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight,
    });
    document.body.appendChild(mirror);
    const setPads = (m) => { const p = m ? PADM : PAD1; el.style.paddingTop = p.t+'px'; el.style.paddingBottom = p.b+'px'; mirror.style.paddingTop = p.t+'px'; mirror.style.paddingBottom = p.b+'px'; el.classList.toggle('multiline', m); };
    const measure = (t, m) => { setPads(m); mirror.textContent = t?.length ? t : ' '; return mirror.offsetHeight; };
    const autosize = () => {
      const inner1 = PAD1.t + PAD1.b + LINE;
      const mm = measure(el.value, measure(el.value, false) > inner1 + 0.5);
      const multi = el.classList.contains('multiline');
      const p = multi ? PADM : PAD1;
      const innerMax = p.t + p.b + LINE * MAXL;
      const clamped = Math.max(inner1, Math.min(mm, innerMax));
      el.style.height = Math.max(MIN, clamped + BORDER) + 'px';
      el.style.overflowY = mm > innerMax + 0.5 ? 'auto' : 'hidden';
    };
    autosize();
    el.addEventListener('input', autosize);
    window.addEventListener('resize', autosize);
    return () => { el.removeEventListener('input', autosize); window.removeEventListener('resize', autosize); document.body.removeChild(mirror); };
  }, []);

  function send() {
    const text = value.trim();
    if (!text && files.length === 0) return;
    onSend({ text, files });
    setValue(''); setFiles([]);
    if (taRef.current) { taRef.current.style.height = '55px'; taRef.current.classList.remove('multiline'); }
  }
  const onAttach  = (e) => { const list = Array.from(e.target.files || []); setFiles((p) => [...p, ...list]); e.target.value = ''; };
  const onKeyDown = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); } };

  return (
    <div className="cw-composer">
      <textarea
        ref={taRef}
        className="cw-input"
        placeholder="Запитайте у AI-консультанта"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
      />

      <div className="cw-actions">
        {/* СКРЕПКА (твой SVG) */}
        <label className="cw-attach" title="Прикріпити">
          <input type="file" multiple onChange={onAttach} style={{ display:'none' }} />
          <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M8.00605 17.932C7.31756 17.9287 6.63662 17.7885 6.00284 17.5195C5.36905 17.2506 4.7951 16.8582 4.31438 16.3653C3.83727 15.9131 3.45401 15.3713 3.18653 14.7708C2.91905 14.1703 2.77261 13.523 2.75558 12.8659C2.73856 12.2087 2.85128 11.5547 3.08729 10.9412C3.32331 10.3276 3.678 9.76665 4.13105 9.29035L10.2644 3.09868C10.5916 2.77135 10.982 2.51393 11.4117 2.34203C11.8415 2.17013 12.3017 2.08734 12.7644 2.09868C13.26 2.10037 13.7503 2.20072 14.2067 2.39387C14.6631 2.58702 15.0765 2.86911 15.4227 3.22368C16.1119 3.88722 16.5115 4.79578 16.5349 5.75216C16.5583 6.70855 16.2036 7.63557 15.5477 8.33202L9.38105 14.5237C9.18353 14.7225 8.94849 14.8802 8.68957 14.9875C8.43064 15.0948 8.15299 15.1496 7.87271 15.1487C7.56994 15.1491 7.27016 15.0888 6.99106 14.9715C6.71197 14.8541 6.45921 14.682 6.24771 14.4653C5.82499 14.0561 5.58086 13.4965 5.56838 12.9082C5.55589 12.32 5.77606 11.7505 6.18105 11.3237L11.8727 5.60702C12.0347 5.49944 12.2292 5.45189 12.4226 5.47261C12.6159 5.49333 12.7959 5.58102 12.9314 5.72048C13.0669 5.85995 13.1494 6.04241 13.1645 6.23627C13.1797 6.43014 13.1266 6.62319 13.0144 6.78202L7.32271 12.4987C7.2278 12.613 7.18161 12.7601 7.19408 12.9082C7.20655 13.0562 7.27669 13.1935 7.38938 13.2903C7.50664 13.4084 7.66472 13.477 7.83105 13.482C7.89266 13.4829 7.95384 13.4716 8.01105 13.4487C8.06826 13.4258 8.12037 13.3918 8.16438 13.3487L14.3227 7.15702C14.6684 6.773 14.8491 6.26838 14.8257 5.75222C14.8023 5.23607 14.5767 4.74986 14.1977 4.39868C13.8457 4.03322 13.367 3.81657 12.8601 3.79332C12.3532 3.77006 11.8567 3.94198 11.4727 4.27368L5.31438 10.432C5.01492 10.7537 4.78201 11.1313 4.62907 11.5433C4.47613 11.9553 4.40616 12.3935 4.4232 12.8327C4.44024 13.2718 4.54394 13.7032 4.72835 14.1021C4.91276 14.501 5.17423 14.8595 5.49771 15.157C5.82211 15.4933 6.21027 15.7616 6.63952 15.9461C7.06876 16.1307 7.53049 16.2279 7.99771 16.232C8.40056 16.2353 8.80009 16.1589 9.17334 16.0073C9.5466 15.8558 9.88622 15.6319 10.1727 15.3487L16.331 9.15702C16.4082 9.07932 16.4999 9.01758 16.6009 8.97532C16.7019 8.93306 16.8103 8.91111 16.9198 8.91072C17.0293 8.91033 17.1378 8.93152 17.2391 8.97306C17.3404 9.01461 17.4325 9.0757 17.5102 9.15285C17.5879 9.23 17.6497 9.3217 17.6919 9.42271C17.7342 9.52373 17.7561 9.63207 17.7565 9.74157C17.7569 9.85107 17.7357 9.95957 17.6942 10.0609C17.6526 10.1622 17.5915 10.2543 17.5144 10.332L11.356 16.5237C10.9188 16.9687 10.3975 17.3223 9.8224 17.5641C9.2473 17.8058 8.62989 17.9309 8.00605 17.932Z" fill="#828181"/>
          </svg>
        </label>

        {/* ОТПРАВИТЬ (твой SVG) */}
        <button className="cw-send" onClick={send} disabled={disabled} aria-label="Надіслати">
          <svg width="21" height="19" viewBox="0 0 21 19" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M19.3076 9.09766C19.541 9.21518 19.5703 9.49666 19.3955 9.65527L19.3086 9.71484C15.5317 11.6252 7.19015 15.8736 3.90332 17.7773C3.8374 16.2366 4.12863 14.3345 5.11914 13.0869L5.61328 12.4639L4.96289 12.0068L1.29883 9.43164L4.96289 6.85644L5.61328 6.39941L5.11914 5.77637C4.12824 4.52872 3.83686 2.625 3.90332 1.08398C7.18364 2.97872 15.5286 7.19982 19.3076 9.09766Z" fill="#35C65E" stroke="#35C65E" strokeWidth="1.5"/>
          </svg>
        </button>
      </div>

      {!!files.length && (
        <div className="cw-pending">
          {files.map((f, i) => (
            <div className="cw-file" key={i}>
              <span className="name">{f.name}</span>
              <button onClick={() => setFiles(files.filter((_, k) => k !== i))} aria-label="Убрати">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Виджет */
export default function ChatWidget({
  autoOpenOnError = false,
  anchorRef = null,
  id,
  open: controlledOpen,
  onClose,
}) {
  const popRef  = useRef(null);
  const launcherRef = useRef(null); // для автономного режима
  const scrollRef = useRef(null);

  const controlled = !!anchorRef;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlled ? (controlledOpen ?? true) : uncontrolledOpen;

  const [loading, setLoading] = useState(false);
  const [errText, setErrText] = useState('');
  const [msgs, setMsgs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('qonto.ai.chat') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    if (msgs.length === 0) {
      setMsgs([{ role: 'assistant', content: 'Чим я можу допомогти?' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { try { localStorage.setItem('qonto.ai.chat', JSON.stringify(msgs)); } catch {} }, [msgs]);

  // позиционирование
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = (controlled ? anchorRef?.current : launcherRef.current);
    const el = popRef.current;
    if (!anchor || !el) return;
    const r = anchor.getBoundingClientRect();
    const width = Math.min(520, window.innerWidth - 16 - 16);
    const left = Math.min(Math.max(r.left - width + r.width, 8), window.innerWidth - width - 8);
    const top  = Math.max(8, r.bottom + 8);
    Object.assign(el.style, { position: 'fixed', top: `${top}px`, left: `${left}px`, width: `${width}px`, maxHeight: '80vh' });
  }, [open, controlled, anchorRef]);

  // клик вне
  useEffect(() => {
    function onDoc(e) {
      if (!open) return;
      const pop = popRef.current;
      const btn = controlled ? anchorRef?.current : launcherRef.current;
      const insidePop = pop && pop.contains(e.target);
      const onBtn = btn && btn.contains(e.target);
      if (!insidePop && !onBtn) controlled ? onClose?.() : setUncontrolledOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, controlled, anchorRef, onClose]);

  // автоскролл
  useEffect(() => { const c = scrollRef.current; if (c) c.scrollTop = c.scrollHeight; }, [msgs, loading, open]);

  // авто-показ ошибок (только автономный режим)
  useEffect(() => {
    if (!autoOpenOnError || controlled) return;
    const onRejection = (ev) => { setErrText(ev?.reason?.message || 'Виникла помилка на сервері.'); setUncontrolledOpen(true); };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, [autoOpenOnError, controlled]);

  async function send({ text, files }) {
    setLoading(true); setErrText('');
    const user = { role: 'user', content: text };
    setMsgs((m) => [...m, user]);
    try {
      const fd = new FormData();
      fd.append('messages', JSON.stringify([...msgs, user].map(({ role, content }) => ({ role, content }))));
      (files || []).forEach((f) => fd.append('files', f, f.name));
      const res = await fetch('/api/ai/chat', { method: 'POST', body: fd });
      const data = res.ok ? await res.json() : { reply: 'Виникла помилка на сервері.' };
      setMsgs((m) => [...m, { role: 'assistant', content: data.reply || 'Ок.' }]);
      if (!res.ok && !autoOpenOnError) setErrText('Виникла помилка на сервері.');
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Проблема з мережею, спробуй ще раз.' }]);
    } finally { setLoading(false); }
  }

  const suggestions = [
    'Що подарувати на день народження дитині?',
    'Як обрати велосипед?',
    'Які товари для спорту зараз найпопулярніші?',
    'Допоможи обрати подарунок',
    'Що мені знадобиться у поході?',
  ];

  const Welcome = () => (
    <div className="cw-welcome">
      <div className="cw-hello">
        {/* Аватар — твой SVG */}
        <svg className="cw-ava" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <mask id="mava" maskUnits="userSpaceOnUse" x="0" y="0" width="26" height="26" style={{maskType:'alpha'}}>
            <circle cx="13.0078" cy="12.9258" r="12.5" fill="#D9D9D9"/>
          </mask>
          <g mask="url(#mava)">
            <rect x="-3.49219" y="-3.57422" width="37" height="35" fill="#35C65E"/>
            <path d="M30.6211 36.3703C26.9516 28.9675 23.8373 21.0436 21.2472 12.7482C21.1774 12.4872 21.0971 12.2289 21.0059 11.9758C21.0021 11.9638 20.9983 11.9518 20.9944 11.9411L20.9928 11.9435C19.7923 8.66027 16.8209 6.16111 13.1062 5.74365C9.4067 5.32791 5.96678 7.08989 4.06326 10.005L4.06228 10.0023C4.05732 10.012 4.0511 10.0216 4.04615 10.0313C3.87644 10.2937 3.71873 10.5638 3.5754 10.8432C-0.767853 18.3197 -5.44563 25.3614 -10.6412 31.7334C-10.8402 32.0271 -10.6873 32.4298 -10.3431 32.5147C-6.65528 33.4239 -0.834724 33.6938 3.23055 31.2324L8.58997 40.7C8.85837 41.1735 9.51264 41.247 9.87945 40.8449L17.2051 32.8041C20.624 36.1065 26.3581 37.1339 30.1556 37.0672C30.5113 37.0609 30.7486 36.7008 30.6211 36.3703Z" fill="white"/>
            <path d="M10.3938 12.762C10.7166 12.7982 11.0244 12.4169 11.0813 11.9102C11.1383 11.4034 10.9228 10.9633 10.6 10.927C10.2773 10.8907 9.96946 11.2721 9.91252 11.7788C9.85558 12.2855 10.0711 12.7257 10.3938 12.762Z" fill="#363535"/>
            <path d="M17.3157 13.5413C17.6384 13.5775 17.9462 13.1962 18.0032 12.6895C18.0601 12.1827 17.8447 11.7426 17.5219 11.7063C17.1991 11.67 16.8913 12.0514 16.8344 12.5581C16.7775 13.0648 16.9929 13.505 17.3157 13.5413Z" fill="#363535"/>
            <path d="M13.5136 15.7099L12.5554 14.5627C12.416 14.3954 12.5511 14.1433 12.7684 14.1677L14.9154 14.409C15.1326 14.4334 15.2084 14.7092 15.0353 14.8414L13.8464 15.7474C13.7437 15.8258 13.5976 15.8093 13.5136 15.7099Z" fill="#363535"/>
          </g>
          <circle cx="13.0078" cy="12.9258" r="12" stroke="#35C65E"/>
        </svg>

        <div className="cw-hello-bubble">Чим я можу допомогти?</div>
      </div>

      <div className="cw-chips">
        {suggestions.map((s, i) => (
          <button key={i} type="button" className="cw-chip" onClick={() => send({ text: s, files: [] })} title={s}>
            {s}
          </button>
        ))}
      </div>

      {/* Центральный зелёный шар с ромбом */}
      <div className="cw-logo-dot" aria-hidden="true">
        <svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
          <circle cx="28" cy="28" r="28" fill="#7AD293" opacity="0.7"/>
          <circle cx="28" cy="28" r="24" fill="#35C65E"/>
          <rect x="18" y="18" width="20" height="20" rx="6" transform="rotate(45 28 28)" fill="#FFFFFF" opacity="0.9"/>
        </svg>
      </div>
    </div>
  );

  /* ─ рендер ─ */
  if (controlled) {
    if (!open) return null;
    return (
      <div ref={popRef} id={id} className="cw-popover" role="dialog" aria-label="AI чат">
        <div className="cw-toolbar">
          {/* Історія запитів — контурная */}
          <div className="cw-tab outline">

            Історія запитів
          </div>

          {/* Новий чат — зелёная кнопка с плюсом */}
          <button className="cw-tab solid" type="button" onClick={() => setMsgs([{ role: 'assistant', content: 'Чим я можу допомогти?' }])} title="Новий чат">
            {/* <span className="ico" aria-hidden="true">
              <svg width="27" height="27" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.5505 14.5374L14.5505 21.7857C14.5505 22.0569 14.4457 22.2972 14.2361 22.5068C14.0266 22.7163 13.7862 22.8211 13.515 22.8211C13.2438 22.8211 13.0035 22.7163 12.7939 22.5068C12.5843 22.2972 12.4796 22.0569 12.4796 21.7857L12.4796 14.5374L5.23131 14.5374C4.96012 14.5374 4.71975 14.4326 4.51019 14.2231C4.30063 14.0135 4.19585 13.7731 4.19585 13.502C4.19585 13.2308 4.30063 12.9904 4.51019 12.7808C4.71975 12.5713 4.96012 12.4665 5.23131 12.4665L12.4796 12.4665L12.4796 5.21825C12.4796 4.94705 12.5843 4.70668 12.7939 4.49712C13.0035 4.28756 13.2438 4.18278 13.515 4.18278C13.7862 4.18278 14.0266 4.28756 14.2361 4.49712C14.4457 4.70668 14.5505 4.94706 14.5505 5.21825L14.5505 12.4665H21.7987C22.0699 12.4665 22.3103 12.5713 22.5199 12.7808C22.7294 12.9904 22.8342 13.2308 22.8342 13.502C22.8342 13.7731 22.7294 14.0135 22.5199 14.2231C22.3103 14.4326 22.0699 14.5374 21.7987 14.5374H14.5505Z" fill="white"/>
              </svg>
            </span> */}
            Новий чат
          </button>

          <button className="cw-x" onClick={() => onClose?.()} aria-label="Закрити">×</button>
        </div>

        {!!errText && <div className="cw-error">{errText}</div>}

        <div className="cw-scroll" ref={scrollRef}>
          {msgs.length <= 1 ? <Welcome /> : msgs.map((m, i) => (<Bubble key={i} role={m.role}>{m.content}</Bubble>))}
          {loading && (<div className="cw-typing" aria-live="polite"><span/><span/><span/></div>)}
        </div>

        <Composer onSend={send} disabled={loading} />
      </div>
    );
  }

  /* автономный режим (на будущее) */
  return (
    <div style={{ position: 'fixed', inset: 'auto 16px 16px auto', zIndex: 9999, pointerEvents: 'none' }}>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setUncontrolledOpen((v) => !v)}
        style={{ pointerEvents: 'auto', padding:'8px 10px', borderRadius:10, border:'2px solid var(--accent)', background:'#fff', color:'var(--accent)', fontFamily:'var(--font)', cursor:'pointer' }}
      >
        {open ? 'Закрити чат' : 'AI-Консультант'}
      </button>

      {open && (
        <div ref={popRef} className="cw-popover" role="dialog" aria-label="AI чат" style={{ pointerEvents: 'auto' }}>
          <div className="cw-toolbar">
            <div className="cw-tab outline">
              {/*<span className="ico" aria-hidden="true">
                <svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3.95313 12.0005C3.95313 13.1814 4.18573 14.3508 4.63765 15.4418C5.08958 16.5329 5.75197 17.5242 6.58702 18.3593C7.42207 19.1943 8.41342 19.8567 9.50446 20.3087C10.5955 20.7606 11.7649 20.9932 12.9458 20.9932C14.1267 20.9932 15.2961 20.7606 16.3872 20.3087C17.4782 19.8567 18.4695 19.1943 19.3046 18.3593C20.1396 17.5242 20.802 16.5329 21.254 15.4418C21.7059 14.3508 21.9385 13.1814 21.9385 12.0005C21.9385 9.61549 20.9911 7.32816 19.3046 5.64171C17.6181 3.95525 15.3308 3.00781 12.9458 3.00781C10.5608 3.00781 8.27348 3.95525 6.58702 5.64171C4.90057 7.32816 3.95313 9.61549 3.95313 12.0005Z" stroke="#35C65E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12.9453 7.00391L12.9453 11.9998L15.9429 14.9974" stroke="#35C65E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>*/}
              Історія запитів
            </div>

            <button className="cw-tab solid" onClick={() => setMsgs([{ role: 'assistant', content: 'Чим я можу допомогти?' }])}>
              {/*<span className="ico" aria-hidden="true">
                <svg width="27" height="27" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.5505 14.5374L14.5505 21.7857C14.5505 22.0569 14.4457 22.2972 14.2361 22.5068C14.0266 22.7163 13.7862 22.8211 13.515 22.8211C13.2438 22.8211 13.0035 22.7163 12.7939 22.5068C12.5843 22.2972 12.4796 22.0569 12.4796 21.7857L12.4796 14.5374L5.23131 14.5374C4.96012 14.5374 4.71975 14.4326 4.51019 14.2231C4.30063 14.0135 4.19585 13.7731 4.19585 13.502C4.19585 13.2308 4.30063 12.9904 4.51019 12.7808C4.71975 12.5713 4.96012 12.4665 5.23131 12.4665L12.4796 12.4665L12.4796 5.21825C12.4796 4.94705 12.5843 4.70668 12.7939 4.49712C13.0035 4.28756 13.2438 4.18278 13.515 4.18278C13.7862 4.18278 14.0266 4.28756 14.2361 4.49712C14.4457 4.70668 14.5505 4.94706 14.5505 5.21825L14.5505 12.4665H21.7987C22.0699 12.4665 22.3103 12.5713 22.5199 12.7808C22.7294 12.9904 22.8342 13.2308 22.8342 13.502C22.8342 13.7731 22.7294 14.0135 22.5199 14.2231C22.3103 14.4326 22.0699 14.5374 21.7987 14.5374H14.5505Z" fill="white"/>
                </svg>
              </span> */}
              Новий чат
            </button>

            <button className="cw-x" onClick={() => setUncontrolledOpen(false)} aria-label="Закрити">×</button>
          </div>

          {!!errText && <div className="cw-error">{errText}</div>}

          <div className="cw-scroll" ref={scrollRef}>
            {msgs.length <= 1 ? <Welcome /> : msgs.map((m, i) => (<Bubble key={i} role={m.role}>{m.content}</Bubble>))}
            {loading && (<div className="cw-typing" aria-live="polite"><span/><span/><span/></div>)}
          </div>

          <Composer onSend={send} disabled={loading} />
        </div>
      )}
    </div>
  );
}
