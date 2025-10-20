import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';

import '../Styles/CreatingProduct.css';

import icBack from '../assets/planex.png';
import arrowGreen from '../assets/arrow-green.png';

const API = process.env.REACT_APP_API || '';

function stringifyData(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  try { return JSON.stringify(data); } catch { return String(data); }
}
function extractAxiosErr(err, t) {
  if (err?.response) {
    const { status, statusText, data } = err.response;
    const msg =
      data?.message ||
      data?.error ||
      (Array.isArray(data?.errors) && data.errors.filter(Boolean).join(', ')) ||
      stringifyData(data) ||
      statusText ||
      'Server error';
    return `HTTP ${status} — ${msg}`;
  }
  if (err?.request) return t('errors.serverUnavailable', { defaultValue: 'Сервер недоступний' });
  return err?.message || t('productNew.errors.saveFailed', { defaultValue: 'Не вдалось зберегти' });
}

const MAX_THUMBS = 5;

export default function ProductNew() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [priceUI, setPriceUI] = useState('');
  const [description, setDescription] = useState('');
  const [attrs, setAttrs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // фото
  const mainInputRef = useRef(null);
  const [mainFile, setMainFile] = useState(null);
  const [mainPreview, setMainPreview] = useState('');
  const [thumbFiles, setThumbFiles] = useState(Array(MAX_THUMBS).fill(null));
  const [thumbPreviews, setThumbPreviews] = useState(Array(MAX_THUMBS).fill(''));

  // бренд
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brandUrl, setBrandUrl] = useState('');
  const [brandDataUrl, setBrandDataUrl] = useState('');

  // категории (используем только для авто-выбора первой)
  const [category, setCategory] = useState('');
  const [_categories, _setCategories] = useState([]);
  const [_catErr, _setCatErr] = useState('');

  useEffect(() => {
    document.title = t('productNew.metaTitle', { defaultValue: 'Додати товар' });
  }, [t]);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/categories`, { withCredentials: true });
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (!stop) {
          _setCategories(items);
          if (items[0]?.name) setCategory(items[0].name);
        }
      } catch {
        if (!stop) _setCatErr('Не вдалося завантажити категорії');
      }
    })();
    return () => { stop = true; };
  }, []);

  // ==== ХУКИ, которые должны быть ДО любых ранних return ====
  const priceNumber = useMemo(() => {
    if (!priceUI) return 0;
    const normalized = priceUI.replace(/\./g, '').replace(',', '.');
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  }, [priceUI]);

  const thumbEnabled = useMemo(() => {
    const arr = Array(MAX_THUMBS).fill(false);
    if (!mainPreview) return arr;
    arr[0] = true;
    for (let i = 1; i < MAX_THUMBS; i++) {
      if (thumbPreviews[i - 1]) arr[i] = true;
    }
    return arr;
  }, [mainPreview, thumbPreviews]);
  // ===========================================================

  if (!user) return <div style={{ padding: 24 }}>Завантаження…</div>;
  if (user.seller_status !== 'approved') {
    return <div style={{ padding: 24 }}>Ваш обліковий запис ще не схвалено модератором.</div>;
  }

  const onPriceInput = (v) => {
    v = v.replace(/[^\d,]/g, '');
    const [ints = '', decRaw = ''] = v.split(',');
    const dec = decRaw.replace(/,/g, '').slice(0, 2);
    const out = v.includes(',') ? `${ints},${dec}` : ints;
    setPriceUI(out.slice(0, 10));
  };

  const chooseMain = () => {
    if (mainPreview) return;
    mainInputRef.current?.click();
  };
  const onMainChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type?.startsWith('image/')) return;
    setMainFile(f);
    const url = URL.createObjectURL(f);
    setMainPreview(url);
  };

  const onThumbPick = (idx) => {
    if (!mainPreview) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f || !f.type?.startsWith('image/')) return;
      const url = URL.createObjectURL(f);
      setThumbFiles((prev) => { const next = prev.slice(); next[idx] = f; return next; });
      setThumbPreviews((prev) => { const next = prev.slice(); next[idx] = url; return next; });
    };
    input.click();
  };

  const addAttr = () => {
    const value = prompt('Введіть атрибут (до 30 символів)')?.trim();
    if (!value || attrs.length >= 5) return;
    setAttrs((a) => [...a, value.slice(0, 30)]);
  };

  const onBrandPickImage = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f || !f.type?.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => setBrandDataUrl(String(reader.result || ''));
      reader.readAsDataURL(f);
    };
    inp.click();
  };

  const submit = async () => {
    try {
      setErr('');
      if (!title.trim()) { setErr('Вкажіть назву товару'); return; }
      if (priceNumber < 0) { setErr('Ціна має бути невід’ємною'); return; }
      if (!category) { setErr('Категорія обов’язкова'); return; }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        price: priceNumber,
        qty: 1,
        attributes: attrs,
        preview_image_url: null,
        brand: brandName ? { name: brandName, url: brandUrl || null } : null,
      };

      setSaving(true);

      let createUrl = `${API}/api/products`;
      let resp;
      try {
        resp = await axios.post(createUrl, payload, { withCredentials: true });
      } catch (e1) {
        const st = e1?.response?.status;
        if (st === 404 || st === 405) {
          createUrl = `${API}/products`;
          resp = await axios.post(createUrl, payload, { withCredentials: true });
        } else {
          throw e1;
        }
      }

      const created = resp?.data;
      const productId = created?.id || created?.item?.id || created?.product?.id;
      if (!productId) {
        const fallback =
          created?.message ||
          created?.error ||
          (Array.isArray(created?.errors) && created.errors.filter(Boolean).join(', ')) ||
          stringifyData(created);
        throw new Error(fallback || 'Не вдалося створити товар');
      }

      if (mainFile || thumbFiles.some(Boolean)) {
        const fd = new FormData();
        if (mainFile) fd.append('main', mainFile);
        thumbFiles.forEach((f, i) => f && fd.append(`thumb${i + 1}`, f));
        try {
          await axios.post(`${API}/api/products/${productId}/images`, fd, {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (_) {}
      }

      navigate(`/products/${productId}`);
    } catch (e) {
      setErr(extractAxiosErr(e, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="creating-root">
      {/* ВСЮ канву поднимаем целиком */}
      <div className="creating-canvas">
        <div className="goods-wrap">
          <button className="goods-icon" type="button" onClick={() => navigate(-1)} aria-label="Назад">
            <img className="goods-icon__img" src={icBack} alt="" />
          </button>
          <h3 className="goods-title">Товари</h3>
        </div>

        <div className="group-1038" aria-label="Додаткові фото товару">
          <div className="rectangle-108" />
          <div className="line-37" />
          <div className="line-36" />
          <div className="line-35" />
          <div className="line-34" />
          {Array.from({ length: MAX_THUMBS }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={
                'thumb-slot ' +
                (thumbEnabled[i] ? 'is-enabled ' : '') +
                (thumbPreviews[i] ? 'has-image ' : '')
              }
              data-slot={i}
              disabled={!thumbEnabled[i]}
              onClick={() => onThumbPick(i)}
              aria-label={`Мініатюра ${i + 1}`}
            >
              <span className="icon-plus">+</span>
              {thumbPreviews[i] && <img className="thumb-preview" src={thumbPreviews[i]} alt="" />}
            </button>
          ))}
        </div>

        <div className="group-1125">
          <button
            type="button"
            id="add-photo-btn"
            className={'rectangle-107 ' + (mainPreview ? 'has-image' : '')}
            aria-label="Додайте фото товару (до 6 фото)"
            onClick={chooseMain}
          >
            <span className="icon-plus">+</span>
            <span className="hint">Додайте фото товару (до 6 фото)</span>
            {mainPreview && <img className="preview" src={mainPreview} alt="Зображення товару" />}
          </button>
          <input
            ref={mainInputRef}
            id="product-photo"
            type="file"
            accept="image/*"
            hidden
            onChange={onMainChange}
          />
        </div>

        <div className="group-1045">
          <div className="rectangle-199">
            <input
              type="text"
              className="title-input"
              maxLength={40}
              placeholder="*Назва товару"
              aria-label="Назва товару"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        <div className="group-1047">
          <div className="rectangle-200">
            <input
              type="text"
              className="price-input"
              placeholder="*Ціна"
              aria-label="Ціна"
              inputMode="decimal"
              value={priceUI}
              onChange={(e) => onPriceInput(e.target.value)}
              onBlur={() => setPriceUI((v) => v.replace(/,$/, ''))}
            />
            <span className="suffix-uah">грн</span>
          </div>
        </div>

        <div id="attrs-anchor" className="attrs-anchor">
          <div id="attrs-root">
            {attrs.map((txt, i) => (
              <div key={i} className="attr-chip" style={{ left: `${i * (82 + 18)}px` }}>
                {txt}
              </div>
            ))}
            {attrs.length < 5 && (
              <button
                type="button"
                className="attr-add-btn"
                style={{ left: `${attrs.length * (82 + 18)}px`, top: '6px' }}
                onClick={addAttr}
              >
                <span className="plus">+</span>
                <span>Додати атрибут</span>
              </button>
            )}
          </div>
        </div>

        <div className="shop-label">Магазин</div>

        <div className="group-683">
          <div className="seller-frame" />
          <div className="seller-title">{brandName || 'Super Noname Store'}</div>
          <div className="seller-link">
            <button type="button" className="seller-link-text" onClick={() => {}}>
              Перейти до магазину
            </button>
            <img className="seller-link-icon" src={arrowGreen} alt="" />
          </div>
        </div>

        <div className="frame-736">
          {!brandDataUrl && !brandName ? (
            <button type="button" className="frame-736__btn" onClick={() => setBrandOpen(true)}>
              <span className="frame-736__plus">+</span>
              <span className="frame-736__label">Бренд (за бажанням)</span>
            </button>
          ) : (
            <div className="frame736-banner">
              <div className="frame736-top">
                {brandDataUrl ? <img src={brandDataUrl} alt="" /> : <div className="ph" />}
              </div>
              <div className="frame736-border" />
              <div className="frame736-title">{brandName}</div>
            </div>
          )}
        </div>

        <div className="rectangle-201">
          <textarea
            className="desc-input"
            aria-label="Опис товару"
            placeholder="*Про товар"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button
          id="publish-btn"
          className="publish-btn"
          type="button"
          onClick={submit}
          disabled={saving || !title.trim() || !category || priceNumber < 0}
        >
          {saving ? 'Збереження…' : 'Опублікувати товар'}
        </button>

        {err && (
          <div style={{ position: 'absolute', left: 635, top: 1295, color: '#d00' }}>{err}</div>
        )}
      </div>

      {/* модалка фиксированная, не зависит от сдвига канвы */}
      {brandOpen && (
        <div className="brand-modal is-open" role="dialog" aria-modal="true">
          <div className="brand-modal__overlay" onClick={() => setBrandOpen(false)} />
          <div className="brand-modal__card">
            <button className="brand-modal__close" aria-label="Закрити" onClick={() => setBrandOpen(false)}>
              &times;
            </button>

            <button type="button" className="brand-modal__photo" onClick={onBrandPickImage}>
              {!brandDataUrl && (
                <>
                  <span className="brand-modal__plus">+</span>
                  <span className="brand-modal__photo-label">Додати фото</span>
                </>
              )}
              {brandDataUrl && <img className="brand-modal__photo-preview" src={brandDataUrl} alt="" />}
            </button>

            <div className="brand-modal__row">
              <input
                type="text"
                className="brand-modal__input"
                placeholder="Назва бренду"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
            </div>

            <div className="brand-modal__row" style={{ top: 285 }}>
              <input
                type="text"
                className="brand-modal__input"
                placeholder="URL-посилання"
                value={brandUrl}
                onChange={(e) => setBrandUrl(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="brand-modal__submit"
              style={{ top: 360 }}
              onClick={() => setBrandOpen(false)}
            >
              Додати
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
