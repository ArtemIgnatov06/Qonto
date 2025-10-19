// client/src/Pages/CheckoutPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCurrency } from "../contexts/CurrencyContext.jsx";
import "../Styles/make-order.css";

import arrow from "../assets/planex.png";
import editIcon from "../assets/edit.png";

export default function CheckoutPage() {
  const API = process.env.REACT_APP_API || "";
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const { convertFromUAH, formatMoney } = useCurrency();

  // какая панель открыта (как в макете-аккордеоне)
  const [open, setOpen] = useState(null); // 'p1' | 'p2' | 'p3' | null

  // форма 1 — персонализация
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [email,     setEmail]     = useState("");

  // форма 2 — доставка
  const [country, setCountry] = useState("");
  const [city,    setCity]    = useState("");
  const [addr,    setAddr]    = useState("");
  const [zip,     setZip]     = useState("");
  const [courier, setCourier] = useState(false); // +120 UAH

  // форма 3 — оплата
  const [cardNumber, setCardNumber] = useState("");
  const [exp,        setExp]        = useState("");
  const [cvc,        setCvc]        = useState("");

  // корзина/итоги
  const [summary, setSummary] = useState({ items: [], subtotalUAH: 0 });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // локаль для строк (валюта — через CurrencyContext)
  const locale = useMemo(
    () => (i18n.language?.startsWith("ua") || i18n.language?.startsWith("uk") ? "uk-UA" : "ru-RU"),
    [i18n.language]
  );

  // заголовок
  useEffect(() => { document.title = t("checkout.title", "Оформлення замовлення"); }, [t]);

  // служебные классы на <body> — для анимаций панелей в CSS
  useEffect(() => {
    document.body.classList.toggle("f314-open", open === "p1");
    document.body.classList.toggle("f312-open", open === "p2");
    document.body.classList.toggle("f313-open", open === "p3");
    return () => {
      document.body.classList.remove("f314-open","f312-open","f313-open");
    };
  }, [open]);

  // загрузка корзины с бэка
  useEffect(() => {
    (async () => {
      try {
        setError("");
        const r = await fetch(`${API}/api/cart`, { credentials: "include" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.message || t("errors.generic", "Сталася помилка"));

        const items = Array.isArray(d.items) ? d.items : [];
        const subtotalUAH = items.reduce((s, it) => s + (Number(it.qty)||0)*(Number(it.price)||0), 0);
        setSummary({ items, subtotalUAH });
      } catch (e) {
        setError(e.message || t("errors.serverUnavailable", "Сервер тимчасово недоступний"));
        setSummary({ items: [], subtotalUAH: 0 });
      }
    })();
  }, [API, t]);

  // заполненность блоков
  const p1Filled = firstName.trim() && lastName.trim() && phone.trim() && email.trim();
  const p2Filled = country.trim() && city.trim() && addr.trim() && zip.trim();
  const p3Filled = cardNumber.trim() && exp.trim() && cvc.trim();
  const canSubmit = p1Filled && p2Filled && p3Filled && summary.items.length > 0;

  // суммы
  const shippingUAH = courier ? 120 : 0;
  const discountUAH = 0;
  const totalUAH    = Math.max(0, summary.subtotalUAH + shippingUAH - discountUAH);

  // форматирование валюты (выбор из контекста)
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

      alert(
        t("checkout.orderPaid", "Замовлення оплачено") +
        (d.order_id ? ` (#${d.order_id})` : "")
      );
      nav("/");
    } catch (e) {
      setError(e.message || t("checkout.errors.submitFailed", "Не вдалося оформити замовлення"));
    } finally {
      setLoading(false);
    }
  }

  // безопасные геттеры из item
  const getImg = (it) =>
    it.image_url || it.image || it.product?.image_url || it.product?.image || "/static/placeholder.png";
  const getTitle = (it) =>
    it.title || it.product?.title || it.name || t("common.unknown", "Без назви");
  const getLink = (it) => `/product/${it.product_id || it.id || it.product?.id || ""}`;
  const getQty = (it) => Number(it.qty) || 1;
  const getPriceUAH = (it) => Number(it.price) || Number(it.product?.price) || 0;

  return (
    <>
      {/* Заголовок слева */}
      <div className="group-154">
        <div className="group-20">
          <img className="title-icon" src={arrow} alt="" />
          <h3 className="title-h3">{t("checkout.title", "Оформлення замовлення")}</h3>
        </div>
      </div>

      {/* ПРАВЫЙ ФИКС-блок: итоги + ТОВАРЫ ниже */}
      <div className="group-491">
        <div className="rect-66">
          {/* список товаров (карточки опустили ниже через CSS .cart-scroll { top: 64px } ) */}
          <div className="cart-scroll">
            {summary.items.map((it, i) => {
              // вычислим вертикаль под наш «пиксельный» абсолют
              const base = 48.74;       // px для первой строки
              const step = 107.55;      // расстояние между строками
              const top = base + i * step;

              return (
                <div
                  key={(it.id ?? it.product_id ?? i) + "_row"}
                  className={i === 0 ? "group-305 product-item"
                            : i === 1 ? "group-504 product-item"
                            : "group-505 product-item"}
                  style={{ top }}                               // позиция внутри cart-scroll
                >
                  {/* превью */}
                  <div className={i === 0 ? "rect-54" : i === 1 ? "rect-54-2" : "rect-54-3"}>
                    <img
                      className={i === 0 ? "rect-54-img" : i === 1 ? "rect-54-2-img" : "rect-54-3-img"}
                      src={getImg(it)}
                      alt=""
                    />
                  </div>

                  {/* количество */}
                  <span className={i === 0 ? "prod-qty" : i === 1 ? "prod-qty-2" : "prod-qty-3"}>
                    х{getQty(it)}
                  </span>

                  {/* название (ссылка на товар) */}
                  <a className={i === 0 ? "prod-title" : i === 1 ? "prod-title-2" : "prod-title-3"} href={getLink(it)}>
                    {getTitle(it)}
                  </a>

                  {/* цены */}
                  <span className={i === 0 ? "prod-price" : i === 1 ? "prod-price-2" : "prod-price-3"}>
                    {fmt(getQty(it) * getPriceUAH(it))}
                  </span>
                  {/* старая цена — если есть */}
                  {Number(it.old_price) > 0 && (
                    <span className={i === 0 ? "prod-old-price" : i === 1 ? "prod-old-price-2" : "prod-old-price-3"}>
                      {fmt(getQty(it) * Number(it.old_price))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* подытоги и кнопка */}
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

      {/* ЛЕВЫЕ БЛОКИ (как в макете) */}
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
          <input className="f314-input" type="text" placeholder="*Ім’я" value={firstName} onChange={e=>setFirstName(e.target.value)} />
        </div>
        <div className="f314-g326">
          <input className="f314-input" type="text" placeholder="*Номер" value={phone} onChange={e=>setPhone(e.target.value)} />
        </div>
        <div className="f314-g325">
          <input className="f314-input" type="text" placeholder="*Прізвище" value={lastName} onChange={e=>setLastName(e.target.value)} />
        </div>
        <div className="f314-g327">
          <input className="f314-input" type="email" placeholder="*Електронна пошта" value={email} onChange={e=>setEmail(e.target.value)} />
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
        <div className="r71-g312">
          <input className="f312-input" type="text" placeholder="*Країна" value={country} onChange={e=>setCountry(e.target.value)} />
        </div>
        <div className="r71-g313">
          <input className="f312-input" type="text" placeholder="*Місто" value={city} onChange={e=>setCity(e.target.value)} />
        </div>
        <div className="r71-g314">
          <input className="f312-input" type="text" placeholder="*Адрес" value={addr} onChange={e=>setAddr(e.target.value)} />
        </div>
        <div className="r71-g315">
          <input className="f312-input" type="text" placeholder="*Індекс" value={zip} onChange={e=>setZip(e.target.value)} />
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
          <input className="f313-input" type="text" placeholder="*Номер картки" value={cardNumber} onChange={e=>setCardNumber(e.target.value)} />
        </div>
        <div className="r72-g322">
          <input className="f313-input" type="text" placeholder="мм/рр" value={exp} onChange={e=>setExp(e.target.value)} />
        </div>
        <div className="r72-g323">
          <input className="f313-input" type="text" placeholder="CCV" value={cvc} onChange={e=>setCvc(e.target.value)} />
        </div>
      </div>
    </>
  );
}
