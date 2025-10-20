// client/src/Pages/Profile.jsx — full name display + dynamic checklist + avatar upload/initials
import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../Styles/Profile.css';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';

import imgSettings from '../assets/settings.png';
import imgChat from '../assets/chat.png';
import imgCompleteSmall from '../assets/complete-small.png';
import imgPlane from '../assets/planex.png';
import imgReady from '../assets/ready.png';

/* ===================== helpers ===================== */
const pick = (obj, path) =>
  (path||'').split('.').reduce((a,k)=> (a && a[k]!==undefined ? a[k] : undefined), obj);

function parseLocal(keyList){
  for (const k of keyList){
    try{
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const val = JSON.parse(raw);
      if (val) return val;
    }catch{/* ignore */}
  }
  return null;
}

function splitName(full=''){
  const s = (full||'').trim().replace(/\s+/g,' ');
  if (!s) return { first:'', last:'' };
  const parts = s.split(' ');
  if (parts.length === 1) return { first: parts[0], last:'' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function titleCase(s=''){
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : '';
}

function nameFromEmail(email=''){
  const local = (email||'').split('@')[0] || '';
  if (!local) return '';
  const parts = local.replace(/[^a-zA-Zа-яА-ЯіІїЇєЄёЁ._-]/g,'').split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2){
    return `${titleCase(parts[0])} ${titleCase(parts[1])}`;
  }
  return titleCase(local);
}

function deriveInitials({ first='', last='', email='' }){
  const f = (first||'').trim();
  const l = (last||'').trim();
  if (f || l){
    if (f && l) return (f[0] + l[0]).toUpperCase();
    const single = (f || l);
    return (single.slice(0,2)).toUpperCase();
  }
  const mail = (email||'').split('@')[0] || '';
  if (mail){
    const parts = mail.replace(/[^a-zA-Zа-яА-ЯіІїЇєЄёЁ\-_.]/g,'').split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (mail.slice(0,2)).toUpperCase();
  }
  return '??';
}

async function fetchJSONFrom(urls){
  for (const u of urls){
    try{
      const res = await fetch(u, { credentials:'include' });
      if (!res.ok) continue;
      const data = await res.json();
      if (data!=null) return data;
    }catch{/* ignore */}
  }
  return null;
}

async function fetchUserFallback(){
  return await fetchJSONFrom(['/api/profile','/api/me','/auth/me','/users/me']);
}

function normalizeUser(src){
  if (!src) return {};
  const roots = [src, src.user, src.data, src.profile, pick(src,'data.user'), pick(src,'profile.user')].filter(Boolean);
  const best = Object.assign({}, ...roots);
  let first = best.first_name ?? best.firstName ?? best.given_name ?? best.givenName ?? best.first;
  let last  = best.last_name  ?? best.lastName  ?? best.family_name ?? best.familyName ?? best.last;
  let full  = best.full_name  ?? best.fullName  ?? best.displayName ?? best.name;
  if ((!first || !last) && full){
    const sp = splitName(full);
    first = first || sp.first;
    last  = last  || sp.last;
  }
  const email = best.email ?? best.mail ?? pick(best,'contacts.email') ?? pick(best,'emails.0') ?? '';
  const avatar = best.avatar_url ?? best.avatarUrl ?? best.avatar ?? pick(best,'images.avatar') ?? '';
  return { first_name:first||'', last_name:last||'', email, avatar };
}

async function uploadAvatar(file){
  const form = new FormData();
  form.append('avatar', file);
  const endpoints = ['/api/profile/avatar','/api/users/avatar','/api/me/avatar','/upload/avatar'];
  for (const url of endpoints){
    try{
      const res = await fetch(url, { method:'POST', body: form, credentials:'include' });
      if (!res.ok) continue;
      const json = await res.json().catch(()=>({}));
      const urlOut = json?.url || json?.avatar_url || json?.avatarUrl || json?.avatar || json?.data?.url;
      if (urlOut) return urlOut;
    }catch{/* ignore */}
  }
  return null;
}

/* ===================== component ===================== */
export default function Profile(){
  const navigate = useNavigate();
  const { user: authUser, setUser: setAuthUser } = useAuth() || {};

  const [user, setUser] = useState(()=> authUser || parseLocal(['user','auth','profile','qonto_user','qonto.auth','qonto.profile']) || null);

  // Checklist statuses
  const [done, setDone] = useState({ photo:false, address:false, card:false, order:false });

  useEffect(()=>{ if (authUser) setUser(prev => ({ ...(prev||{}), ...normalizeUser(authUser) })); }, [authUser]);

  // Pull more data if missing; also compute checklist from APIs/localStorage
  useEffect(()=>{
    let cancelled = false;
    (async () => {
      // user fill
      const missing = !user || !(user.first_name || user.firstName || user.full_name || user.name);
      if (missing){
        const local = parseLocal(['user','auth','profile','qonto_user','qonto.auth','qonto.profile']);
        if (!cancelled && local){
          setUser(prev => ({ ...(prev||{}), ...normalizeUser(local) }));
        }
        const data = await fetchUserFallback();
        if (!cancelled && data){
          setUser(prev => ({ ...(prev||{}), ...normalizeUser(data) }));
        }
      }
      // checklist
      const avatarUrl = (user?.avatar_url || user?.avatarUrl || user?.avatar || '').trim();
      const localAddr  = parseLocal(['addresses','qonto.addresses','user.addresses']);
      const localCards = parseLocal(['cards','qonto.cards','user.cards']);
      const localOrders= parseLocal(['orders','qonto.orders','user.orders']);
      let address = !!(Array.isArray(localAddr) ? localAddr.length : (localAddr?.length||0));
      let card    = !!(Array.isArray(localCards) ? localCards.length : (localCards?.length||0));
      let order   = !!(Array.isArray(localOrders) ? localOrders.length : (localOrders?.length||0));
      try{
        const [a,c,o] = await Promise.all([
          fetchJSONFrom(['/api/addresses','/addresses','/user/addresses']),
          fetchJSONFrom(['/api/cards','/cards','/payment/cards']),
          fetchJSONFrom(['/api/orders','/orders','/user/orders'])
        ]);
        address = address || (Array.isArray(a) ? a.length>0 : (a?.count>0));
        card    = card    || (Array.isArray(c) ? c.length>0 : (c?.count>0));
        order   = order   || (Array.isArray(o) ? o.length>0 : (o?.count>0));
      }catch{/* ignore */}
      if (!cancelled){
        setDone({ photo: !!avatarUrl, address, card, order });
      }
    })();
    return ()=>{ cancelled = true; };
  }, [user]);

  const first = user?.first_name || user?.firstName || '';
  const last  = user?.last_name  || user?.lastName  || '';
  const email = user?.email || '';
  const displayName = ([first,last].filter(Boolean).join(' ')) || nameFromEmail(email) || 'Користувач';
  const avatarUrl = user?.avatar_url || user?.avatarUrl || user?.avatar || '';

  // Avatar upload
  const fileRef = useRef(null);
  const onAvatarClick = () => fileRef.current?.click();
  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUser(prev => ({ ...(prev||{}), avatar_url: objectUrl }));
    setDone(prev => ({ ...prev, photo: true }));
    const uploadedUrl = await uploadAvatar(file);
    if (uploadedUrl){
      setUser(prev => ({ ...(prev||{}), avatar_url: uploadedUrl, avatarUrl: uploadedUrl, avatar: uploadedUrl }));
      try{ setAuthUser?.((prev)=> ({ ...(prev||{}), avatar_url: uploadedUrl })); }catch{/* ignore */}
    }
  };

  const initials = useMemo(()=> deriveInitials({ first, last, email }), [first, last, email]);

  // Keep profile in sync if another tab saves
  useEffect(()=>{
    const handler = (e)=>{
      if (['user','auth','profile','qonto_user','qonto.auth','qonto.profile'].includes(e.key||'')){
        const val = (()=>{ try{ return JSON.parse(e.newValue||'null'); }catch{ return null; } })();
        if (val) setUser(prev=> ({ ...(prev||{}), ...normalizeUser(val) }));
      }
      if (e.key === 'addresses' || e.key === 'cards' || e.key === 'orders'){
        // re-evaluate checklist
        setDone(d=> ({ ...d })); // simple trigger; next effect recomputes
      }
    };
    window.addEventListener('storage', handler);
    return ()=> window.removeEventListener('storage', handler);
  }, []);

  async function doLogout(){
    // Try server endpoints; then clear local session and redirect
    const endpoints = [
      { url: '/api/logout', method:'POST' },
      { url: '/logout', method:'POST' },
      { url: '/auth/logout', method:'POST' },
    ];
    for (const ep of endpoints){
      try{
        const res = await fetch(ep.url, { method: ep.method, credentials:'include' });
        // not critical whether ok or not — proceed to local cleanup
      }catch{/* ignore */}
    }
    try{
      // Clear common auth storages
      const keys = ['token','auth','user','profile','qonto_user','qonto.auth','qonto.profile','addresses','cards','orders','twofa'];
      keys.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear?.();
    }catch{}
    try{ setAuthUser?.(null); }catch{}
    try{ navigate('/'); }catch{ window.location.href = '/'; }
  }

  return (
    <main className="q-profile" role="main">
      <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={onFileChange} />

      <section className="frame-918" aria-label="Профіль">
        {avatarUrl ? (
          <button className="avatar avatar--button" type="button" onClick={onAvatarClick} aria-label="Змінити аватар">
            <img src={avatarUrl} alt="Аватар" />
          </button>
        ) : (
          <button className="avatar avatar--button" type="button" onClick={onAvatarClick} aria-label="Завантажити аватар">
            <span className="avatar__initials">{initials}</span>
          </button>
        )}
        <span className="seller-dot" aria-hidden="true"></span>
        <span className="seller-tag">Покупець</span>
        <h5 className="seller-name">{displayName}</h5>
      </section>

      <button className="btn-edit-shop" type="button" onClick={() => navigate('/profile/settings')}>
        <span className="btn-edit-bg" />
        <img className="btn-edit-ico" src={imgSettings} alt="" />
        <span className="btn-edit-label">Редагувати профіль</span>
      </button>

      <Link className="btn-chats" to="/chats">
        <span className="btn-chats-bg" />
        <img className="btn-chats-ico" src={imgChat} alt="" />
        <span className="btn-chats-label">Чати</span>
      </Link>

      <section className="checklist" id="sellerChecklist" aria-label="Чекліст профілю">
        <div className="cl-frame"></div>
        <div className={`cl-icon cl-icon-1 ${done.photo ? 'is-done' : ''}`} style={done.photo ? { backgroundImage:`url(${imgReady})` } : undefined}></div>
        <div className={`cl-icon cl-icon-2 ${done.address ? 'is-done' : ''}`} style={done.address ? { backgroundImage:`url(${imgReady})` } : undefined}></div>
        <div className={`cl-icon cl-icon-3 ${done.card ? 'is-done' : ''}`} style={done.card ? { backgroundImage:`url(${imgReady})` } : undefined}></div>
        <div className={`cl-icon cl-icon-4 ${done.order ? 'is-done' : ''}`} style={done.order ? { backgroundImage:`url(${imgReady})` } : undefined}></div>
        <div className="cl-text cl-text-1">Додайте фото профілю</div>
        <div className="cl-text cl-text-2">Додайте адресу</div>
        <div className="cl-text cl-text-3">Додайте карту</div>
        <div className="cl-text cl-text-4">Замовте перший товар</div>
      </section>

      <nav className="seller-quicklinks" aria-label="Швидкі дії">
        <Link className="ql-view" to="/cart">Кошик</Link>
        <Link className="ql-analyt" to="/favorites">Список бажань</Link>
      </nav>

      <button className="btn-signout" type="button" onClick={doLogout}>Вийти з профілю</button>

      <h4 className="orders-title">Мої замовлення</h4>

      <a className="order-card is-done" href="/orders/ready">
        <div className="thumb"></div>
        <div className="oc-title oc-done">Готово</div>
        <div className="oc-date">8 серпня, Пт</div>
        <div className="oc-note">Можна забирати до 16 серпня, Сб</div>
        <span className="oc-frame" />
      </a>

      <a className="order-card" href="/orders/shipping">
        <div className="thumb"></div>
        <div className="oc-title">В дорозі</div>
        <div className="oc-wait">Очікується:</div>
        <div className="oc-date-green">9 серпня, Сб</div>
        <span className="oc-frame" />
      </a>

      <h4 className="orders-history-title">Історія замовлень</h4>

      <div className="mini-product">
        <div className="mp-mask"></div>
        <div className="mp-title">Доставлено</div>
        <div className="mp-date">9 серпня, Сб</div>
        <div className="mp-note">Було забрано 10 серпня, Сб</div>
        <a className="mp-link" href="/orders/123"></a>
        <div className="mp-frame"></div>
      </div>

      <div className="mini-banner">
        <img className="bn-img" src={imgCompleteSmall} alt="" />
        <div className="bn-title">Відкрийте свій магазин та почніть свої перші продажі!</div>
        <button className="bn-btn" type="button" onClick={() => navigate('/become-seller')}>
          <span>Стати продавцем</span>
        </button>
        <img className="bn-arrow" src={imgPlane} alt="" width="23" height="22" />
        <div className="bn-frame"></div>
      </div>
    </main>
  );
}
