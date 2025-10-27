// client/src/Pages/ProductNew.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { catalogItems } from '../data/catalogItems';

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

/** Геометрия секции атрибутов — синхронно с CSS */
const ATTR_ROW_H   = 55;
const ATTR_ROW_GAP = 12;
const ATTR_W       = 170;   // 3 шт в ряд по ширине 550
const ADD_W        = 170;   // кнопка такой же ширины
const COL_GAP      = 18;
const CONTAINER_W  = 550;
const MAX_ATTRS    = 24;

export default function ProductNew() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // ===== Основные состояния
  const [title, setTitle] = useState('');
  const [priceUI, setPriceUI] = useState('');
  const [description, setDescription] = useState('');
  const [attrs, setAttrs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Фото
  const mainInputRef = useRef(null);
  const [mainFile, setMainFile] = useState(null);
  const [mainPreview, setMainPreview] = useState('');
  const [thumbFiles, setThumbFiles] = useState(Array(MAX_THUMBS).fill(null));
  const [thumbPreviews, setThumbPreviews] = useState(Array(MAX_THUMBS).fill(''));
  const dragFromRef = useRef(null);

  // Бренд
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brandUrl, setBrandUrl] = useState('');
  const [brandDataUrl, setBrandDataUrl] = useState('');

  // Категории (из API + UI)
  const [category, setCategory] = useState('');
  const [_categories, _setCategories] = useState([]);
  const [_catErr, _setCatErr] = useState('');
  
  const [catInput, setCatInput] = useState('');
  useEffect(() => { setCatInput(category); }, [category]);

  // Слайдер категорий (текстовый)
  const [catSliderOpen, setCatSliderOpen] = useState(false);
  const catTrackRef = useRef(null);
  const scrollCats = (dir) => {
    const el = catTrackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };
  const onPickCategory = (name) => {
    setCatInput(name);
    setCategory(name);
    setCatSliderOpen(false);
  };

  // Имя/ссылка магазина
  const shopName =
    user?.shop_name ||
    user?.shopName ||
    user?.shop?.name ||
    user?.store?.name ||
    user?.seller?.shop_name ||
    user?.seller?.store?.name ||
    '';
  const shopLink =
    user?.shop_slug ? `/shops/${user.shop_slug}` :
    user?.shop?.slug ? `/shops/${user.shop.slug}` :
    '/seller/store';

  // ===== Эффекты
  useEffect(() => {
    document.title = t('productNew.metaTitle', { defaultValue: 'Додати товар' });
  }, [t]);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/categories`, { withCredentials: true });
        const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
        const norm = items.map(c => ({
          id: c.id ?? c._id ?? c.value ?? c.slug ?? c.name,
          name: c.name ?? c.title ?? String(c),
        })).filter(c => c.name);
        if (!stop) {
          _setCategories(norm);
          if (!category && norm[0]?.name) setCategory(norm[0].name);
        }
      } catch {
        if (!stop) _setCatErr('Не вдалося завантажити категорії');
      }
    })();
    return () => { stop = true; };
  }, []); // eslint-disable-line

  // ===== Memo
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

  // ===== Ранние выходы
  if (!user) return <div style={{ padding: 24 }}>Завантаження…</div>;
  if (user.seller_status !== 'approved') {
    return <div style={{ padding: 24 }}>Ваш обліковий запис ще не схвалено модератором.</div>;
  }

  // ===== Handlers
  const onPriceInput = (v) => {
    v = v.replace(/[^\d,]/g, '');
    const [ints = '', decRaw = ''] = v.split(',');
    const dec = decRaw.replace(/,/g, '').slice(0, 2);
    const out = v.includes(',') ? `${ints},${dec}` : ints;
    setPriceUI(out.slice(0, 10));
  };

  const chooseMain = () => { mainInputRef.current?.click(); };
  const onMainChange = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type?.startsWith('image/')) return;
    setMainFile(f);
    setMainPreview(URL.createObjectURL(f));
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

  
  const deleteMain = (e) => {
    e?.stopPropagation?.();
    const firstIdx = thumbPreviews.findIndex(Boolean);
    if (firstIdx !== -1) {
      setMainFile(thumbFiles[firstIdx]);
      setMainPreview(thumbPreviews[firstIdx]);
      setThumbFiles((prev) => { const n = prev.slice(); n[firstIdx] = null; return n; });
      setThumbPreviews((prev) => { const n = prev.slice(); n[firstIdx] = ''; return n; });
    } else {
      setMainFile(null);
      setMainPreview('');
    }
  };
  const deleteThumb = (idx) => {
    setThumbFiles((prev) => { const n = prev.slice(); n[idx] = null; return n; });
    setThumbPreviews((prev) => { const n = prev.slice(); n[idx] = ''; return n; });
  };

  const onThumbDragStart = (idx) => (e) => { dragFromRef.current = idx; e.dataTransfer.effectAllowed = 'move'; };
  const onThumbDragOver  = () => (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onThumbDrop      = (idx) => (e) => {
    e.preventDefault();
    const from = dragFromRef.current;
    if (from == null || from === idx) return;
    setThumbFiles((prev) => { const n = prev.slice(); [n[from], n[idx]] = [n[idx], n[from]]; return n; });
    setThumbPreviews((prev) => { const n = prev.slice(); [n[from], n[idx]] = [n[idx], n[from]]; return n; });
  };

  const onMainDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onMainDrop = (e) => {
    e.preventDefault();
    const from = dragFromRef.current;
    if (from == null) return;
    const f = thumbFiles[from];
    const p = thumbPreviews[from];
    if (!p) return;
    setThumbFiles((prev) => { const n = prev.slice(); n[from] = mainFile; return n; });
    setThumbPreviews((prev) => { const n = prev.slice(); n[from] = mainPreview; return n; });
    setMainFile(f);
    setMainPreview(p);
  };

  // Атрибуты
  const canAddAttr = attrs.every(a => a.trim().length > 0) && attrs.length < MAX_ATTRS;
  const addAttrInline = () => { if (canAddAttr) setAttrs((a) => [...a, '']); };
  const changeAttr = (i, v) => {
    setAttrs((a) => { const n = a.slice(); n[i] = v.slice(0, 30); return n; });
  };
  const removeAttr = (i) => { setAttrs((a) => a.filter((_, idx) => idx !== i)); };

  // Категория: ввод + datalist, валидация на блюре
  const onCatChange = (v) => { setCatInput(v); };
  const commitCategory = () => {
    const found = _categories.find(c => c.name.toLowerCase() === String(catInput).trim().toLowerCase());
    if (found) setCategory(found.name);
    else setCatInput(category || (_categories[0]?.name || ''));
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

  

  // ===== Расчёт динамических top на основе высоты атрибутов
  function calcAttrRows(len) {
    // укладываем len чипов + кнопку добавления в строки шириной CONTAINER_W
    const items = Array(len).fill(ATTR_W).concat(ADD_W);
    let rows = 1, used = 0;
    for (const w of items) {
      const need = used === 0 ? w : used + COL_GAP + w;
      if (need <= CONTAINER_W) used = need;
      else { rows++; used = w; }
    }
    return rows;
  }
  const attrRows = calcAttrRows(attrs.length);
  const attrsHeight = attrRows * ATTR_ROW_H + Math.max(0, attrRows - 1) * ATTR_ROW_GAP;

  // цена под атрибутами
  const priceTop = 375 + attrsHeight + 20;

  // категория под ценой (как было)
  const catTop = priceTop + 72;

  // дополнительный сдвиг, если открыт слайдер категорий (≈48 + 10)
  const catSliderExtra = catSliderOpen ? 58 : 0;

  // магазин/бренд — учитываем высоту атрибутов и слайдер
  const baseAttrsHeight = ATTR_ROW_H; // 55 — одна строка
  const extraShift = Math.max(0, attrsHeight - baseAttrsHeight) + catSliderExtra;

  const shopLabelTop = 599 + extraShift;
  const shopTop      = 626 + extraShift;
  const brandTop     = 626 + extraShift;

  // ===== Submit
  const submit = async () => {
  try {
    setErr('');
    if (!title.trim()) { setErr('Вкажіть назву товару'); return; }
    if (priceNumber < 0) { setErr('Ціна має бути невідємною'); return; }

    const rawCat = String(catInput).trim();
    if (!rawCat) { setErr('Оберіть категорію'); return; }
    const matched = _categories.find(c => c.name?.toLowerCase() === rawCat.toLowerCase());
    const finalCat = matched?.name || rawCat;

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category: finalCat,
      price: priceNumber,
      qty: 1,
      attributes: attrs.filter(Boolean).map(s => s.trim()).filter(Boolean),
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

    // ========== ЗАГРУЗКА ИЗОБРАЖЕНИЙ ==========
    if (mainFile || thumbFiles.some(Boolean)) {
      const fd = new FormData();
      if (mainFile) fd.append('main', mainFile);
      thumbFiles.forEach((f, i) => f && fd.append(`thumb${i + 1}`, f));
      
      try {
        let uploadUrl = `${API}/api/products/${productId}/images`;
        let uploadResp;
        
        try {
          uploadResp = await axios.post(uploadUrl, fd, {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (e1) {
          if (e1?.response?.status === 404 || e1?.response?.status === 405) {
            uploadUrl = `${API}/products/${productId}/images`;
            uploadResp = await axios.post(uploadUrl, fd, {
              withCredentials: true,
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } else {
            throw e1;
          }
        }

        const uploadData = uploadResp?.data;
        const mainUrl =
          uploadData?.main_url ||
          uploadData?.main ||
          uploadData?.image_url ||
          uploadData?.preview_image_url ||
          uploadData?.main_image_url ||
          uploadData?.images?.[0]?.url;

        console.log('Ответ от загрузки изображений:', uploadData);
        console.log('Извлечённый mainUrl:', mainUrl);

        if (mainUrl) {
          try {
            await axios.patch(`${API}/api/products/${productId}`, {
              image_url: mainUrl,
              preview_image_url: mainUrl,
              main_image_url: mainUrl,
            }, { withCredentials: true });
          } catch (patchErr) {
            try {
              await axios.put(`${API}/api/products/${productId}`, {
                ...payload,
                image_url: mainUrl,
                preview_image_url: mainUrl,
                main_image_url: mainUrl,
              }, { withCredentials: true });
            } catch (putErr) {
              console.error('Помилка оновлення продукту:', putErr);
            }
          }
        }
      } catch (uploadErr) {
        console.error('Помилка завантаження зображень:', uploadErr);
      }
    }
    // ========== КОНЕЦ ЗАГРУЗКИ ИЗОБРАЖЕНИЙ ==========

    navigate(`/products/${productId}`);
  } catch (e) {
    setErr(extractAxiosErr(e, t));
  } finally {
    setSaving(false);
  }
};
  
  // ===== JSX
  return (
    <div className="creating-root">
      <div className="creating-canvas">
        {/* Заголовок */}
        <div className="goods-wrap">
          <button className="goods-icon" type="button" onClick={() => navigate(-1)} aria-label="Назад">
            <img className="goods-icon__img" src={icBack} alt="" />
          </button>
          <h3 className="goods-title">Товари</h3>
        </div>

        {/* Левая колонка миниатюр */}
        <div className="group-1038" aria-label="Додаткові фото товару">
          <div className="rectangle-108" />
          <div className="line-37" />
          <div className="line-36" />
          <div className="line-35" />
          <div className="line-34" />
          {Array.from({ length: MAX_THUMBS }).map((_, i) => {
            const hasImg = !!thumbPreviews[i];
            return (
              <button
                key={i}
                type="button"
                className={
                  'thumb-slot ' +
                  (thumbEnabled[i] ? 'is-enabled ' : '') +
                  (hasImg ? 'has-image ' : '')
                }
                data-slot={i}
                disabled={!thumbEnabled[i]}
                onClick={() => onThumbPick(i)}
                aria-label={`Мініатюра ${i + 1}`}
                draggable={hasImg}
                onDragStart={onThumbDragStart(i)}
                onDragOver={onThumbDragOver(i)}
                onDrop={onThumbDrop(i)}
              >
                <span className="icon-plus">+</span>
                {hasImg && (
                  <>
                    <img className="thumb-preview" src={thumbPreviews[i]} alt="" />
                    <button
                      type="button"
                      className="img-delete"
                      aria-label="Видалити фото"
                      onClick={(e) => { e.stopPropagation(); deleteThumb(i); }}
                    >
                      ×
                    </button>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Главное фото */}
        <div className="group-1125">
          <button
            type="button"
            id="add-photo-btn"
            className={'rectangle-107 ' + (mainPreview ? 'has-image' : '')}
            aria-label="Додайте фото товару (до 6 фото)"
            onClick={chooseMain}
            onDragOver={onMainDragOver}
            onDrop={onMainDrop}
          >
            <span className="icon-plus">+</span>
            <span className="hint">Додайте фото товару (до 6 фото)</span>
            {mainPreview && (
              <>
                <img className="preview" src={mainPreview} alt="Зображення товару" />
                <button
                  type="button"
                  className="img-delete img-delete--main"
                  aria-label="Видалити головне фото"
                  onClick={deleteMain}
                >
                  ×
                </button>
              </>
            )}
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

        {/* Название */}
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

        {/* Атрибуты */}
        <div id="attrs-anchor" className="attrs-anchor" style={{ height: attrsHeight }}>
          <div id="attrs-root">
            {attrs.map((txt, i) => (
              <div key={i} className="attr-chip">
                <input
                  className="attr-input"
                  value={txt}
                  onChange={(e) => changeAttr(i, e.target.value)}
                  maxLength={30}
                  placeholder="Атрибут"
                />
                <button
                  className="attr-del"
                  type="button"
                  onClick={() => removeAttr(i)}
                  aria-label="Видалити атрибут"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="attr-add-btn"
              onClick={addAttrInline}
              disabled={!canAddAttr}
              aria-disabled={!canAddAttr}
              title={!canAddAttr ? 'Спочатку заповніть всі атрибути або досягнуто ліміт' : 'Додати атрибут'}
            >
              <span className="plus">+</span>
              <span>Додати атрибут</span>
            </button>
          </div>
        </div>

        {/* Цена — динамический top */}
        <div className="group-1047" style={{ top: `${priceTop}px` }}>
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

        {/* Категория — под ценой. Слайдер показывается по клику на стрелку */}
        <div className="group-1046" style={{ top: `${catTop}px` }}>
          <div className="rectangle-cat">
            <input
              list="categories-datalist"
              className="cat-input"
              placeholder="Категорія"
              aria-label="Категорія"
              value={catInput}
              onChange={(e) => onCatChange(e.target.value)}
              onBlur={commitCategory}
            />
            <button
              type="button"
              className="cat-toggle"
              aria-label={catSliderOpen ? 'Сховати категорії' : 'Показати категорії'}
              onClick={() => setCatSliderOpen(v => !v)}
            >
              {catSliderOpen ? '˄' : '˅'}
            </button>
            <datalist id="categories-datalist">
              {_categories.map(c => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>

          {catSliderOpen && (
            <div className="cat-slider">
              <button
                type="button"
                className="cat-nav"
                onClick={() => scrollCats(-1)}
                aria-label="Вліво"
              >‹</button>

              <div className="cat-viewport">
                <div className="cat-track" ref={catTrackRef}>
                  {catalogItems.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      className={
                        'cat-chip' +
                        (catInput.toLowerCase() === item.title.toLowerCase() ? ' is-active' : '')
                      }
                      onClick={() => onPickCategory(item.title)}
                      title={item.title}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="cat-nav"
                onClick={() => scrollCats(1)}
                aria-label="Вправо"
              >›</button>
            </div>
          )}
        </div>

        {/* Магазин / Бренд — сдвигаются вниз синхронно с высотой атрибутов */}
        <div className="shop-label" style={{ top: `${shopLabelTop}px` }}>Магазин</div>
        <div className="group-683" style={{ top: `${shopTop}px` }}>
          <div className="seller-frame" />
          <div className="seller-title">{shopName || 'Мій магазин'}</div>
          <div className="seller-link">
            <button type="button" className="seller-link-text" onClick={() => navigate(shopLink)}>
              Перейти до магазину
            </button>
            <img className="seller-link-icon" src={arrowGreen} alt="" />
          </div>
        </div>

        <div className="frame-736" style={{ top: `${brandTop}px` }}>
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

        {/* Опис */}
        <div className="rectangle-201">
          <textarea
            className="desc-input"
            aria-label="Опис товару"
            placeholder="*Про товар"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Публикация */}
        <button
          id="publish-btn"
          className="publish-btn"
          type="button"
          onClick={submit}
          disabled={
            saving ||
            !title.trim() ||
            !String(catInput).trim() ||   // категория обязательна, но не требуем точного совпадения с API
            priceNumber < 0
          }
        >
          {saving ? 'Збереження…' : 'Опублікувати товар'}
        </button>

        {err && (
          <div style={{ position: 'absolute', left: 635, top: 1295, color: '#d00' }}>{err}</div>
        )}
      </div>

      {/* Модалка бренда */}
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
