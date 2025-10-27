// client/src/Pages/ModerNotifications.jsx
import React, { useEffect, useMemo, useState } from 'react';
import '../Styles/ModerNotifications.css';
import { useNavigate } from 'react-router-dom';

import backArrow from '../assets/planex.png';
import sortArrows from '../assets/firstly-newer.png';
import ghostGreen from '../assets/notification-green.png';
import ghostRed from '../assets/notification-red.png';

/** Try to resolve "count" and "last date" from various API shapes */
const extractListSummary = (payload) => {
  if (!payload) return { count: 0, last: null };
  // common shapes: {items:[...], total}, {items:[...]}, array
  const items = Array.isArray(payload) ? payload
              : Array.isArray(payload.items) ? payload.items
              : Array.isArray(payload.data) ? payload.data
              : Array.isArray(payload.results) ? payload.results
              : [];
  const count =
    Number(payload.total ?? payload.count ?? payload.itemsCount ?? items.length ?? 0);
  // last item date
  const first = items[0] || null;
  const last =
    first?.created_at || first?.createdAt || first?.date || first?.created || null;
  return { count, last };
};

export default function ModerNotifications(){
  const navigate = useNavigate();
  const [summary, setSummary] = useState({ complaints:0, requests:0, lastC:null, lastR:null });
  const [sortMode, setSortMode] = useState('new');
  const [allRead, setAllRead] = useState(false);

  useEffect(()=>{
    let stop=false;
    (async ()=>{
      // 1) Primary: compute from cases endpoints (robust even if /summary breaks)
      try{
        const [rReq, rCom] = await Promise.all([
          fetch('/api/moder/cases/requests?limit=1', { credentials:'include' }),
          fetch('/api/moder/cases/complaints?limit=1', { credentials:'include' }),
        ]);
        let req = { count:0, last:null }, com = { count:0, last:null };

        if (rReq.ok){ const j = await rReq.json(); req = extractListSummary(j); }
        if (rCom.ok){ const j = await rCom.json(); com = extractListSummary(j); }

        // If API doesn't expose total, fallback to fetch more and count length.
        if (!req.count){
          try{
            const rr = await fetch('/api/moder/cases/requests', { credentials:'include' });
            if (rr.ok){ req = extractListSummary(await rr.json()); }
          }catch{}
        }
        if (!com.count){
          try{
            const rr = await fetch('/api/moder/cases/complaints', { credentials:'include' });
            if (rr.ok){ com = extractListSummary(await rr.json()); }
          }catch{}
        }

        if (!stop){
          setSummary({ complaints: com.count, requests: req.count, lastC: com.last, lastR: req.last });
        }
      }catch{/* ignore */}

      // 2) Secondary: if both still zero, try legacy summary endpoint
      try{
        const r = await fetch('/api/moder/notifications/summary', { credentials:'include' });
        if (r.ok){
          const j = await r.json();
          const complaints = Number(j?.complaints||0);
          const requests   = Number(j?.shop_requests||j?.requests||0);
          if (!stop && (complaints || requests)){
            setSummary(s => ({
              complaints: complaints || s.complaints,
              requests: requests || s.requests,
              lastC: j?.lastTimes?.complaints || s.lastC,
              lastR: j?.lastTimes?.shop_requests || j?.lastTimes?.requests || s.lastR
            }));
          }
        }
      }catch{/* ignore */}
    })();
    return ()=>{ stop=true; };
  },[]);

  const items = useMemo(()=>{
    const list = [
      { id:'complaints', icon:ghostRed,  text:`На сьогодні скопилось ${summary.complaints} скарг на товар продавців, час розглянути їх!`, date:summary.lastC, count:summary.complaints },
      { id:'requests',   icon:ghostGreen,text:`На сьогодні скопилось ${summary.requests} заяв на відкриття магазину, час перевірити їх!`, date:summary.lastR, count:summary.requests },
    ];
    return sortMode==='old' ? list.slice().reverse() : list;
  },[summary, sortMode]);

  const fmtDate = (t)=>{
    if (!t) return '—';
    try{
      const d = new Date(t);
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      return `${dd}.${mm}`;
    }catch{return '—';}
  };

  const openBucket = (id) => {
    // open cases page with proper tab
    const tab = id === 'complaints' ? 'complaints' : 'requests';
    navigate(`/moder/cases?tab=${tab}`);
  };

  return (
    <main className="modn-page" role="main">
      <div className="modn-head">
        <button className="head-left-btn" type="button" onClick={()=> navigate(-1)}>
          <img className="head-left-btn__ico" src={backArrow} alt="" aria-hidden="true" />
          <span className="head-left-btn__title">Повідомлення</span>
        </button>

        <div className="right-tools">
          <button
            className="sort-link"
            type="button"
            onClick={()=> setSortMode(m=> m==='new'?'old':'new')}
            title={sortMode==='new'?'З початку нові':'З початку старі'}
          >
            <img className="sort-link__ico" src={sortArrows} alt="" />
            <span>{sortMode==='new'?'З початку нові':'З початку старі'}</span>
          </button>
          <button className="mark-link" type="button" onClick={()=> setAllRead(true)}>
            Помітити, як прочитане
          </button>
        </div>
      </div>

      <ul className="modn-list">
        {items.map(n=>{
          const text = n.text;
          return (
            <li key={n.id} className="row">
              <button
                type="button"
                className={'notif' + (allRead ? ' is-read' : '')}
                onClick={()=> openBucket(n.id)}
                title="Відкрити список"
              >
                <span className="n-ico"><img src={n.icon} alt="" aria-hidden="true" /></span>
                <span className="n-text" title={text}>{text}</span>
                <time className="n-date">{fmtDate(n.date)}</time>
                {!!n.count && <span className="n-badge">{n.count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}