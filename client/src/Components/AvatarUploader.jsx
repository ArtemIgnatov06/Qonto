// client/src/Components/AvatarUploader.jsx
import React, { useRef, useState } from 'react';
import axios from 'axios';
import '../Styles/AvatarUploader.css';

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
    <div className="uploader-wrap">
      <div onClick={pick} title="Сменить фото" className="avatar-wrap">
        {url ? (
          <img src={url} alt="avatar" className="avatar-img" />
        ) : (
          <div aria-hidden className="avatar-letter">
            {String(letter || 'U').slice(0, 1).toUpperCase()}
          </div>
        )}

        {typeof online === 'boolean' && (
          <span
            title={online ? 'в сети' : 'не в сети'}
            className={`status-dot ${online ? 'online' : 'offline'}`}
          />
        )}

        {loading && (
          <div className="loading-overlay">
            Загрузка…
          </div>
        )}
      </div>

      <button className="btn-primary" onClick={pick} disabled={loading}>
        {loading ? 'Загрузка…' : 'Загрузить фото'}
      </button>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}
