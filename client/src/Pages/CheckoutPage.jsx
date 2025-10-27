// client/src/Pages/CheckoutPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Hooks/useAuth";
import { useTranslation } from "react-i18next";
import { useCurrency } from "../contexts/CurrencyContext.jsx";
import "../Styles/CheckoutPage.css";

import arrow from "../assets/planex.png";
import editIcon from "../assets/edit.png";

export default function CheckoutPage() {
  const API = process.env.REACT_APP_API || "";
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const { convertFromUAH, formatMoney } = useCurrency();

  const [open, setOpen] = useState(null);

  // form 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // form 2
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [addr, setAddr] = useState("");
  const [zip, setZip] = useState("");
  const [courier, setCourier] = useState(false);

  const [countrySuggest, setCountrySuggest] = useState([]);
  const [citySuggest, setCitySuggest] = useState([]);
  const [csOpen, setCsOpen] = useState(false);
  const [ctOpen, setCtOpen] = useState(false);
  const [csActive, setCsActive] = useState(-1);
  const [ctActive, setCtActive] = useState(-1);
  const [countryCode, setCountryCode] = useState("");

  /* ===== Helpers for multilingual names ===== */
  const hasLetters = (s = "") => /[A-Za-z\u0400-\u04FF]/.test(s);
  const isCyr = (s = "") => /[\u0400-\u04FF]/.test(s);
  const hasCyrillic = (s = "") => /[\u0400-\u04FF]/.test(s);
  const norm = (s = "") =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  // Латиница -> українська (для UI подсказок)
  function lat2uaDisplay(s = "") {
    let t = String(s || "");
    // длинные сочетания (порядок важен)
    t = t.replace(/shch/gi, (m) => (m[0] === "S" ? "Щ" : "щ"));
    t = t.replace(/zh/gi, (m) => (m[0] === "Z" ? "Ж" : "ж"));
    t = t.replace(/kh/gi, (m) => (m[0] === "K" ? "Х" : "х"));
    t = t.replace(/ch/gi, (m) => (m[0] === "C" ? "Ч" : "ч"));
    t = t.replace(/sh/gi, (m) => (m[0] === "S" ? "Ш" : "ш"));
    t = t.replace(/yi/gi, (m) => (m[0] === "Y" ? "Ї" : "ї"));
    t = t.replace(/ye/gi, (m) => (m[0] === "Y" ? "Є" : "є"));
    t = t.replace(/yu/gi, (m) => (m[0] === "Y" ? "Ю" : "ю"));
    t = t.replace(/ya/gi, (m) => (m[0] === "Y" ? "Я" : "я"));
    // одиночные
    const one = {
      a: "А", b: "Б", v: "В", h: "Г", g: "Ґ", d: "Д", e: "Е", z: "З", y: "И", i: "І",
      k: "К", l: "Л", m: "М", n: "Н", o: "О", p: "П", r: "Р", s: "С", t: "Т", u: "У",
      f: "Ф", c: "Ц", j: "Й"
    };
    Object.keys(one).forEach((k) => {
      const re = new RegExp(k, "g");
      const reU = new RegExp(k.toUpperCase(), "g");
      t = t.replace(re, one[k].toLowerCase());
      t = t.replace(reU, one[k]);
    });
    return t;
  }

  // Извлечь лучший украинский/локальный лейбл из разных форматов объектов
  function pickUAName(obj, { preferCyrillic = false } = {}) {
    if (!obj || typeof obj !== "object") return "";
    const direct =
      obj.localName || obj.ua || obj.uk || obj.ukrainian ||
      obj.native || obj.nativeName || obj.name_uk || obj.nameUk ||
      obj.name_local || obj.local || obj.nameLocal;

    const fromTrans =
      (obj.translations && (obj.translations.uk || obj.translations.ua)) ||
      (obj.translation && (obj.translation.uk || obj.translation.ua));

    // geonames-like: alternateNames: [{lang:'uk', name:'Харків'}, ...]
    let fromAlt = "";
    const alt = obj.alternateNames || obj.alternatenames || obj.alt || obj.names;
    if (Array.isArray(alt)) {
      const hit =
        alt.find(a => (a.lang || a.language || a.code) === "uk") ||
        alt.find(a => (a.lang || a.language || a.code) === "ukr") ||
        alt.find(a => isCyr(a.name || a.value));
      if (hit) fromAlt = hit.name || hit.value || "";
    }

    const options = [direct, fromTrans, fromAlt, obj.name].filter(Boolean);
    const cyrFirst = preferCyrillic
      ? [...options.filter(isCyr), ...options.filter(x => !isCyr(x))]
      : options;

    return (cyrFirst[0] || "").toString();
  }

  // Как показывать в UI
  function uaLabel(o) {
    const base =
      o.localName || o.label || o.uk || o.ua || o.name_uk || o.nameUk ||
      o.native || o.nativeName || o.name || "";

    // Если выбрана Украина и пользователь вводит кириллицей — отображаем на укр.
    if (countryCode === "UA" && hasCyrillic(city)) {
      if (hasCyrillic(base)) return base;
      return lat2uaDisplay(base);
    }
    return base;
  }

  const isUkraineSelected = () => {
    const byCode = (countryCode || "").toUpperCase() === "UA";
    const byTitle = /(^|\b)україна\b/i.test((country || "").trim());
    return byCode || byTitle;
  };

  const debounceRef = React.useRef({});
  const abortRef = React.useRef({ country: null, city: null });
  const runDebounced = (key, fn, ms = 260) => {
    clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(fn, ms);
  };

  async function safeFetch(kind, url) {
    try {
      if (!abortRef.current) abortRef.current = {};
      if (abortRef.current[kind]) abortRef.current[kind].abort();
      const controller = new AbortController();
      abortRef.current[kind] = controller;

      const r = await fetch(url, { signal: controller.signal });
      if (!r.ok) return { ok: false, data: null };
      const j = await r.json();
      return { ok: true, data: j };
    } catch (e) {
      if (e.name === "AbortError") return { ok: false, data: null };
      return { ok: false, data: null };
    } finally {
      abortRef.current[kind] = null;
    }
  }

  /* ===== Countries ===== */
  function handleCountryInput(v) {
    setCountry(v);
    setZip("");
    setCity("");
    setCountryCode("");
    setCitySuggest([]);
    setCtOpen(false);
    if (!v.trim()) { setCountrySuggest([]); setCsOpen(false); return; }

    runDebounced("country", async () => {
      try {
        const q = v.trim();
        const { ok, data } = await safeFetch(
          "country",
          `${API}/api/geo/countries?query=${encodeURIComponent(q)}&lang=auto`
        );
        let list = ok && Array.isArray(data) ? data : [];

        if (!list.length && hasLetters(q)) {
          const rAll = await safeFetch("country", `${API}/api/geo/countries?query=&lang=auto`);
          const all = rAll.ok && Array.isArray(rAll.data) ? rAll.data : [];
          const nq = norm(q);
          list = all.filter(c => {
            const names = [c.localName, c.ua, c.uk, c.native, c.name, c.label]
              .filter(Boolean).map(norm);
            return names.some(n => n.startsWith(nq));
          });
        }

        setCountrySuggest(list.slice(0, 12));
        setCsOpen(list.length > 0);
        setCsActive(-1);
      } catch {
        setCountrySuggest([]); setCsOpen(false);
      }
    });
  }

  async function selectCountry(c) {
    setCountry(uaLabel(c));
    setCountryCode(c.code);
    setCsOpen(false);
    setCountrySuggest([]);
    setCity("");
    setZip("");
    try {
      const { ok, data } = await safeFetch(
        "city",
        `${API}/api/geo/cities?country=${encodeURIComponent(c.code)}&query=&lang=${c.code === "UA" ? "uk" : "auto"}`
      );
      setCitySuggest(ok && Array.isArray(data) ? data.slice(0, 12) : []);
    } catch { setCitySuggest([]); }
  }

  /* ===== Cities ===== */
  function handleCityInput(v) {
    setCity(v);
    setZip("");

    const code = countryCode;
    if (!code && !country.trim()) {
      setCitySuggest([]);
      setCtOpen(false);
      return;
    }

    runDebounced("city", async () => {
      try {
        const q = v.trim();
        if (q.length < 1) { setCitySuggest([]); setCtOpen(false); return; }

        const isCyrInput = /[\u0400-\u04FF]/.test(q);
        const langParam = (code === "UA") || isCyrInput || (i18n.language || "").startsWith("uk")
          ? "uk" : "en";

        const url = code
          ? `${API}/api/geo/cities?country=${encodeURIComponent(code)}&query=${encodeURIComponent(q)}&lang=${langParam}&v=2`
          : `${API}/api/geo/cities?countryName=${encodeURIComponent(country.trim())}&query=${encodeURIComponent(q)}&lang=${langParam}&v=2`;

        // основной вызов
        let { ok, data } = await safeFetch("city", url);
        let list = ok && Array.isArray(data) ? data : [];

        // «второй шанс» для кириллицы — локальная фильтрация полного списка
        if ((list.length === 0 ||
             list.every(x => !/[\u0400-\u04FF]/.test(String(x.label || x.localName || ""))))
            && isCyrInput) {
          const urlAll = code
            ? `${API}/api/geo/cities?country=${encodeURIComponent(code)}&query=&lang=${langParam}&v=2`
            : `${API}/api/geo/cities?countryName=${encodeURIComponent(country.trim())}&query=&lang=${langParam}&v=2`;

          const rAll = await safeFetch("city", urlAll);
          const all = rAll.ok && Array.isArray(rAll.data) ? rAll.data : [];

          const nq = norm(q);
          const uaTranslitPrefix = (s = "") => {
            const map = {
              а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ye",
              ж: "zh", з: "z", и: "y", і: "i", ї: "yi", й: "i", к: "k", л: "l",
              м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
              ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ю: "yu",
              я: "ya", ь: "", "’": "", "'": ""
            };
            let out = "";
            for (const ch of (s || "").toLowerCase()) out += map[ch] ?? ch;
            return out;
          };
          const qlat = uaTranslitPrefix(nq);

          list = all.filter(ct => {
            const bucket = [
              ct.label, ct.localName, ct.ua, ct.uk, ct.ukrainian, ct.native,
              ct.nativeName, ct.name_uk, ct.nameUk, ct.name_local, ct.local,
              ct.nameLocal, ct.name
            ];
            if (ct?.translations) {
              if (ct.translations.uk) bucket.push(ct.translations.uk);
              if (ct.translations.ua) bucket.push(ct.translations.ua);
            }
            const alt = ct?.alternateNames || ct?.alternatenames || ct?.alt || ct?.names;
            if (Array.isArray(alt)) alt.forEach(a => bucket.push(a?.name || a?.value));

            const normalized = bucket.filter(Boolean).map(norm);
            return normalized.some(n =>
              n.startsWith(nq) || n.startsWith(qlat) || (nq.length <= 2 && n.includes(nq))
            );
          });
        }

        setCitySuggest(list.slice(0, 12));
        setCtOpen(list.length > 0);
        setCtActive(-1);
      } catch {
        setCitySuggest([]);
        setCtOpen(false);
      }
    });
  }

  async function selectCity(ct) {
    setCity(uaLabel(ct));
    setCtOpen(false);
    setCitySuggest([]);
    try {
      const code = countryCode || ct.countryCode || "";
      const r = await fetch(code
        ? `${API}/api/geo/postal?country=${encodeURIComponent(code)}&city=${encodeURIComponent(uaLabel(ct))}&lang=uk`
        : `${API}/api/geo/postal?countryName=${encodeURIComponent(country.trim())}&city=${encodeURIComponent(uaLabel(ct))}&lang=uk`
      );
      const data = r.ok ? await r.json() : null;
      if (data && data.postal) setZip(data.postal);
    } catch { /* ignore */ }
  }

  function onCountryKey(e) {
    if (!csOpen) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCsActive(i => Math.min((i < 0 ? 0 : i + 1), countrySuggest.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCsActive(i => Math.max((i <= 0 ? 0 : i - 1), 0)); }
    if (e.key === "Enter")   { e.preventDefault(); if (countrySuggest[csActive]) selectCountry(countrySuggest[csActive]); }
    if (e.key === "Escape")  { setCsOpen(false); }
  }
  function onCityKey(e) {
    if (!ctOpen) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCtActive(i => Math.min((i < 0 ? 0 : i + 1), citySuggest.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCtActive(i => Math.max((i <= 0 ? 0 : i - 1), 0)); }
    if (e.key === "Enter")     { e.preventDefault(); if (citySuggest[ctActive]) selectCity(citySuggest[ctActive]); }
    if (e.key === "Escape")    { setCtOpen(false); }
  }

  useEffect(() => {
    function onDocClick(e) {
      const el = e.target;
      if (!el.closest) return;
      if (!el.closest(".geo-field")) { setCsOpen(false); setCtOpen(false); }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // form 3
  const [cardNumber, setCardNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");

  const [summary, setSummary] = useState({ items: [], subtotalUAH: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { user: authUser } = useAuth() || {};

  const safePick = (o, path) => (path || "").split(".").reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), o);
  const readLS = (k) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
  };

  async function fetchAny(urls) {
    for (const u of urls) {
      try {
        const r = await fetch(u, { credentials: "include" });
        if (r.ok) return await r.json();
      } catch {}
    }
    return null;
  }

  function prefillFromAuth() {
    if (!authUser) return;
    const fn = authUser.first_name || authUser.firstName || safePick(authUser, "profile.first_name") || safePick(authUser, "user.first_name");
    const ln = authUser.last_name || authUser.lastName || safePick(authUser, "profile.last_name") || safePick(authUser, "user.last_name");
    const em = authUser.email || safePick(authUser, "profile.email") || safePick(authUser, "user.email");
    const ph = authUser.phone || authUser.phone_number || safePick(authUser, "profile.phone") || safePick(authUser, "user.phone");
    if (!firstName && fn) setFirstName(fn);
    if (!lastName && ln) setLastName(ln);
    if (!email && em) setEmail(em);
    if (!phone && ph) setPhone(ph);
  }

  function prefillFromLocalStorage() {
    const candidates = [readLS("qonto.profile"), readLS("qonto_user"), readLS("profile"), readLS("auth"), readLS("user")].filter(Boolean);
    for (const c of candidates) {
      const fn = safePick(c, "first_name") || safePick(c, "firstName") || safePick(c, "profile.first_name") || safePick(c, "user.first_name");
      const ln = safePick(c, "last_name") || safePick(c, "lastName") || safePick(c, "profile.last_name") || safePick(c, "user.last_name");
      const em = safePick(c, "email") || safePick(c, "profile.email") || safePick(c, "user.email");
      const ph = safePick(c, "phone") || safePick(c, "user.phone") || safePick(c, "profile.phone");
      if (!firstName && fn) setFirstName(fn);
      if (!lastName && ln) setLastName(ln);
      if (!email && em) setEmail(em);
      if (!phone && ph) setPhone(ph);
      if (firstName && lastName && email && phone) break;
    }

    const addrs = readLS("addresses");
    if (Array.isArray(addrs) && addrs.length) {
      const a0 = addrs[0];
      if (!country) setCountry(a0.country || country || "");
      if (!city) setCity(a0.city || city || "");
      if (!zip) setZip(a0.postal || a0.zip || zip || "");
    }

    const cards = readLS("cards");
    if (Array.isArray(cards) && cards[0]?.number && !cardNumber) {
      setCardNumber(String(cards[0].number));
    }
  }

  useEffect(() => { prefillFromAuth(); }, [authUser]);

  useEffect(() => {
    prefillFromLocalStorage();

    (async () => {
      if (!firstName || !lastName || !email || !phone) {
        const prof = await fetchAny(["/api/me", "/api/profile", "/auth/me", "/users/me"]);
        if (prof) {
          const fn = safePick(prof, "first_name") || safePick(prof, "firstName") || safePick(prof, "user.first_name");
          const ln = safePick(prof, "last_name") || safePick(prof, "lastName") || safePick(prof, "user.last_name");
          const em = safePick(prof, "email") || safePick(prof, "user.email");
          const ph = safePick(prof, "phone") || safePick(prof, "user.phone");
          if (!firstName && fn) setFirstName(fn);
          if (!lastName && ln) setLastName(ln);
          if (!email && em) setEmail(em);
          if (!phone && ph) setPhone(ph);
        }
      }

      if (!country || !city || !addr || !zip) {
        const a = await fetchAny(["/api/addresses", "/addresses", "/user/addresses"]);
        if (Array.isArray(a) && a.length) {
          const x = a[0];
          if (!country && x.country) setCountry(x.country);
          if (!city && x.city) setCity(x.city);
          if (!zip && (x.postal || x.zip)) setZip(x.postal || x.zip);
        }
      }

      if (!cardNumber) {
        const c = await fetchAny(["/api/cards", "/cards", "/payment/cards"]);
        if (Array.isArray(c) && c[0]?.number) {
          setCardNumber(String(c[0].number));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { document.title = t("checkout.title", "Оформлення замовлення"); }, [t]);

  useEffect(() => {
    document.body.classList.toggle("f314-open", open === "p1");
    document.body.classList.toggle("f312-open", open === "p2");
    document.body.classList.toggle("f313-open", open === "p3");
    return () => {
      document.body.classList.remove("f314-open", "f312-open", "f313-open");
    };
  }, [open]);

  useEffect(() => {
    (async () => {
      try {
        setError("");
        const r = await fetch(`${API}/api/cart`, { credentials: "include" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.message || t("errors.generic", "Сталася помилка"));

        const items = Array.isArray(d.items) ? d.items : [];
        const subtotalUAH = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
        setSummary({ items, subtotalUAH });
      } catch (e) {
        setError(e.message || t("errors.serverUnavailable", "Сервер тимчасово недоступний"));
        setSummary({ items: [], subtotalUAH: 0 });
      }
    })();
  }, [API, t]);

  const p1Filled = firstName.trim() && lastName.trim() && phone.trim() && email.trim();
  const p2Filled = country.trim() && city.trim() && addr.trim() && zip.trim();
  const p3Filled = cardNumber.trim() && exp.trim() && cvc.trim();
  const canSubmit = p1Filled && p2Filled && p3Filled && summary.items.length > 0;

  const shippingUAH = courier ? 120 : 0;
  const discountUAH = 0;
  const totalUAH = Math.max(0, summary.subtotalUAH + shippingUAH - discountUAH);

  const fmt = (uah) => formatMoney(convertFromUAH(uah || 0));

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    try {
      const address = { country, city, street: addr, postal: zip, firstName, lastName, phone, email, courier };
      const payment = { cardNumber, exp, cvc };

      const r = await fetch(`${API}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address, payment }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || t("checkout.errors.paymentFailed", "Оплата не пройшла"));

      alert(t("checkout.orderPaid", "Замовлення оплачено") + (d.order_id ? ` (#${d.order_id})` : ""));
      nav("/");
    } catch (e) {
      setError(e.message || t("checkout.errors.submitFailed", "Не вдалося оформити замовлення"));
    } finally {
      setLoading(false);
    }
  }

  const getImg = (it) =>
    it.image_url || it.image || it.product?.image_url || it.product?.image || "/static/placeholder.png";
  const getTitle = (it) =>
    it.title || it.product?.title || it.name || t("common.unknown", "Без назви");
  const getLink = (it) => `/product/${it.product_id || it.id || it.product?.id || ""}`;
  const getQty = (it) => Number(it.qty) || 1;
  const getPriceUAH = (it) => Number(it.price) || Number(it.product?.price) || 0;

  return (
    <>
      <div className="group-154">
        <div className="group-20">
          <img className="title-icon" src={arrow} alt="" />
          <h3 className="title-h3">{t("checkout.title", "Оформлення замовлення")}</h3>
        </div>
      </div>

      <div className="group-491">
        <div className="rect-66">
          <div className="cart-scroll">
            {summary.items.map((it, i) => {
              const base = 48.74;
              const step = 107.55;
              const top = base + i * step;

              return (
                <div
                  key={(it.id ?? it.product_id ?? i) + "_row"}
                  className={i === 0 ? "group-305 product-item"
                    : i === 1 ? "group-504 product-item"
                      : "group-505 product-item"}
                  style={{ top }}
                >
                  <div className={i === 0 ? "rect-54" : i === 1 ? "rect-54-2" : "rect-54-3"}>
                    <img
                      className={i === 0 ? "rect-54-img" : i === 1 ? "rect-54-2-img" : "rect-54-3-img"}
                      src={getImg(it)}
                      alt=""
                    />
                  </div>

                  <span className={i === 0 ? "prod-qty" : i === 1 ? "prod-qty-2" : "prod-qty-3"}>
                    х{getQty(it)}
                  </span>

                  <a className={i === 0 ? "prod-title" : i === 1 ? "prod-title-2" : "prod-title-3"} href={getLink(it)}>
                    {getTitle(it)}
                  </a>

                  <span className={i === 0 ? "prod-price" : i === 1 ? "prod-price-2" : "prod-price-3"}>
                    {fmt(getQty(it) * getPriceUAH(it))}
                  </span>
                  {Number(it.old_price) > 0 && (
                    <span className={i === 0 ? "prod-old-price" : i === 1 ? "prod-old-price-2" : "prod-old-price-3"}>
                      {fmt(getQty(it) * Number(it.old_price))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="group-290">
            <span className="txt-290-left">{t("checkout.goods", "Товари")}</span>
            <span className="txt-290-right">{fmt(summary.subtotalUAH)}</span>
          </div>
          <div className="group-289">
            <span className="txt-289-left">{t("checkout.discount", "Знижка")}</span>
            <span className="txt-289-right">{discountUAH ? "-" + fmt(discountUAH) : fmt(0)}</span>
          </div>
          <div className="group-287">
            <span className="txt-287-left">{t("checkout.shipping", "Доставка")}</span>
            <span className="txt-287-right">{fmt(shippingUAH)}</span>
          </div>

          <div className="group-286">
            <span className="total-label">{t("checkout.total", "Всього")}</span>
            <span className="total-value">{fmt(totalUAH)}</span>
          </div>

          <div className="group-308">
            <button
              id="continue-btn"
              className="rect-53"
              type="button"
              disabled={!canSubmit || loading}
              onClick={submit}
              aria-disabled={!canSubmit || loading}
            >
              {loading ? t("checkout.paying", "Оплата…") : t("checkout.confirm", "Підтвердити")}
            </button>
          </div>
        </div>
      </div>

      <div className="frame-314">
        <button
          type="button"
          className={"rect-70-btn" + ((open === "p1" || p1Filled) ? " is-active" : "")}
          aria-pressed={open === "p1"}
          onClick={() => setOpen(open === "p1" ? null : "p1")}
        >
          <img className="delivery-icon" src={editIcon} alt="" />
          <h4 className="delivery-title">{t("checkout.person.h", "Персонафікація")}</h4>
          <p className="delivery-sub">{t("checkout.person.sub", "Введіть дані одержувача")}</p>
        </button>
      </div>

      <div className="rect-73">
        <div className="f314-g324">
          <input className="f314-input" type="text" placeholder="*Ім’я" value={firstName} onChange={e => setFirstName(e.target.value)} />
        </div>
        <div className="f314-g326">
          <input className="f314-input" type="text" placeholder="*Номер" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div className="f314-g325">
          <input className="f314-input" type="text" placeholder="*Прізвище" value={lastName} onChange={e => setLastName(e.target.value)} />
        </div>
        <div className="f314-g327">
          <input className="f314-input" type="email" placeholder="*Електронна пошта" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="frame-312">
        <button
          type="button"
          className={"rect-70-btn" + ((open === "p2" || p2Filled) ? " is-active" : "")}
          aria-pressed={open === "p2"}
          onClick={() => setOpen(open === "p2" ? null : "p2")}
        >
          <img className="delivery-icon" src={editIcon} alt="" />
          <h4 className="delivery-title">{t("checkout.delivery.h", "Спосіб доставки")}</h4>
          <p className="delivery-sub">{t("checkout.delivery.sub", "Вибрати спосіб і адрес доставки")}</p>
        </button>
      </div>

      <div className="rect-71">
        <div className="r71-g312 geo-field">
          <input
            className="f312-input"
            type="text"
            placeholder="*Країна"
            value={country}
            onChange={e => handleCountryInput(e.target.value)}
            onKeyDown={onCountryKey}
            onFocus={() => { if (countrySuggest.length) setCsOpen(true); }}
            autoComplete="off"
          />
          {csOpen && !!countrySuggest.length && (
            <ul className="suggest-list">
              {countrySuggest.map((c, i) => (
                <li
                  key={c.code}
                  className={"suggest-item" + (i === csActive ? " is-active" : "")}
                  onMouseDown={() => selectCountry(c)}
                >{uaLabel(c)}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="r71-g313 geo-field">
          <input
            className="f312-input"
            type="text"
            placeholder="*Місто"
            value={city}
            onChange={e => handleCityInput(e.target.value)}
            onKeyDown={onCityKey}
            onFocus={() => { if (citySuggest.length) setCtOpen(true); }}
            autoComplete="off"
          />
          {ctOpen && !!citySuggest.length && (
            <ul className="suggest-list">
              {citySuggest.map((c, i) => (
                <li
                  key={c.id || c.name}
                  className={"suggest-item" + (i === ctActive ? " is-active" : "")}
                  onMouseDown={() => selectCity(c)}
                >{uaLabel(c)}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="r71-g314">
          <input className="f312-input" type="text" placeholder="*Адрес" value={addr} onChange={e => setAddr(e.target.value)} />
        </div>
        <div className="r71-g315">
          <input className="f312-input" type="text" placeholder="*Індекс" value={zip} onChange={e => setZip(e.target.value)} />
        </div>

        <div className="r71-courier">
          <button
            type="button"
            className="courier-toggle"
            aria-pressed={courier ? "true" : "false"}
            onClick={() => setCourier(v => !v)}
          />
          <span className="courier-label">{t("checkout.delivery.courier", "Кур’єр")}</span>
          <span className="courier-price">+120</span>
        </div>
      </div>

      <div className="frame-313">
        <button
          type="button"
          className={"rect-70-btn" + ((open === "p3" || p3Filled) ? " is-active" : "")}
          aria-pressed={open === "p3"}
          onClick={() => setOpen(open === "p3" ? null : "p3")}
        >
          <img className="delivery-icon" src={editIcon} alt="" />
          <h4 className="delivery-title">{t("checkout.payment.h", "Оплата")}</h4>
          <p className="delivery-sub">{t("checkout.payment.sub", "Вибрати спосіб оплати")}</p>
        </button>
      </div>

      <div className="rect-72">
        <div className="r72-g321">
          <input className="f313-input" type="text" placeholder="*Номер картки" value={cardNumber} onChange={e => setCardNumber(e.target.value)} />
        </div>
        <div className="r72-g322">
          <input className="f313-input" type="text" placeholder="мм/рр" value={exp} onChange={e => setExp(e.target.value)} />
        </div>
        <div className="r72-g323">
          <input className="f313-input" type="text" placeholder="CCV" value={cvc} onChange={e => setCvc(e.target.value)} />
        </div>
      </div>
    </>
  );
}
