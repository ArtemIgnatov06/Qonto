import React, { useEffect, useMemo, useState } from 'react';
import '../Styles/ModerCaseView.css';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';

import backArrow from '../assets/planex.png';
import fileIco from '../assets/upload.png';

/** форматируем дату как DD.MM.YY */
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
};

/** Аватар с фоллбеком в инициалы */
function Avatar({ src, name }) {
  if (src) return <img className="cv-badge__ava" src={src} alt="" />;
  const initials = (name||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('') || '??';
  return <span className="cv-badge__ava cv-ava-ph">{initials}</span>;
}

export default function ModerCaseView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [query] = useSearchParams();
  const location = useLocation();
  const hint = (location && location.state) ? location.state : {}; // <— фолбэк из списка
  const kind = (query.get('type') === 'complaint') ? 'complaint' : 'request';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [checked, setChecked] = useState({}); // просмотренные документы

  const endpoint = useMemo(() =>
    kind === 'complaint'
      ? `/api/moder/cases/complaints/${id}`
      : `/api/moder/cases/requests/${id}`
  , [id, kind]);

  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const r = await fetch(endpoint, { credentials: 'include' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (!stop) setData(j);
      } catch (e) {
        if (!stop) setError('Не вдалося завантажити');
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [endpoint]);

  // ------- ФИО + аватар: сначала берём из state (со списка), затем из payload детального запроса -------
  const u = data?.user || {};
  const fullName =
    // фолбэк из navigate(..., { state })
    hint.full_name ||
    [hint.first_name, hint.last_name].filter(Boolean).join(' ') ||
    hint.user_name ||
    // из ответа бэка
    (u.name ||
    [u.first_name, u.last_name, data?.first_name, data?.last_name].filter(Boolean).join(' ') ||
    u.full_name || data?.user_full_name || data?.user_name ||
    'Користувач');

  const avatar =
    // фолбэк из navigate(..., { state })
    (hint.avatar_url || hint.photo || hint.avatar) ||
    // из ответа бэка
    (u.avatar_url || u.avatar || u.photo || u.photo_url ||
     data?.avatar_url || data?.avatar || data?.photo || data?.user_avatar || null);

  const storeName = data?.store_name || data?.shop_name || 'Без назви';
  const createdDate = fmtDate(data?.created_at || data?.createdAt);

  // ------- Документы -------
  const docs = data?.docs || {};
  const registry = docs.registry_url || docs.registry || docs.registry_extract || null;
  const ipn      = docs.ipn_url      || docs.ipn      || docs.tax_id           || null;
  const passport = docs.passport_url || docs.passport || docs.passport_scan    || null;
  const attach   = docs.attachment   || null; // для скарг

  // первые два всегда показываем (если нет — неактивная строка)
  const fixedRows = [
    { key: 'registry_url', label: 'Завантажена виписка з реєстру', src: registry },
    { key: 'ipn_url',      label: 'Завантажений ІПН',              src: ipn },
  ];
  // дополнительные — только если реально есть
  const extraRows = [
    passport ? { key: 'passport_url', label: 'Завантажений паспорт', src: passport } : null,
    attach   ? { key: 'attachment',   label: 'Додаток до скарги',     src: attach   } : null,
  ].filter(Boolean);

  const allRows = [...fixedRows, ...extraRows];
  const allViewed = allRows.length>0 && allRows.every(r => !r.src || checked[r.key]);

  return (
    <main className="cv-page" role="main">
      <div className="cv-head">
        <button className="cv-back" type="button" onClick={() => navigate(-1)}>
          <img className="cv-back__ico" src={backArrow} alt="" aria-hidden="true" />
          <span className="cv-back__title">Заявки та скарги</span>
        </button>
      </div>

      <section className="cv-card" aria-busy={loading ? 'true' : 'false'}>
        <header className="cv-card__top">
          <div className="cv-left">
            <div className="cv-label">{kind === 'complaint' ? 'Скарга від' : 'Заявка від'}</div>
            <div className="cv-badge">
              <Avatar src={avatar} name={fullName}/>
              <span className="cv-badge__name">{fullName}</span>
            </div>
          </div>
          <div className="cv-time">{createdDate}</div>
        </header>

        <div className="cv-field">
          <div className="cv-field__label">{kind === 'complaint' ? 'Магазин' : 'Назва магазину'}</div>
          <div className="cv-field__box">{storeName}</div>
        </div>

        <div className="cv-docs">
          {allRows.map(r => {
            const isAvailable = !!r.src;
            const done = !!checked[r.key];
            const cls = 'cv-doc' + (isAvailable ? '' : ' is-disabled') + (done ? ' is-done' : '');
            return isAvailable ? (
              <button
                key={r.key}
                type="button"
                className={cls}
                onClick={() => setPreview({ key: r.key, src: r.src })}
              >
                <span className="cv-doc__check" aria-hidden="true" />
                <img className="cv-doc__ico" src={fileIco} alt="" aria-hidden="true" />
                <span className="cv-doc__label">{r.label}</span>
              </button>
            ) : (
              <div key={r.key} className={cls} aria-disabled="true">
                <span className="cv-doc__check" aria-hidden="true" />
                <img className="cv-doc__ico" src={fileIco} alt="" aria-hidden="true" />
                <span className="cv-doc__label">{r.label} — не завантажено</span>
              </div>
            );
          })}
        </div>

        <button
          className={'cv-confirm ' + (allViewed ? 'is-ready' : '')}
          type="button"
          disabled={!allViewed}
          onClick={async () => {
            try {
              const r = await fetch(`/api/moder/cases/${kind === 'complaint' ? 'complaints' : 'requests'}/${id}/approve`, {
                method: 'POST', credentials: 'include'
              });
              if (r.ok) navigate(-1);
            } catch {}
          }}
        >
          Підтвердити
        </button>

        {error && <div className="cv-error">{error}</div>}
      </section>

      {preview && (
        <div className="cv-modal">
          <div
            className="cv-modal__backdrop"
            onClick={() => {
              setChecked(s => ({ ...s, [preview.key]: true }));
              setPreview(null);
            }}
          />
          <div className="cv-modal__dialog">
            <button
              className="cv-modal__close"
              onClick={() => {
                setChecked(s => ({ ...s, [preview.key]: true }));
                setPreview(null);
              }}
            >
              ×
            </button>
            <img className="cv-modal__img" src={preview.src} alt="" />
          </div>
        </div>
      )}
    </main>
  );
}
