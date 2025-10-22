// client/src/Pages/ProfileSettings.jsx — one Save button to persist ALL changes (name, email, 2FA, addresses, cards) + password changer
import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../Styles/ProfileSettings.css';
import { useAuth } from '../Hooks/useAuth';
import { useNavigate } from 'react-router-dom';

// assets
import editPng from '../assets/edit.png';
import plusPng from '../assets/plus.png';
import settingsPng from '../assets/settings.png';
import completePng from '../assets/complete.png';
import planePng from '../assets/plane.png';
import planexPng from '../assets/planex.png';

/* ========================= Helpers ========================= */
function luhnCheck(numStr){
  const s = (numStr || '').replace(/\D/g,'');
  if (s.length !== 16) return false;
  let sum = 0;
  for (let i=0;i<16;i++){
    let d = +s[15 - i];
    if (i % 2 === 1){ d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

async function fetchUserProfileFallback(){
  const urls = ['/api/profile','/api/me','/auth/me','/users/me'];
  for (const u of urls){
    try{
      const res = await fetch(u, { credentials: 'include' });
      if (!res.ok) continue;
      return await res.json();
    }catch{/* ignore */}
  }
  return null;
}
const pick = (obj, path) =>
  (path||'').split('.').reduce((a,k)=> (a && a[k]!==undefined ? a[k] : undefined), obj);

// --- name/email helpers ---
function splitName(full=''){
  const s = (full||'').trim().replace(/\s+/g,' ');
  if (!s) return { first:'', last:'' };
  const parts = s.split(' ');
  if (parts.length === 1) return { first: parts[0], last:'' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function extractNameEmail(src){
  if (!src) return { fullName:'', email:'' };
  const first = pick(src,'first_name') || pick(src,'firstName') || pick(src,'user.first_name') || pick(src,'data.firstName');
  const last  = pick(src,'last_name')  || pick(src,'lastName')  || pick(src,'user.last_name')  || pick(src,'data.lastName');
  const full  = pick(src,'fullName')   || pick(src,'name')      || pick(src,'profile.fullName');
  const email = pick(src,'email')      || pick(src,'user.email')|| pick(src,'data.email')      || pick(src,'profile.email');
  const fullName = (full || [first,last].filter(Boolean).join(' ')).trim();
  return { fullName, email: (email||'').trim() };
}

// save to backend (best-effort) and mirror to localStorage keys so Profile page reflects immediately
async function persistProfile(update){
  // align with server index.js: POST /api/me/update-profile
  try{
    const res = await fetch('/api/me/update-profile', {
      method:'POST',
      headers: { 'Content-Type':'application/json' },
      credentials:'include',
      body: JSON.stringify(update),
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      console.warn('update-profile failed', res.status, err);
    }
  } catch(e){ console.warn('update-profile error', e); }
  try{
    const keys = ['user','auth','profile','qonto_user','qonto.auth','qonto.profile'];
    for (const k of keys){
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      if (!obj) continue;
      obj.first_name = update.first_name ?? obj.first_name;
      obj.last_name  = update.last_name  ?? obj.last_name;
      obj.email      = update.email      ?? obj.email;
      if (obj.user){
        obj.user.first_name = update.first_name ?? obj.user.first_name;
        obj.user.last_name  = update.last_name  ?? obj.user.last_name;
        obj.user.email      = update.email      ?? obj.user.email;
      }
      if (obj.profile){
        obj.profile.first_name = update.first_name ?? obj.profile.first_name;
        obj.profile.last_name  = update.last_name  ?? obj.profile.last_name;
        obj.profile.email      = update.email      ?? obj.profile.email;
      }
      localStorage.setItem(k, JSON.stringify(obj));
    }
  }catch{}
}

async function persistAddresses(addresses){
  const payload = (addresses||[]).filter(a=> (a.label||a.address)).map(a=> ({
    label: (a.label||'').trim(), address: (a.address||'').trim()
  }));
  const urls = ['/api/addresses','/addresses','/user/addresses'];
  for (const u of urls){
    try{
      const res = await fetch(u, { method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(payload) });
      if (res.ok) break;
    }catch{}
  }
  try{ localStorage.setItem('addresses', JSON.stringify(payload)); }catch{}
}

async function persistCards(cards){
  const payload = (cards||[]).filter(c=> c.number).map(c=> ({ number: (c.number||'').replace(/\D/g,'').slice(0,16) }));
  const urls = ['/api/cards','/cards','/payment/cards'];
  for (const u of urls){
    try{
      const res = await fetch(u, { method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(payload) });
      if (res.ok) break;
    }catch{}
  }
  try{ localStorage.setItem('cards', JSON.stringify(payload)); }catch{}
}

async function persistTwoFA(enabled){
  const urls = ['/api/security/2fa','/api/2fa','/users/2fa'];
  for (const u of urls){
    try{
      const res = await fetch(u, { method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ enabled: !!enabled }) });
      if (res.ok) break;
    }catch{}
  }
  try{ localStorage.setItem('twofa', JSON.stringify({ enabled: !!enabled })); }catch{}
}

// Password change (separate action)
async function changePasswordRequest(newPassword){
  const urls = ['/api/me/change-password','/api/change-password','/users/me/password'];
  let lastErr = null;
  for (const u of urls){
    try{
      const res = await fetch(u, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        credentials:'include',
        body: JSON.stringify({ new_password: newPassword })
      });
      if (res.ok) return { ok:true };
      const err = await res.json().catch(()=>({ message:'Помилка зміни пароля' }));
      lastErr = err?.message || 'Помилка зміни пароля';
    }catch(e){ lastErr = e?.message || 'Помилка мережі'; }
  }
  return { ok:false, message:lastErr || 'Не вдалося змінити пароль' };
}

/* ========================= Page ========================= */
export default function ProfileSettings(){
  const { user: authUser, setUser: setAuthUser } = useAuth() || {};
  const navigate = useNavigate();

  // Back button -> /profile (or history.back if no router)
  const goBack = () => {
    try { navigate('/profile'); }
    catch { window.history.back(); }
  };

  // State for name/email
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(()=>{
    if (authUser){
      const first = authUser.first_name || authUser.firstName;
      const last  = authUser.last_name || authUser.lastName;
      const nm = [first,last].filter(Boolean).join(' ').trim();
      if (nm) setName(nm);
      if (authUser.email) setEmail(authUser.email);
    }
  }, [authUser]);

  useEffect(()=>{
    let cancelled = false;
    (async () => {
      if (!name || !email){
        const data = await fetchUserProfileFallback();
        if (!cancelled && data){
          const { fullName, email: mail } = extractNameEmail(data);
          if (!name && fullName) setName(fullName);
          if (!email && mail)    setEmail(mail);
        }
      }
    })();
    return ()=>{ cancelled = true; };
  }, [name, email]);

  const [editName, setEditName] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  useEffect(()=>{ if (editName)  nameRef.current?.focus();  },[editName]);
  useEffect(()=>{ if (editEmail) emailRef.current?.focus(); },[editEmail]);

  // 2FA
  const [twofa, setTwofa] = useState(false);

  // Password change UI
  const [showPass, setShowPass] = useState(false);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [passErr, setPassErr] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const p1Ref = useRef(null);
  useEffect(()=>{ if (showPass) p1Ref.current?.focus(); }, [showPass]);

  // Addresses — add empty
  const [addresses, setAddresses] = useState([]);
  const addAddress = () => setAddresses(prev => prev.length < 2 ? [...prev, { label:'', address:'' }] : prev);
  const saveAddress = (idx, payload) => setAddresses(prev => prev.map((a,i)=> i===idx ? { ...a, ...payload } : a));

  // Cards
  const [cards, setCards] = useState([]);
  const addCard = () => setCards(prev => prev.length < 3 ? [...prev, { number:'' }] : prev);
  const saveCard = (idx, val) => setCards(prev => prev.map((c,i)=> i===idx ? { ...c, number:val } : c));
  const cardsAddTop = useMemo(()=> (cards.length ? cards.length*65 + 20 : 90), [cards.length]);
  // ===== Initial load for addresses, cards and 2FA =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // small helper to try a list of endpoints
      const fetchList = async (urls) => {
        for (const u of urls) {
          try {
            const r = await fetch(u, { credentials: 'include' });
            if (r.ok) return await r.json();
          } catch {}
        }
        return null;
      };

      // Try API first
      let addr = await fetchList(['/api/addresses','/addresses','/user/addresses']);
      let crds = await fetchList(['/api/cards','/cards','/payment/cards']);
      let tf   = await fetchList(['/api/security/2fa','/api/2fa','/users/2fa']);

      // Fallback to localStorage
      try { if (!addr) addr = JSON.parse(localStorage.getItem('addresses') || 'null'); } catch {}
      try { if (!crds) crds = JSON.parse(localStorage.getItem('cards') || 'null'); } catch {}
      try { if (!tf)   tf   = JSON.parse(localStorage.getItem('twofa') || 'null'); } catch {}

      if (cancelled) return;

      if (Array.isArray(addr)) {
        setAddresses(addr.map(a => ({ label: a.label || '', address: a.address || '' })));
      }
      if (Array.isArray(crds)) {
        setCards(crds.map(c => ({ number: (c.number || '').replace(/\D/g,'').slice(0,16) })));
      }
      if (tf && typeof tf === 'object') {
        const en = (tf.enabled != null ? !!tf.enabled : !!tf.isEnabled || !!tf.on);
        setTwofa(en);
      }
    })();
    return () => { cancelled = true; };
  }, []);


  // explicit save state
  const [saving, setSaving] = useState(false);
  const handleSaveAll = async () => {
    setSaving(true);
    try{
      const parts = splitName(name||'');
      const profileUpdate = { first_name: parts.first, last_name: parts.last, email: (email||'').trim() };
      await Promise.all([
        persistProfile(profileUpdate),
        persistTwoFA(twofa),
        persistAddresses(addresses),
        persistCards(cards)
      ]);
      try{
        setAuthUser?.((prev)=> ({ ...(prev||{}), ...profileUpdate }));
      }catch{}
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    const a = (p1||'').trim();
    const b = (p2||'').trim();
    if (a.length < 6){
      setPassErr('Мінімум 6 символів');
      return;
    }
    if (a !== b){
      setPassErr('Паролі не співпадають');
      return;
    }
    setPassErr('');
    setPassBusy(true);
    const res = await changePasswordRequest(a);
    setPassBusy(false);
    if (!res.ok){
      setPassErr(res.message || 'Не вдалося змінити пароль');
      return;
    }
    // success
    setP1('');
    setP2('');
    setShowPass(false);
    alert('Пароль успішно змінено');
  };

  return (
    <div className="ps-root">
      {/* Header */}
      <div className="order-header">
        <button
          className="order-header__icon"
          type="button"
          aria-label="Повернутися до профілю"
          onClick={goBack}
          onKeyDown={(e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); goBack(); } }}
        >
          <img src={planexPng} alt="" width="30" height="29" draggable="false"/>
        </button>
        <h4 className="order-header__title">Редагування профілю</h4>
      </div>

      {/* Name */}
      <div className="inline-field field-city">
        <div className="inline-field__frame"></div>
        {!editName ? (
          <>
            <span className="inline-field__value">{name}</span>
            <button className="inline-field__edit" type="button" aria-label="Редагувати" onClick={()=>setEditName(true)}>
              <img src={editPng} alt="" width="29" height="29" draggable="false"/>
            </button>
          </>
        ) : (
          <input
            ref={nameRef}
            className="inline-field__input"
            defaultValue={name}
            onBlur={(e)=>{ const nm = e.target.value.trim() || name; setName(nm); setEditName(false); }}
            onKeyDown={(e)=>{ if(e.key==='Enter') e.currentTarget.blur(); if(e.key==='Escape') setEditName(false); }}
          />
        )}
      </div>

      {/* Email */}
      <div className="inline-field field-name">
        <div className="inline-field__frame"></div>
        {!editEmail ? (
          <>
            <span className="inline-field__value">{email}</span>
            <button className="inline-field__edit" type="button" aria-label="Редагувати" onClick={()=>setEditEmail(true)}>
              <img src={editPng} alt="" width="29" height="29" draggable="false"/>
            </button>
          </>
        ) : (
          <input
            ref={emailRef}
            className="inline-field__input"
            defaultValue={email}
            onBlur={(e)=>{ setEmail(e.target.value.trim() || email); setEditEmail(false); }}
            onKeyDown={(e)=>{ if(e.key==='Enter') e.currentTarget.blur(); if(e.key==='Escape') setEditEmail(false); }}
          />
        )}
      </div>

      {/* Security widgets (2FA + Password) */}
      <section className="security-widgets" aria-label="Налаштування безпеки">
        <div className="twofa" role="group" aria-label="Двофакторна автентифікація">
          <span className="twofa__label">Двофакторна автентифікація</span>
          <button
            className={`twofa__toggle${twofa ? ' is-on' : ''}`}
            type="button"
            aria-pressed={twofa ? 'true' : 'false'}
            onClick={()=>setTwofa(v=>!v)}
          />
        </div>

        <button
          className="btn-change-pass"
          type="button"
          onClick={()=> setShowPass(v => !v)}
          aria-expanded={showPass ? 'true' : 'false'}
          aria-controls="pass-panel"
        >
          <span className="btn-change-pass__text">{showPass ? 'Сховати' : 'Змінити пароль'}</span>
          <img className="btn-change-pass__icon" src={settingsPng} alt="" width="27" height="27" draggable="false"/>
        </button>

        {/* Slide-down panel */}
        <div id="pass-panel" className={`pass-panel${showPass ? ' is-open' : ''}`} aria-hidden={showPass ? 'false' : 'true'}>
          <div className={`pass-field ${passErr ? 'is-error' : ''}`}>
            <div className="pass-field__frame"></div>
            <input
              ref={p1Ref}
              type="password"
              className="pass-field__input"
              placeholder="Новий пароль"
              value={p1}
              onChange={(e)=> setP1(e.target.value)}
              onKeyDown={(e)=>{ if (e.key==='Enter') { document.getElementById('pass2')?.focus(); } }}
            />
          </div>

          <div className={`pass-field pass-field--second ${passErr ? 'is-error' : ''}`}>
            <div className="pass-field__frame"></div>
            <input
              id="pass2"
              type="password"
              className="pass-field__input"
              placeholder="Повторіть пароль"
              value={p2}
              onChange={(e)=> setP2(e.target.value)}
              onKeyDown={(e)=>{ if (e.key==='Enter') handlePasswordSave(); }}
            />
            {passErr && <div className="pass-field__hint" role="alert">{passErr}</div>}
          </div>

          <button
            className="btn-pass-save"
            type="button"
            onClick={handlePasswordSave}
            disabled={passBusy}
          >
            {passBusy ? 'Збереження...' : 'Зберегти пароль'}
          </button>
        </div>

        {/* SINGLE SAVE BUTTON FOR THE WHOLE PAGE */}
        <button className="btn-save" type="button" onClick={handleSaveAll} disabled={saving}>
          <span className="btn-save__text">{saving ? "Збереження..." : "Зберегти всі зміни"}</span>
        </button>
      </section>

      {/* Headings */}
      <h2 className="h4-green heading--delivery">Адреси доставки</h2>
      <h2 className="h4-green heading--cards">Мої карти</h2>

      {/* Addresses */}
      <section className="addresses" aria-labelledby="addresses-title">
        <h2 id="addresses-title" className="visually-hidden">Адреси</h2>
        <div className="addresses__list" aria-live="polite">
          {addresses.map((row,i)=> (
            <AddressRow key={i} index={i} labelDefault={row.label} valueDefault={row.address} onSave={(p)=>saveAddress(i,p)} />
          ))}
        </div>
        <button className="addresses__add" type="button" onClick={addAddress} disabled={addresses.length>=2}>
          <span className="addresses__add-text">Додати адресу</span>
          <img className="addresses__add-icon" src={plusPng} alt="" width="34" height="34" draggable="false"/>
        </button>
      </section>

      {/* Cards */}
      <section className="cards" aria-labelledby="cards-title">
        <h2 id="cards-title" className="visually-hidden">Банківські карти</h2>
        <div className="cards__list" aria-live="polite">
          {cards.map((c,i)=> (
            <CardRow key={i} index={i} valueDefault={c.number} onSave={(v)=>saveCard(i,v)} />
          ))}
        </div>
        <button className="cards__add" type="button" onClick={addCard} disabled={cards.length>=3} style={{ top: cardsAddTop }}>
          <span className="cards__add-text">Додати карту</span>
          <img className="cards__add-icon" src={plusPng} alt="" width="34" height="34" draggable="false"/>
        </button>
      </section>

      {/* Promo */}
      <section className="promo-banner" aria-labelledby="promo-banner-title">
        <div className="promo-banner__frame"></div>
        <h3 id="promo-banner-title" className="promo-banner__title">
          Відкрийте свій магазин та почніть свої перші продажі!
        </h3>
        <button className="promo-banner__cta" type="button">
          <span className="promo-banner__cta-text">Стати продавцем</span>
          <img className="promo-banner__cta-icon" src={planePng} alt="" width="23" height="22" draggable="false"/>
        </button>
        <div className="promo-banner__art">
          <img className="promo-banner__img" src={completePng} alt=""/>
        </div>
      </section>
    </div>
  );
}

/* ========================= Subcomponents ========================= */
function CardRow({ index, valueDefault, onSave }){
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(valueDefault || '');
  const ref = useRef(null);
  useEffect(()=>{ if (editing) ref.current?.focus(); },[editing]);
  const top = index * 65;

  const handleSave = () => {
    const clean = (val || '').replace(/\D/g,'').slice(0,16);
    if (clean.length && !luhnCheck(clean)){
      const root = ref.current?.closest('.card-row');
      root?.classList.add('is-error');
      return;
    }
    ref.current?.closest('.card-row')?.classList.remove('is-error');
    setEditing(false);
    onSave(clean);
  };

  return (
    <div className="card-row" data-index={index} style={{ top }}>
      <div className="card-row__label"></div>
      <div className="card-row__label-text">{`Карта ${index+1}`}</div>
      <div className="card-row__field"></div>

      {!editing ? (
        <span className="card-row__value">{val}</span>
      ) : (
        <input
          ref={ref}
          className="card-row__input"
          maxLength={16}
          inputMode="numeric"
          value={val}
          onChange={(e)=> setVal(e.target.value.replace(/\D/g,'').slice(0,16)) }
          onKeyDown={(e)=>{ if (e.key==='Enter') handleSave(); if (e.key==='Escape') setEditing(false); }}
        />
      )}

      <button className="card-row__edit" type="button" aria-label="Редагувати" onClick={()=>setEditing(true)}>
        <img src={editPng} alt="" width="29" height="29" draggable="false"/>
      </button>
    </div>
  );
}

function AddressRow({ index, labelDefault='', valueDefault='', onSave }){
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(labelDefault || '');
  const [addr, setAddr] = useState(valueDefault || '');
  const labRef = useRef(null);
  const addrRef = useRef(null);
  useEffect(()=>{ if (editing){ (labRef.current||addrRef.current)?.focus(); } },[editing]);
  const isFirst = index === 0;
  const top = index * 65;

  const save = () => { setEditing(false); onSave({ label: label.trim(), address: addr.trim() }); };

  return (
    <div className="addr-row" data-index={index} style={{ top }}>
      <div className={`addr-row__label ${isFirst ? 'addr-row__label--w77' : 'addr-row__label--w93'}`}></div>
      {!editing && (
        <div className="addr-row__label-text" onClick={()=>setEditing(true)}>{label}</div>
      )}
      <div className={`addr-row__field ${isFirst ? 'addr-row__field--r1' : 'addr-row__field--r2'}`}></div>

      {!editing ? (
        <span className="addr-row__value" onClick={()=>setEditing(true)}>{addr}</span>
      ) : (
        <>
          <input
            ref={labRef}
            className={`addr-row__input-label ${isFirst ? 'addr-row__input-label--w77' : 'addr-row__input-label--w93'}`}
            type="text"
            maxLength={20}
            value={label}
            onChange={(e)=>setLabel(e.target.value)}
            onKeyDown={(e)=>{ if(e.key==='Enter'){ addrRef.current?.focus(); } if(e.key==='Escape') setEditing(false); } }
          />
          <input
            ref={addrRef}
            className={`addr-row__input ${isFirst ? 'addr-row__input--r1' : 'addr-row__input--r2'}`}
            type="text"
            maxLength={120}
            value={addr}
            onChange={(e)=>setAddr(e.target.value)}
            onBlur={save}
            onKeyDown={(e)=>{ if(e.key==='Enter'){ save(); } if(e.key==='Escape'){ setEditing(false);} }}
          />
        </>
      )}

      <button className="addr-row__edit" type="button" aria-label="Редагувати" onClick={()=>setEditing(true)}>
        <img src={editPng} alt="" width="29" height="29" draggable="false"/>
      </button>
    </div>
  );
}
