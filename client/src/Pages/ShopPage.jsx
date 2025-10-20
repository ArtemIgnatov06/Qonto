import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import "../Styles/ShopPage.css";
import "../Styles/Home.css";

import fruitsBanner from "../assets/fruits.png";
import starImg from "../assets/star.png";
import chatIcon from "../assets/chat.png";
import igIcon from "../assets/ig.png";
import tkIcon from "../assets/tiktok.png";
import mascotWorktime from "../assets/mascot-worktime.png";
import goodSellerImg from "../assets/good-seller.png";
import * as WL from "../lib/wishlist.js";

const API = process.env.REACT_APP_API || "";

/* helpers */
function resolveUrl(u){
  if (!u) return null;
  try{
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("//")) return window.location.protocol + u;
    if (u.startsWith("/")) return `${API}${u}`;
    return u;
  }catch{ return u; }
}
async function fetchJSON(url, opts){
  const r = await fetch(url, { credentials:"include", ...(opts||{}) });
  const raw = await r.text();
  let data; try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
  if (!r.ok) throw Object.assign(new Error(data?.message || "Request failed"), { status:r.status, data });
  return data;
}
function pick(o, keys){ for (const k of keys){ if (o && o[k] !== undefined) return o[k]; } return ""; }
function getRating(p){ const r = Number(p?.avg_rating ?? p?.ratingAvg ?? p?.rating); return Number.isFinite(r)? Math.max(0, Math.min(5, r)) : null; }
function getPrice(p){ return Number.isFinite(+p.price) ? +p.price : 0; }
function getImage(p){
  const u = p.preview_image_url || p.image_url || (Array.isArray(p.images) && p.images[0]) || (Array.isArray(p.photos) && p.photos[0]) || "/placeholder.svg";
  return resolveUrl(u);
}

async function fetchSellerPublic(id){
  const tries = [`${API}/api/users/${id}/public`, `${API}/api/users/${id}`];
  for (const u of tries){ try{ const d = await fetchJSON(u); return d?.user || d || null; }catch{} }
  return null;
}
async function fetchProductsBySeller(id){
  const tries = [`${API}/api/sellers/${id}/products`, `${API}/api/products?seller=${id}`];
  for (const u of tries){
    try{
      const d = await fetchJSON(u);
      if (Array.isArray(d?.items)) return d.items;
      if (Array.isArray(d)) return d;
    }catch{}
  }
  return [];
}

/* filters */
const CATEGORIES = ["Електричні девайси","Краса та здоров’я","Меблі","Жінкам","Чоловікам","Дітям","Товари для тварин","Спорт"];
function useFilters(items){
  const prices = useMemo(()=>{
    const arr = items.map(getPrice).filter(n=>Number.isFinite(n));
    const min = arr.length? Math.min(...arr) : 0;
    const max = arr.length? Math.max(...arr) : 100000;
    return { min, max };
  },[items]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000);
  useEffect(()=>{ setMinPrice(prices.min); setMaxPrice(prices.max); },[prices.min, prices.max]);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyOutStock, setOnlyOutStock] = useState(false);
  const [promo, setPromo] = useState("any");
  const [selectedCats, setSelectedCats] = useState(new Set());
  const [minRating, setMinRating] = useState(0);
  const [popularHit, setPopularHit] = useState(false);
  const [popularNew, setPopularNew] = useState(false);
  const filtered = useMemo(()=>items.filter(p=>{
    const price = getPrice(p);
    if (price < minPrice || price > maxPrice) return false;
    const qty = Number(p.qty ?? p.quantity ?? 0);
    if (onlyInStock && qty <= 0) return false;
    if (onlyOutStock && qty > 0) return false;
    const isPromo = Boolean(p.is_promo ?? p.promo ?? p.discount);
    if (promo==="yes" && !isPromo) return false;
    if (promo==="no" && isPromo) return false;
    const cat = (p.category || "").toString().trim();
    if (selectedCats.size && !selectedCats.has(cat)) return false;
    const r = getRating(p) ?? 0;
    if (r < minRating) return false;
    if (popularHit) { /* placeholder */ }
    if (popularNew) { /* placeholder */ }
    return true;
  }),[items,minPrice,maxPrice,onlyInStock,onlyOutStock,promo,selectedCats,minRating,popularHit,popularNew]);
  return { prices,minPrice,maxPrice,setMinPrice,setMaxPrice,onlyInStock,setOnlyInStock,onlyOutStock,setOnlyOutStock,promo,setPromo,selectedCats,setSelectedCats,minRating,setMinRating,popularHit,setPopularHit,popularNew,setPopularNew,filtered };
}

export default function ShopPage(){
  const { sellerId } = useParams();
  const nav = useNavigate();
  const [seller, setSeller] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("goods");
  const underlineRef = useRef(null);
  const tabsRef = useRef(null);
  const [favIds, setFavIds] = useState(()=> new Set(WL.getIds()));
  useEffect(()=>{
    const sync = ()=> setFavIds(new Set(WL.getIds()));
    window.addEventListener('wishlist:changed', sync);
    window.addEventListener('storage', sync);
    return ()=>{ window.removeEventListener('wishlist:changed', sync); window.removeEventListener('storage', sync); };
  },[]);
  const [me, setMe] = useState(null);

  useEffect(()=>{
    let ignore=false;
    (async()=>{
      setLoading(true);
      const [s,p,meResp] = await Promise.all([
        fetchSellerPublic(sellerId),
        fetchProductsBySeller(sellerId),
        fetchJSON(`${API}/api/me`).catch(()=>({user:null}))
      ]);
      if (ignore) return;
      setSeller(s);
      setItems(p);
      setMe(meResp?.user || null);
      setLoading(false);
      positionUnderline("goods");
    })();
    return ()=>{ ignore=true; };
  },[sellerId]);

  const storeTitle = useMemo(()=>{
    const fn = pick(seller, ["first_name","firstName"]);
    const ln = pick(seller, ["last_name","lastName"]);
    return (`${ln||""} ${fn||""}`.trim()) || seller?.username || "Магазин продавця";
  },[seller]);

  const aboutText = useMemo(()=> (seller?.bio || seller?.about || "Опис продавця поки відсутній."), [seller]);

  const storeRating = useMemo(()=>{
    if (!items.length) return 0;
    const arr = items.map(getRating).filter(v => v !== null);
    if (!arr.length) return 0;
    const avg = arr.reduce((a,b)=>a+b,0)/arr.length;
    return Math.round(avg*10)/10;
  },[items]);

  const ratingDist = useMemo(()=>{
    const dist = {1:0,2:0,3:0,4:0,5:0};
    for (const it of items){
      const r = Math.round(getRating(it) ?? 0);
      if (r>=1 && r<=5) dist[r]++;
    }
    return dist;
  },[items]);

  function positionUnderline(which){
    const tabs = tabsRef.current, u = underlineRef.current;
    if (!tabs || !u) return;
    const el = tabs.querySelector(`[data-tab="${which}"]`);
    if (!el) return;
    const wrapRect = tabs.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    u.style.left = (rect.left - wrapRect.left) + "px";
    u.style.width = rect.width + "px";
  }
  useEffect(()=>{ positionUnderline(tab); },[tab]);

  async function startChat(){
    if (me?.id && Number(me.id) === Number(sellerId)) { nav('/chats'); return; }
    try{
      const r = await fetch(`${API}/api/chats/start`, {
        method:"POST", headers:{ "Content-Type":"application/json" }, credentials:"include",
        body: JSON.stringify({ seller_id: Number(sellerId) })
      });
      const data = await r.json().catch(()=>({}));
      if (r.ok && data?.id) { nav(`/chats/${data.id}`); return; }
      if (!r.ok && data?.message) alert(data.message);
      nav('/chats');
    }catch{ nav('/chats'); }
  }

  // filters
  const f = useFilters(items);
  const list = f.filtered;

  const sinceText = useMemo(()=>{
    const d = seller?.created_at || seller?.createdAt || seller?.registered_at || seller?.registeredAt;
    if (!d) return null;
    try{
      const dt = new Date(d);
      return new Intl.DateTimeFormat('uk-UA', { day:'numeric', month:'long', year:'numeric' }).format(dt);
    }catch{ return null; }
  },[seller]);

  // hide right sidebar when not on goods tab
  const showGoods = tab === "goods";

  return (
    <main className="shop-page">
      {/* breadcrumbs */}
      <nav className="breadcrumbs" aria-label="Категорії">
        <Link to="/catalog">Продукти та алкоголь</Link>
        <img className="arrow" src={require("../assets/arrow-green.png")} alt="" />
        <Link to="/catalog/dry">Сухофрукти</Link>
        <img className="arrow" src={require("../assets/arrow-green.png")} alt="" />
        <span>Бананові чіпси</span>
      </nav>

      {/* hero */}
      <section className="shop-hero">
        <img className="hero-img" src={fruitsBanner} alt="" />
        <div className="hero-meta">
          <div className="seller-badge">Продавець</div>
          <h1 className="store-title">{storeTitle}</h1>

          <div className="rating-line">
            <img src={starImg} width="26" height="26" alt="" />
            <span className="num">{storeRating.toFixed(1)}</span>
            <span className="dot" />
            <span className="count">0 відгуків</span>
          </div>

          <div className="tabbar" ref={tabsRef}>
            <button className={`tab ${tab==="goods"?"is-active":""}`} data-tab="goods" onClick={()=>setTab("goods")}>Товари</button>
            <button className={`tab ${tab==="about"?"is-active":""}`} data-tab="about" onClick={()=>setTab("about")}>Про продавця</button>
            <button className={`tab ${tab==="reviews"?"is-active":""}`} data-tab="reviews" onClick={()=>setTab("reviews")}>Відгуки</button>
            <span ref={underlineRef} className="tab-underline" aria-hidden="true"></span>
          </div>

          {/* Описание под вкладкой "Про продавця" */}
          {tab === "about" && (
            <p className="about-text under-tabs">{aboutText}</p>
          )}
        </div>

        <button className="contact-btn" type="button" onClick={startChat}>
          <img src={chatIcon} width="20" height="20" alt="" />
          Написати продавцю
        </button>
      </section>

      {/* body */}
      <section className="shop-body" data-tab={tab}>
        {/* LEFT: grid / tabs */}
        <div>
          {/* GOODS TAB */}
          {showGoods && (
            <div className="panel is-visible">
              {loading && <p>Завантаження…</p>}
              {!loading && (
                <div
                  className="products-grid products-grid-4"
                  style={{ display:'grid', gridTemplateColumns:'repeat(4, 268px)', columnGap:16, rowGap:16, justifyContent:'center' }}
                >
                  {list.map(p => {
                    const id = p.id || p._id;
                    const price = getPrice(p);
                    const rating = getRating(p);
                    const isFav = favIds.has(id);
                    const img = getImage(p);

                    return (
                      <div className="pcard" key={id} style={{ position:'relative' }}>
                        <Link to={`/product/${id}`} className="pcard-link" />

                        <div className="pcard-photo">
                          <div className="pcard-photo-bg" />
                          <img
                            className="pcard-img"
                            src={img}
                            alt={p.title || 'Товар'}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e)=>{e.currentTarget.onerror=null; e.currentTarget.src="/placeholder.svg";}}
                          />
                        </div>

                        <span className="pcard-frame" aria-hidden="true" />

                        <div className="pcard-title" title={p.title}>{p.title}</div>

                        {/* rating below title */}
                        {rating !== null && (
                          <div className="pcard-rating-row">
                            <img src={starImg} width="16" height="16" alt="" />
                            <span className="pcard-rating-val">{rating.toFixed(1)}</span>
                          </div>
                        )}

                        <div className="pcard-price">
                          <span className="pcard-price-now">{price.toLocaleString("uk-UA")} грн</span>

                          {/* wishlist */}
                          <button
                            type="button"
                            className="pcard-btn pcard-btn--ghost"
                            title="В обране"
                            aria-label="В обране"
                            onClick={(e) => { e.preventDefault(); WL.toggle({ id, title: p.title, preview_image_url: img, price }); }}
                          >
                            <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path
                                d="M15.2246 1.25C18.019 1.25 20.2498 3.515 20.25 6.49414C20.25 8.31105 19.4674 10.0195 17.9502 11.9463C16.4239 13.8846 14.2268 15.9572 11.5088 18.5156L11.5078 18.5166L10.5 19.4688L9.49219 18.5166L9.49121 18.5156L7.55273 16.6816C5.71675 14.9287 4.19444 13.3999 3.0498 11.9463C1.53256 10.0195 0.75 8.31105 0.75 6.49414C0.750204 3.515 2.98099 1.25 5.77539 1.25C7.36492 1.25013 8.91095 2.02247 9.92188 3.24512L10.5 3.94434L11.0781 3.24512C12.0891 2.02247 13.6351 1.25013 15.2246 1.25Z"
                                stroke={isFav ? '#35C65E' : '#363535'}
                                strokeWidth="1.5"
                                fill={isFav ? '#35C65E' : 'none'}
                              />
                            </svg>
                          </button>

                          {/* cart button -> go to product */}
                          <button
                            type="button"
                            className="pcard-btn pcard-btn--green"
                            title="У кошик"
                            aria-label="У кошик"
                            onClick={(e)=>{ e.preventDefault(); nav(`/product/${id}`); }}
                          >
                            <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M0 0.5V2.5H2L5.6 10.09L4.24 12.54C4.09 12.82 4 13.15 4 13.5C4 14.0304 4.21071 14.5391 4.58579 14.9142C4.96086 15.2893 5.46957 15.5 6 15.5H18V13.5H6.42C6.3537 13.5 6.29011 13.4737 6.24322 13.4268C6.19634 13.3799 6.17 13.3163 6.17 13.25C6.17 13.2 6.18 13.16 6.2 13.13L7.1 11.5H14.55C15.3 11.5 15.96 11.08 16.3 10.47L19.88 4C19.95 3.84 20 3.67 20 3.5C20 3.23478 19.8946 2.98043 19.7071 2.79289C19.5196 2.60536 19.2652 2.5 19 2.5H4.21L3.27 0.5H0Z" fill="#35C65E"/>
                              <circle cx="6" cy="18.5" r="2" fill="#35C65E"/>
                              <circle cx="16" cy="18.5" r="2" fill="#35C65E"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABOUT TAB */}
          {tab === "about" && (
            <div className="panel is-visible">
              <div className="about-grid">
                {/* WORKTIME — big */}
                <div className="card work">
                  <div className="sch-title">Графік роботи продавця</div>
                  <div className="sch-content">
                    <div className="sch-times">
                      <div>Пн–Пт <strong>09:00–19:00</strong></div>
                      <div>Сб–Нд <strong>вихідні</strong></div>
                    </div>
                    <img className="sch-mascot" src={mascotWorktime} alt="" />
                  </div>
                </div>

                {/* RATING — big */}
                <div className="card rating">
                  <div className="sr h-300">
                    <h3 className="sr-title">Рейтинг продавця</h3>
                    <div className="sr-wrap">
                      <div>
                        <div className="sr-avg">
                          <img src={starImg} width="46" height="46" alt="" />
                          <div className="val">{storeRating.toFixed(1)}</div>
                        </div>
                        <div className="sr-stars">
                          {[1,2,3,4,5].map(i => <img key={i} src={starImg} alt="" />)}
                        </div>
                      </div>
                      <div className="sr-bars">
                        {[5,4,3,2,1].map(n=>{
                          const total = Object.values(ratingDist).reduce((a,b)=>a+b,0) || 1;
                          const pct = Math.round((ratingDist[n] / total) * 100);
                          return (
                            <div className="sr-row" key={n}>
                              <div>{n}</div>
                              <div className="sr-track" style={{'--w': pct+'%'}}></div>
                              <div className="sr-count">{ratingDist[n].toLocaleString("uk-UA")}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SINCE — small, no image */}
                <div className="card since">
                  <div className="since-row">
                    <div className="since-label">З нами з</div>
                    <div className="since-date">{sinceText || "—"}</div>
                  </div>
                </div>

                {/* TRUSTED — small with picture */}
                <div className="card trusted">
                  <div className="trust-row">
                    <div className="trust-badge">Надійний продавець</div>
                    <img className="good-seller-img" src={goodSellerImg} alt="" />
                  </div>
                </div>

                {/* SOCIALS — small */}
                <div className="card socials">
                  <div className="social-title">Соціальні мережі продавця</div>
                  <div className="social-row">
                    <a className="social-icon" href={seller?.social?.instagram || '#'} target="_blank" rel="noreferrer">
                      <img src={igIcon} alt="Instagram" />
                    </a>
                    <a className="social-icon" href={seller?.social?.tiktok || '#'} target="_blank" rel="noreferrer">
                      <img src={tkIcon} alt="TikTok" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* REVIEWS TAB */}
          {tab === "reviews" && (
            <div className="panel is-visible">
              <p>Відгуки магазину поки що порожні.</p>
            </div>
          )}
        </div>

        {/* RIGHT: filter box — показываем только на вкладке Товари */}
        {showGoods && (
          <aside className="shop-filter-full">
            <div className="flt-group">
              <div className="flt-title">Ціна</div>
              <input
                type="range"
                min={f.prices.min} max={f.prices.max}
                value={Math.min(f.maxPrice, f.prices.max)}
                onChange={e=>f.setMaxPrice(Number(e.target.value))}
                className="flt-range"
              />
              <div className="flt-price-row">
                <label>від <input type="number" value={f.minPrice} onChange={e=>f.setMinPrice(Number(e.target.value||0))} /></label>
                <label>до <input type="number" value={f.maxPrice} onChange={e=>f.setMaxPrice(Number(e.target.value||0))} /></label>
              </div>
            </div>

            <div className="flt-group">
              <div className="flt-title">Наявність</div>
              <label className="chk"><input type="checkbox" checked={f.onlyInStock} onChange={e=>f.setOnlyInStock(e.target.checked)} /> В наявності</label>
              <label className="chk"><input type="checkbox" checked={f.onlyOutStock} onChange={e=>f.setOnlyOutStock(e.target.checked)} /> Немає в наявності</label>
            </div>

            <div className="flt-group">
              <div className="flt-title">Акційний товар</div>
              <label className="rad"><input type="radio" name="promo" checked={f.promo==='yes'} onChange={()=>f.setPromo('yes')} /> Так</label>
              <label className="rad"><input type="radio" name="promo" checked={f.promo==='no'} onChange={()=>f.setPromo('no')} /> Ні</label>
              <label className="rad"><input type="radio" name="promo" checked={f.promo==='any'} onChange={()=>f.setPromo('any')} /> Будь-який</label>
            </div>

            <div className="flt-group">
              <div className="flt-title">Категорія товарів</div>
              {CATEGORIES.map(c => (
                <label key={c} className="chk">
                  <input
                    type="checkbox"
                    checked={f.selectedCats.has(c)}
                    onChange={(e)=>{
                      const next = new Set(f.selectedCats);
                      if (e.target.checked) next.add(c); else next.delete(c);
                      f.setSelectedCats(next);
                    }}
                  /> {c}
                </label>
              ))}
            </div>

            <div className="flt-group">
              <div className="flt-title">Рейтинг</div>
              <div className="flt-stars">
                {[1,2,3,4,5].map(n => (
                  <button key={n} className={`flt-star ${f.minRating>=n?'on':''}`} onClick={()=>f.setMinRating(n)} aria-label={`мінімум ${n} зірок`} type="button">
                    <img src={starImg} alt="" width="18" height="18" />
                  </button>
                ))}
                {f.minRating>0 && <button className="flt-clear" onClick={()=>f.setMinRating(0)} type="button">скинути</button>}
              </div>
            </div>

            <div className="flt-group">
              <div className="flt-title">Популярність</div>
              <label className="chk"><input type="checkbox" checked={f.popularHit} onChange={e=>f.setPopularHit(e.target.checked)} /> Хіт продажів</label>
              <label className="chk"><input type="checkbox" checked={f.popularNew} onChange={e=>f.setPopularNew(e.target.checked)} /> Новинка</label>
            </div>
          </aside>
        )}
      </section>
    </main>
  );
}
