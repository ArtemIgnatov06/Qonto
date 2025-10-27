// client/src/Components/SearchBox.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'http://localhost:5050';

export default function SearchBox({ initial = '', onSubmit }) {
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  // Debounced suggest
  useEffect(() => {
    if (!q.trim()) { setItems([]); return; }
    setLoading(true);
    const id = setTimeout(async () => {
      try{
        const r = await fetch(`${API}/api/search/suggest?q=` + encodeURIComponent(q.trim()));
        const data = await r.json();
        setItems(Array.isArray(data) ? data : []);
      }catch{ /* ignore */ }
      finally{ setLoading(false); setOpen(true); }
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  // Close on outside click/esc
  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      const path = e.composedPath ? e.composedPath() : (e.path || []);
      if (!path.includes(wrapRef.current)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const submit = (value) => {
    const query = (value ?? q).trim();
    if (!query) return;
    setOpen(false);
    if (onSubmit) onSubmit(query);
    else navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < items.length) submit(items[activeIdx].title);
      else submit();
    }
  };

  return (
    <div className="search-wrap" ref={wrapRef} role="search">
      <input
        className="search-input"
        type="search"
        placeholder="Пошук товарів…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setActiveIdx(-1); }}
        onFocus={() => { if (items.length) setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {q && (
        <button className="search-clear" type="button" aria-label="Очистити" onClick={() => setQ('')}>
          ×
        </button>
      )}
      <button className="search-btn" type="button" aria-label="Знайти" onClick={() => submit()}>
<svg
  width="26"
  height="26"
  viewBox="0 0 26 26"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <path
    d="M3.24978 22.7502L7.9547 18.0453M7.9547 18.0453C7.1499 17.2405 6.5115 16.2851 6.07595 15.2336C5.6404 14.1821 5.41622 13.055 5.41622 11.9169C5.41622 10.7787 5.6404 9.65173 6.07595 8.60022C6.5115 7.5487 7.1499 6.59327 7.9547 5.78847C8.75949 4.98368 9.71492 4.34528 10.7664 3.90973C11.818 3.47418 12.945 3.25 14.0831 3.25C15.2213 3.25 16.3483 3.47418 17.3998 3.90973C18.4513 4.34528 19.4067 4.98368 20.2115 5.78847C21.8369 7.41383 22.75 9.61829 22.75 11.9169C22.75 14.2155 21.8369 16.42 20.2115 18.0453C18.5862 19.6707 16.3817 20.5838 14.0831 20.5838C11.7845 20.5838 9.58005 19.6707 7.9547 18.0453Z"
    stroke="#7AD293"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
  <path
    d="M14 7L14.4709 8.42124C14.7139 9.14399 15.121 9.80067 15.6602 10.3398C16.1993 10.879 16.856 11.2861 17.5788 11.5291L19 12L17.5788 12.4709C16.857 12.7157 16.2012 13.1233 15.6623 13.6623C15.1233 14.2012 14.7157 14.857 14.4709 15.5788L14 17L13.5291 15.5788C13.2861 14.856 12.879 14.1994 12.3398 13.6602C11.8007 13.121 11.144 12.7139 10.4212 12.4709L9 12L10.4212 11.5291C11.1446 11.2873 11.8019 10.8806 12.3413 10.3413C12.8806 9.80191 13.2872 9.14463 13.5291 8.42124L14 7Z"
    fill="#7AD293"
  />
</svg>
      </button>

      {open && (q.trim().length > 0) && (
        <div className="suggest-card" role="listbox">
          {loading && <div className="suggest-row muted">Шукаю…</div>}
          {!loading && items.length === 0 && <div className="suggest-row muted">Нічого не знайдено</div>}
          {!loading && items.map((it, idx) => (
            <button
              key={it.id}
              role="option"
              aria-selected={idx === activeIdx}
              className={'suggest-row' + (idx === activeIdx ? ' active' : '')}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => submit(it.title)}
            >
              <span className="s-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <span className="s-title">{it.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
