// client/src/Pages/ModerNotifications.jsx
import React, { useEffect, useMemo, useState } from 'react';
import '../Styles/ModerNotifications.css';
import { useNavigate } from 'react-router-dom';

import backArrow from '../assets/planex.png';
import sortArrows from '../assets/firstly-newer.png';
import ghostGreen from '../assets/notification-green.png';
import ghostRed from '../assets/notification-red.png';

export default function ModerNotifications(){
  const navigate = useNavigate();
  const [summary, setSummary] = useState({ complaints:0, shop_requests:0, lastTimes:{} });
  const [sortMode, setSortMode] = useState('new');
  const [allRead, setAllRead] = useState(false);

  useEffect(()=>{
    let stop=false;
    (async ()=>{
      try{
        const r = await fetch('/api/moder/notifications/summary', { credentials:'include' });
        if (r.ok){
          const j = await r.json();
          if (!stop) setSummary({
            complaints: Number(j?.complaints||0),
            shop_requests: Number(j?.shop_requests||0),
            lastTimes: j?.lastTimes || {}
          });
        }
      }catch{/* ignore */}
    })();
    return ()=>{ stop=true; };
  },[]);

  const items = useMemo(()=>{
    const list = [
      { id:'complaints', icon:ghostRed,  text:`На сьогодні скопилось ${summary.complaints} скарг на товар продавців, час розглянути їх!`, date:summary.lastTimes?.complaints, count:summary.complaints },
      { id:'requests',   icon:ghostGreen,text:`На сьогодні скопилось ${summary.shop_requests} заяв на відкриття магазину, час перевірити їх!`, date:summary.lastTimes?.shop_requests, count:summary.shop_requests },
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

  return (
    <main className="modn-page" role="main">
      <div className="modn-head">
        {/* Вся зона стрелка+заголовок — одна прозрачная кнопка */}
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
              <button type="button" className={'notif' + (allRead ? ' is-read' : '')}>
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
