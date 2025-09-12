// client/src/Components/AvatarUploader.jsx
import React, { useRef, useState } from 'react';
import axios from 'axios';

const abs = (u) => (u && String(u).startsWith('http') ? u : u ? `http://localhost:5050${u}` : null);

/** props: { initialUrl, online?: boolean, letter?: string, onUploaded?: (url) => void } */
export default function AvatarUploader({ initialUrl, online, letter = 'U', onUploaded }) {
  const inputRef = useRef(null);
  const [url, setUrl] = useState(abs(initialUrl));
  const [loading, setLoading] = useState(false);

  const pick = () => inputRef.current?.click();

  const onChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const { data } = await axios.post('http://localhost:5050/api/me/avatar', form, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newUrl = abs(data.url || data.path || data.avatarUrl);
      if (newUrl) {
        setUrl(newUrl);
        onUploaded?.(newUrl);
      }
    } catch {
      alert('Не удалось загрузить фото');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 12 }}>
      <div
        onClick={pick}
        title="Сменить фото"
        style={{
          position: 'relative',
          width: 112,
          height: 112,
          borderRadius: '50%',
          overflow: 'visible',
          background: '#e5e7eb',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {url ? (
          <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
        ) : (
          <div
            aria-hidden
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              fontSize: 42,
              userSelect: 'none',
            }}
          >
            {String(letter || 'U').slice(0, 1).toUpperCase()}
          </div>
        )}

        {typeof online === 'boolean' && (
          <span
            title={online ? 'в сети' : 'не в сети'}
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: online ? '#22c55e' : '#9ca3af',
              border: '3px solid #fff',
              boxShadow: '0 2px 6px rgba(0,0,0,.12)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        )}

        {loading && (
          <div
            style={{
              position: 'absolute', inset: 0, background: 'rgba(255,255,255,.6)',
              display: 'grid', placeItems: 'center', fontSize: 12, color: '#374151'
            }}
          >
            Загрузка…
          </div>
        )}
      </div>

      <button className="btn-primary" onClick={pick} disabled={loading}>
        {loading ? 'Загрузка…' : 'Загрузить фото'}
      </button>

      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onChange} />
    </div>
  );
}
