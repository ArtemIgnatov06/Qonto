// client/src/Pages/SellerApplication.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import '../Styles/SellerApplication.css';

const API = (p) => `http://localhost:5050${p}`;



export default function SellerApplication() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // ---- форма (все шаги вместе)
  const [shopName, setShopName] = useState('');
  const [shopNameOk, setShopNameOk] = useState(false);

  const [addr, setAddr] = useState({ country: '', shipping_address: '', city: '', zip: '' });

  const [regType, setRegType] = useState('company'); // 'company' | 'individual'
  const [docs, setDocs] = useState({
    doc_company_extract_url: '',
    doc_company_itn_url: '',
    doc_individual_passport_url: '',
    doc_individual_itn_url: ''
  });

  const [company, setCompany] = useState({ company_full_name: '', edrpou: '', iban: '' });

  const [cards, setCards] = useState([]);      // [{id,brand,last4,exp_month,exp_year,holder_name}]
  const [newCard, setNewCard] = useState({ number: '', exp: '', cvc: '', holder: '' });
  const [payoutCardId, setPayoutCardId] = useState(null);

  useEffect(() => {
    document.title = t('sellerApply.metaTitle') || 'Реєстрація магазину';
  }, [t]);

  // ---- редиректы по статусам
  if (!user) {
    return <div className="container pad-24-16">{t('auth.required') || 'Потрібно увійти'}</div>;
  }
  if (user.seller_status === 'approved') {
    return (
      <div className="container pad-24-16 ta-center">
        <h2 className="mb-12">{t('sellerApply.alreadySeller') || 'Ви вже продавець'}</h2>
        <button className="btn-login mt-12" onClick={() => navigate('/profile')}>
          {t('sellerApply.backToProfile') || 'До профілю'}
        </button>
      </div>
    );
  }
  if (user.seller_status === 'pending' && step !== 6) {
    return (
      <div className="container pad-24-16 sa-finish">
        <h2 className="mb-16">Ви успішно оформились 🎉</h2>
        <p className="muted-555 mb-20">Наші модератори перевіряють дані. Після перевірки ви отримаєте повідомлення.</p>
        <div className="row gap-12">
          <button className="btn-primary" onClick={() => navigate('/')}>За покупками</button>
          <button className="btn-login btn-grey" onClick={() => navigate('/profile')}>До профілю</button>
        </div>
      </div>
    );
  }
async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch(API('/api/upload'), {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) {
    throw new Error(data?.message || 'Не вдалося завантажити файл');
  }
  return data.url; // этот URL мы кладём в state docs.*
}
  // ========================
  // helpers
  // ========================
  const canGoNext2 = addr.country && addr.shipping_address && addr.city && addr.zip;
  const canGoNext3 = regType === 'company'
    ? docs.doc_company_extract_url && docs.doc_company_itn_url
    : docs.doc_individual_passport_url && docs.doc_individual_itn_url;
  const canGoNext4 = company.company_full_name && company.edrpou && company.iban;
  const canGoNext5 = payoutCardId != null;

  const maskedLast4 = (n) => (n ? `•••• ${String(n).slice(-4)}` : '');

  // ========================
  // API
  // ========================
  async function apiJSON(url, body) {
    const res = await fetch(API(url), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || 'Ошибка сервера');
    return data;
  }

  async function checkShopNameUnique(name) {
    const r = await apiJSON('/api/seller/apply/validate-name', { shop_name: name.trim() });
    return !!r?.ok;
  }

  async function saveStep(n) {
    const payload = {
      step: n,
      shop_name: shopName.trim() || null,
      country: addr.country || null,
      shipping_address: addr.shipping_address || null,
      city: addr.city || null,
      zip: addr.zip || null,
      reg_type: regType,
      doc_company_extract_url: docs.doc_company_extract_url || null,
      doc_company_itn_url: docs.doc_company_itn_url || null,
      doc_individual_passport_url: docs.doc_individual_passport_url || null,
      doc_individual_itn_url: docs.doc_individual_itn_url || null,
      company_full_name: company.company_full_name || null,
      edrpou: company.edrpou || null,
      iban: company.iban || null,
      payout_card_id: payoutCardId || null
    };
    await apiJSON('/api/seller/apply/save-step', payload);
  }

  async function loadCards() {
    const res = await fetch(API('/api/me/cards'), { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || 'Не вдалося завантажити картки');
    setCards(data?.items || []);
  }

  async function addCard() {
    const body = {
      number: newCard.number,
      exp: newCard.exp,
      cvc: newCard.cvc,
      holder_name: newCard.holder
    };
    const r = await apiJSON('/api/me/cards', body);
    setNewCard({ number: '', exp: '', cvc: '', holder: '' });
    await loadCards();
    return r;
  }

  async function submitAll() {
    await apiJSON('/api/seller/apply/submit', { payout_card_id: payoutCardId });
    await refresh();
  }

  // ========================
  // Step actions
  // ========================
  const nextFrom1 = async () => {
    try {
      setBusy(true); setErr(null);
      const ok = await checkShopNameUnique(shopName);
      setShopNameOk(ok);
      if (!ok) throw new Error('Назва зайнята. Виберіть іншу.');
      await saveStep(1);
      setStep(2);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const nextFrom2 = async () => { try { setBusy(true); setErr(null); await saveStep(2); setStep(3); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const nextFrom3 = async () => { try { setBusy(true); setErr(null); await saveStep(3); setStep(4); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const nextFrom4 = async () => { try { setBusy(true); setErr(null); await saveStep(4); await loadCards(); setStep(5); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  // стало:
const nextFrom5 = async () => {
  try {
    setBusy(true);
    setErr(null);
    await saveStep(5);
    await submitAll();      // сабмитим заявку
    navigate('/seller/complete'); // сразу на страницу успеха
  } catch (e) {
    setErr(e.message);
  } finally {
    setBusy(false);
  }
};

  const back = () => setStep((s) => Math.max(1, s - 1));

  // ========================
  // UI blocks
  // ========================

  return (
    <div className="container page-container">
      {/* Убираем большой заголовок сверху. Степпер и инфо юзера показываем только со 2 шага */}

      {err && <div className="msg-err mb-12" role="alert">{err}</div>}

      {/* ========== STEP 1: Назва магазину — карточка строго как в фигме ========== */}
      {step === 1 && (
        <div className="sa-name-card" role="region" aria-label="Реєстрація магазину">
          <h4 className="sa-name-title">{t('sellerApply.title') || 'Реєстрація магазину'}</h4>
          <div className="sa-name-input-wrap">
            <input
              className="sa-name-input"
              placeholder="*Назва магазину"
              value={shopName}
              onChange={(e) => { setShopName(e.target.value); setShopNameOk(false); }}
            />
          </div>
          <div className="sa-name-btn-wrap">
            <button className="sa-name-btn" disabled={busy || !shopName} onClick={nextFrom1}>
              {busy ? 'Перевіряємо...' : 'Продовжити'}
            </button>
          </div>
        </div>
      )}

      {/* ========== STEP 2: карточка из Фигмы ========== */}
        {step === 2 && (
          <div className="sa-addr-card" role="region" aria-label="Реєстрація магазину">
            <h4 className="sa-addr-title">Реєстрація магазину</h4>

            <div className="sa-addr-group sa-addr-country">
              <input
                className="sa-addr-input"
                placeholder="*Країна"
                value={addr.country}
                onChange={(e)=>setAddr(a=>({...a, country:e.target.value}))}
              />
            </div>

            <div className="sa-addr-group sa-addr-ship">
              <input
                className="sa-addr-input"
                placeholder="*Адреса відправки"
                value={addr.shipping_address}
                onChange={(e)=>setAddr(a=>({...a, shipping_address:e.target.value}))}
              />
            </div>

            <div className="sa-addr-group sa-addr-city">
              <input
                className="sa-addr-input-sm"
                placeholder="*Місто"
                value={addr.city}
                onChange={(e)=>setAddr(a=>({...a, city:e.target.value}))}
              />
            </div>

            <div className="sa-addr-group sa-addr-zip">
              <input
                className="sa-addr-input-sm"
                placeholder="*Індекс"
                value={addr.zip}
                onChange={(e)=>setAddr(a=>({...a, zip:e.target.value}))}
              />
            </div>

            <div className="sa-addr-btn-wrap">
              <button className="sa-name-btn" disabled={busy || !canGoNext2} onClick={nextFrom2}>
                {busy ? 'Зберігаємо...' : 'Продовжити'}
              </button>
            </div>
          </div>
        )}


      {/* ========== STEP 3: Документи ========== */}
     {step === 3 && (
  <div className="sa-figma-card" role="region" aria-label="Реєстрація магазину">
    <h4 className="sa-figma-title">{t('sellerApply.title') || 'Реєстрація магазину'}</h4>

    {/* точки выбора типа */}
    <button
      type="button"
      className={`sa3-dot company ${regType==='company' ? 'is-active' : ''}`}
      onClick={()=>setRegType('company')}
      aria-pressed={regType==='company'}
    />
    <div className={`sa3-label company ${regType==='company' ? 'is-active' : ''}`}>Для компанії</div>

    <button
      type="button"
      className={`sa3-dot indiv ${regType==='individual' ? 'is-active' : ''}`}
      onClick={()=>setRegType('individual')}
      aria-pressed={regType==='individual'}
    />
    <div className={`sa3-label indiv ${regType==='individual' ? 'is-active' : ''}`}>Для фізичної особи</div>

    {/* upload-кнопки */}
    {regType === 'company' ? (
      <>
        <div className="sa3-up up1">
          <button
            type="button"
            className={`sa-upload-btn ${docs.doc_company_extract_url ? 'is-filled' : ''}`}
            onClick={()=>document.getElementById('f-company-extract').click()}>
            <span className="ico" aria-hidden="true">
            <svg width="28" height="29" viewBox="0 0 28 29" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.66406 18.8901V20.0521C4.66406 20.9803 5.03281 21.8706 5.68919 22.527C6.34557 23.1833 7.2358 23.5521 8.16406 23.5521H19.8307C20.759 23.5521 21.6492 23.1833 22.3056 22.527C22.962 21.8706 23.3307 20.9803 23.3307 20.0521V18.8854M13.9974 18.3021V5.46875M13.9974 5.46875L18.0807 9.55208M13.9974 5.46875L9.91406 9.55208" stroke="#35C65E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
            Завантажити виписку з реєстру
          </button>
          <input id="f-company-extract" type="file" accept=".pdf,image/*" hidden
            onChange={async (e)=>{
              const f = e.target.files?.[0]; if(!f) return;
              try{ setBusy(true); const url = await uploadFile(f);
                   setDocs(d=>({...d, doc_company_extract_url:url})); }
              finally{ setBusy(false); e.target.value=''; }
            }}/>
        </div>

        <div className="sa3-up up2">
          <button
            type="button"
            className={`sa-upload-btn ${docs.doc_company_itn_url ? 'is-filled' : ''}`}
            onClick={()=>document.getElementById('f-company-itn').click()}>
            <span className="ico" aria-hidden="true">
            <svg width="28" height="29" viewBox="0 0 28 29" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.66406 18.8901V20.0521C4.66406 20.9803 5.03281 21.8706 5.68919 22.527C6.34557 23.1833 7.2358 23.5521 8.16406 23.5521H19.8307C20.759 23.5521 21.6492 23.1833 22.3056 22.527C22.962 21.8706 23.3307 20.9803 23.3307 20.0521V18.8854M13.9974 18.3021V5.46875M13.9974 5.46875L18.0807 9.55208M13.9974 5.46875L9.91406 9.55208" stroke="#35C65E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
            Завантажити ІПН
          </button>
          <input id="f-company-itn" type="file" accept=".pdf,image/*" hidden
            onChange={async (e)=>{
              const f = e.target.files?.[0]; if(!f) return;
              try{ setBusy(true); const url = await uploadFile(f);
                   setDocs(d=>({...d, doc_company_itn_url:url})); }
              finally{ setBusy(false); e.target.value=''; }
            }}/>
        </div>
      </>
    ) : (
      <>
        <div className="sa3-up up1">
          <button
            type="button"
            className={`sa-upload-btn ${docs.doc_individual_passport_url ? 'is-filled' : ''}`}
            onClick={()=>document.getElementById('f-indiv-passport').click()}>
              <span className="ico" aria-hidden="true">
          <svg width="28" height="29" viewBox="0 0 28 29" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.66406 18.8901V20.0521C4.66406 20.9803 5.03281 21.8706 5.68919 22.527C6.34557 23.1833 7.2358 23.5521 8.16406 23.5521H19.8307C20.759 23.5521 21.6492 23.1833 22.3056 22.527C22.962 21.8706 23.3307 20.9803 23.3307 20.0521V18.8854M13.9974 18.3021V5.46875M13.9974 5.46875L18.0807 9.55208M13.9974 5.46875L9.91406 9.55208" stroke="#35C65E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
            Завантажити паспорт
          </button>
          <input id="f-indiv-passport" type="file" accept=".pdf,image/*" hidden
            onChange={async (e)=>{
              const f = e.target.files?.[0]; if(!f) return;
              try{ setBusy(true); const url = await uploadFile(f);
                   setDocs(d=>({...d, doc_individual_passport_url:url})); }
              finally{ setBusy(false); e.target.value=''; }
            }}/>
        </div>

        <div className="sa3-up up2">
          <button
            type="button"
            className={`sa-upload-btn ${docs.doc_individual_itn_url ? 'is-filled' : ''}`}
            onClick={()=>document.getElementById('f-indiv-itn').click()}>
            <span className="ico" aria-hidden="true">
  <svg width="28" height="29" viewBox="0 0 28 29" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.66406 18.8901V20.0521C4.66406 20.9803 5.03281 21.8706 5.68919 22.527C6.34557 23.1833 7.2358 23.5521 8.16406 23.5521H19.8307C20.759 23.5521 21.6492 23.1833 22.3056 22.527C22.962 21.8706 23.3307 20.9803 23.3307 20.0521V18.8854M13.9974 18.3021V5.46875M13.9974 5.46875L18.0807 9.55208M13.9974 5.46875L9.91406 9.55208" stroke="#35C65E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
</span>
            Завантажити ІПН
          </button>
          <input id="f-indiv-itn" type="file" accept=".pdf,image/*" hidden
            onChange={async (e)=>{
              const f = e.target.files?.[0]; if(!f) return;
              try{ setBusy(true); const url = await uploadFile(f);
                   setDocs(d=>({...d, doc_individual_itn_url:url})); }
              finally{ setBusy(false); e.target.value=''; }
            }}/>
        </div>
      </>
    )}

    {/* фикс-кнопка внизу карточки */}
    <div className="sa-fixed-btn">
      <button className="sa-name-btn" disabled={busy || !canGoNext3} onClick={nextFrom3}>
        {busy ? 'Зберігаємо...' : 'Продовжити'}
      </button>
    </div>
  </div>
)}
      {step === 4 && (
  <div className="sa-figma-card" role="region" aria-label="Реєстрація магазину">
    <h4 className="sa-figma-title">{t('sellerApply.title') || 'Реєстрація магазину'}</h4>

    <div className="sa4-group sa4-fname">
      <input className="sa4-input" placeholder="*Повна назва компанії"
             value={company.company_full_name}
             onChange={(e)=>setCompany(c=>({...c, company_full_name:e.target.value}))}/>
    </div>

    <div className="sa4-group sa4-edrpou">
      <input className="sa4-input" placeholder="*ЄДРПОУ"
             value={company.edrpou}
             onChange={(e)=>setCompany(c=>({...c, edrpou:e.target.value}))}/>
    </div>

    <div className="sa4-group sa4-iban">
      <input className="sa4-input" placeholder="*Номер рахунку на IBAN"
             value={company.iban}
             onChange={(e)=>setCompany(c=>({...c, iban:e.target.value}))}/>
    </div>

    <div className="sa-fixed-btn">
      <button className="sa-name-btn" disabled={busy || !canGoNext4} onClick={nextFrom4}>
        {busy ? 'Зберігаємо...' : 'Продовжити'}
      </button>
    </div>
  </div>
)}

            {/* ========== STEP 5: Вибір картки (як у фігмі) ========== */}
      {step === 5 && (
        <div className="sa-step5-card" role="region" aria-label="Реєстрація магазину">
          <h4 className="sa-step5-title">Реєстрація магазину</h4>

          {/* Первая карта */}
          <div className="sa5-choice-group sa5-choice-1">
            <button
              type="button"
              className={
                "sa5-choice-btn " +
                (cards[0] && payoutCardId === cards[0].id ? "is-active" : "")
              }
              disabled={!cards[0]}
              onClick={() => cards[0] && setPayoutCardId(cards[0].id)}
            >
              {cards[0]
                ? `${(cards[0].brand || "CARD").toUpperCase()} •••• ${String(
                    cards[0].last4 || ""
                  ).slice(-4)}`
                : "Картка 1"}
            </button>
          </div>

          {/* Вторая карта */}
          <div className="sa5-choice-group sa5-choice-2">
            <button
              type="button"
              className={
                "sa5-choice-btn " +
                (cards[1] && payoutCardId === cards[1].id ? "is-active" : "")
              }
              disabled={!cards[1]}
              onClick={() => cards[1] && setPayoutCardId(cards[1].id)}
            >
              {cards[1]
                ? `${(cards[1].brand || "CARD").toUpperCase()} •••• ${String(
                    cards[1].last4 || ""
                  ).slice(-4)}`
                : "Картка 2"}
            </button>
          </div>

          {/* Кнопка снизу, как на макете */}
          <div className="sa5-fixed-btn">
            <button
              className="sa-name-btn"
              disabled={busy || !payoutCardId}
              onClick={nextFrom5}
            >
              {busy ? "Відправляємо..." : "Завершити"}
            </button>
          </div>
        </div>
      )}


      {/* ========== STEP 6: Успіх ========== */}

    </div>
  );
}
