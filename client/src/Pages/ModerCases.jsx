// client/src/Pages/ModerCases.jsx
import React, { useEffect, useState } from 'react';
import '../Styles/ModerCases.css';
import { useNavigate, useSearchParams } from 'react-router-dom';

import backArrow from '../assets/planex.png';
import checkoutTick from '../assets/checkout-tick.png';

function Avatar({ src, name='' }){
  if (src) return <img className="case-ava" src={src} alt="" />;
  const initials = (name||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('') || '??';
  return <span className="case-ava case-ava--ph">{initials}</span>;
}

function CaseRow({ item, kind, onOpen }){
  const title = kind==='request'
    ? `Від ${item.user_name||'Користувач'} надійшла заявка на створення магазину “${item.store_name||'Без назви'}”. Перевірте, будь ласка.`
    : `Прийшла скарга на товар магазину “${item.store_name||'Без назви'}”. Перевірте, будь ласка.`;
  return (
    <li className="case-row">
      <div className="case-card">
        <Avatar src={item.avatar_url} name={item.user_name} />
        <p className="case-text" title={title}>{title}</p>
        <button type="button" className="case-cta" onClick={()=> onOpen(item)}>
          <img className="case-cta-ico" src={checkoutTick} alt="" aria-hidden="true" />
          <span>Перевірити</span>
        </button>
      </div>
    </li>
  );
}

export default function ModerCases(){
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTab = (params.get('tab') === 'complaints') ? 'complaints' : 'requests';

  const [tab, setTab] = useState(initialTab); // 'requests' | 'complaints'
  const [requests, setRequests] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    let stop=false;
    (async ()=>{
      setLoading(true);
      try{
        const [r1, r2] = await Promise.all([
          fetch('/api/moder/cases/requests?limit=20', { credentials:'include' }),
          fetch('/api/moder/cases/complaints?limit=20', { credentials:'include' })
        ]);
        if (!stop){
          if (r1.ok){ const j = await r1.json(); setRequests(Array.isArray(j)?j:(j.items||[])); }
          if (r2.ok){ const j = await r2.json(); setComplaints(Array.isArray(j)?j:(j.items||[])); }
        }
      }catch{/* ignore */}
      finally{ if(!stop) setLoading(false); }
    })();
    return ()=>{ stop=true; };
  },[]);

  const list = tab==='requests' ? requests : complaints;

  const openDetails = (item) => {
    const type = tab === 'requests' ? 'request' : 'complaint';
    navigate(`/moder/cases/${item.id}?type=${type}`, {
      state: {
        avatar_url: item.avatar_url || null,
        user_name:  item.user_name  || item.username || null,
        first_name: item.first_name || null,
        last_name:  item.last_name  || null,
        full_name:  item.full_name  || null,
      }
    });
  };

  return (
    <main className="cases-page" role="main">
      <div className="cases-head">
        <button className="head-left-btn" type="button" onClick={()=> navigate(-1)}>
          <img className="head-left-btn__ico" src={backArrow} alt="" aria-hidden="true" />
          <span className="head-left-btn__title">Заявки та скарги</span>
        </button>
      </div>

      <div className="tabs">
        <button className={'tab' + (tab==='requests' ? ' is-active' : '')} onClick={()=> setTab('requests')} type="button">Заявки</button>
        <button className={'tab' + (tab==='complaints' ? ' is-active' : '')} onClick={()=> setTab('complaints')} type="button">Скарги</button>
      </div>

      <ul className="case-list" aria-busy={loading?'true':'false'}>
        {list.map((it)=> (
          <CaseRow
            key={`${tab}-${it.id}`}
            item={it}
            kind={tab==='requests' ? 'request' : 'complaint'}
            onOpen={openDetails}
          />
        ))}
        {!loading && list.length===0 && <li className="empty">Поки порожньо</li>}
      </ul>
    </main>
  );
}