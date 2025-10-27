// client/src/Pages/ModerCaseView.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../Styles/ModerCaseView.css";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";

import backArrow from "../assets/planex.png";
import fileIco from "../assets/upload.png";

/** Format date as DD.MM.YY HH:MM (без TS) */
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yy} ${hh}:${mi}`;
};

/** Avatar with initials fallback (без TS-типов) */
function Avatar({ src, name }) {
  if (src) return <img className="cv-badge__ava" src={src} alt="" />;
  const initials =
    (name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => (w && w[0] ? w[0].toUpperCase() : ""))
      .join("") || "??";
  return <span className="cv-badge__ava cv-ava-ph">{initials}</span>;
}

export default function ModerCaseView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [query] = useSearchParams();
  const location = useLocation();
  const hint = (location && location.state) || {}; // fallback из списка
  const kind = query.get("type") === "complaint" ? "complaint" : "request";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // { key, src } | null
  const [checked, setChecked] = useState({}); // просмотренные документы

  const endpoint = useMemo(
    () =>
      kind === "complaint"
        ? `/api/moder/cases/complaints/${id}`
        : `/api/moder/cases/requests/${id}`,
    [id, kind]
  );

  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(endpoint, { credentials: "include" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        if (!stop) setData(j);
      } catch (e) {
        if (!stop) setError("Не вдалося завантажити");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [endpoint]);

  // ------- user/store/product (максимально терпимые фоллбеки по ключам) -------
  const u = (data && (data.user || data.reporter)) || {};
  const fullName =
    hint.full_name ||
    [hint.first_name, hint.last_name].filter(Boolean).join(" ") ||
    hint.user_name ||
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    (data && (data.user_full_name || data.user_name)) ||
    "Користувач";

  const avatar =
    hint.avatar_url ||
    hint.photo ||
    hint.avatar ||
    u.avatar_url ||
    u.avatar ||
    u.photo ||
    (data && data.user_avatar) ||
    null;

  const store = (data && data.store) || {};
  const storeName =
    store.name ||
    (data && (data.store_name || data.shop_name || data.shop_title)) ||
    "Без назви";
  const storeAvatar =
    store.logo || store.avatar || (data && (data.store_logo || data.shop_logo)) || null;

  const createdDate = fmtDate(data && (data.created_at || data.createdAt));

  const product = (data && (data.product || data.goods)) || {};
  const productName = product.title || product.name || (data && data.product_name) || "";
  const productImg =
    product.image ||
    product.image_url ||
    product.photo ||
    (data && data.product_image) ||
    "";
  const productPrice =
    product.price_sale != null
      ? product.price_sale
      : product.price != null
      ? product.price
      : data && data.product_price != null
      ? data.product_price
      : null;
  const productRating =
    product.rating != null
      ? product.rating
      : product.rate != null
      ? product.rate
      : data && data.product_rating != null
      ? data.product_rating
      : null;

  const docs = (data && data.docs) || {};
  const registry = docs.registry_url || docs.registry || docs.registry_extract || null;
  const ipn = docs.ipn_url || docs.ipn || docs.tax_id || null;
  const passport = docs.passport_url || docs.passport || docs.passport_scan || null;
  const attach = docs.attachment || (data && (data.attachment || data.evidence)) || null;

  const reason =
    (data &&
      (data.reason || data.complaint_reason || data.category || data.reason_text)) ||
    "";

  const reporterPrevCount =
    (data && (data.reporter_prev_count ?? data.previous_complaints_count)) || 0;

  // ------- строки документов -------
  const fixedRows =
    kind === "complaint"
      ? [{ key: "attachment", label: "Додаток до скарги", src: attach }]
      : [
          { key: "registry_url", label: "Завантажена виписка з реєстру", src: registry },
          { key: "ipn_url", label: "Завантажений ІПН", src: ipn },
        ];

  const extraRows =
    kind === "complaint"
      ? []
      : passport
      ? [{ key: "passport_url", label: "Завантажений паспорт", src: passport }]
      : [];

  const allRows = [...fixedRows, ...extraRows];
  const allViewed = allRows.length > 0 && allRows.every((r) => !r.src || checked[r.key]);

  return (
    <main className="cv-page" role="main">
      <div className="cv-head">
        <button className="cv-back" type="button" onClick={() => navigate(-1)}>
          <img className="cv-back__ico" src={backArrow} alt="" aria-hidden="true" />
          <span className="cv-back__title">Заявки та скарги</span>
        </button>
      </div>

      <section
        className={`cv-card${kind === "complaint" ? " is-complaint" : ""}`}
        aria-busy={loading ? "true" : "false"}
      >
        <header className="cv-card__top">
          <div className="cv-left">
            <div className="cv-label">{kind === "complaint" ? "Скарга на" : "Заявка від"}</div>
            <div className="cv-badge cv-badge--store">
              <Avatar src={storeAvatar} name={storeName} />
              <span className="cv-badge__name">{storeName}</span>
            </div>
          </div>
          <div className="cv-time">{createdDate}</div>
        </header>

        {kind === "complaint" ? (
          <div className="cv-grid">
            {/* слева: карточка товара (если пришла) */}
            {productImg ? (
              <div className="cv-prod">
                <img className="cv-prod__img" src={productImg} alt={productName || ""} />
                <div className="cv-prod__meta">
                  {productName && <div className="cv-prod__title">{productName}</div>}
                  <div className="cv-prod__row">
                    {productPrice != null && <div className="cv-prod__price">{productPrice} грн</div>}
                    {productRating != null && <div className="cv-prod__rate">★ {Number(productRating).toFixed(1)}</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="cv-prod cv-prod--ph" aria-hidden="true" />
            )}

            {/* справа: причина + скаржник + документы + кнопки */}
            <div className="cv-col">
              <div className="cv-subtitle__title">Перевірити правдивість скарги</div>
              {reason && <div className="cv-reason">{reason}</div>}

              <div className="cv-report">
                <div className="cv-report__row">
                  <span className="cv-report__label">Скаржник:</span>
                  <span className="cv-report__val">{fullName}</span>
                </div>
                <div className="cv-report__row">
                  <span className="cv-report__label">Кількість попередніх скарг:</span>
                  <span className="cv-report__val">{reporterPrevCount}</span>
                </div>
              </div>

              {allRows.length > 0 && (
                <div className="cv-docs">
                  {allRows.map((r) => {
                    const isAvailable = !!r.src;
                    const done = !!checked[r.key];
                    const cls = "cv-doc" + (isAvailable ? "" : " is-disabled") + (done ? " is-done" : "");
                    return isAvailable ? (
                      <button
                        key={r.key}
                        type="button"
                        className={cls}
                        onClick={() => setPreview({ key: r.key, src: r.src })}
                      >
                        <span className="cv-doc__check" aria-hidden="true" />
                        <img className="cv-doc__ico" src={fileIco} alt="" aria-hidden="true" />
                        <span className="cv-doc__label">{r.label}</span>
                      </button>
                    ) : (
                      <div key={r.key} className={cls} aria-disabled="true">
                        <span className="cv-doc__check" aria-hidden="true" />
                        <img className="cv-doc__ico" src={fileIco} alt="" aria-hidden="true" />
                        <span className="cv-doc__label">{r.label} — не завантажено</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="cv-actions">
                <button
                  className="cv-btn cv-btn--ghost"
                  type="button"
                  disabled={!allViewed && allRows.length > 0}
                  onClick={async () => {
                    try {
                      const r = await fetch(
                        `/api/moder/cases/${kind === "complaint" ? "complaints" : "requests"}/${id}/approve`,
                        { method: "POST", credentials: "include" }
                      );
                      if (r.ok) navigate(-1);
                    } catch {}
                  }}
                >
                  {kind === "complaint" ? "Закрити скаргу" : "Підтвердити"}
                </button>

                {kind === "complaint" && (
                  <button className="cv-btn cv-btn--solid" type="button" disabled aria-disabled="true">
                    Видалити товар
                  </button>
                )}
              </div>

              {error && <div className="cv-error">{error}</div>}
            </div>
          </div>
        ) : (
          <>
            <div className="cv-subtitle">
              <div className="cv-subtitle__title">Перевірити правдивість заявки</div>
            </div>

            <div className="cv-field">
              <div className="cv-field__label">Назва магазину</div>
              <div className="cv-field__box">{storeName}</div>
            </div>

            <div className="cv-docs">
              {allRows.map((r) => {
                const isAvailable = !!r.src;
                const done = !!checked[r.key];
                const cls = "cv-doc" + (isAvailable ? "" : " is-disabled") + (done ? " is-done" : "");
                return isAvailable ? (
                  <button
                    key={r.key}
                    type="button"
                    className={cls}
                    onClick={() => setPreview({ key: r.key, src: r.src })}
                  >
                    <span className="cv-doc__check" aria-hidden="true" />
                    <img className="cv-doc__ico" src={fileIco} alt="" aria-hidden="true" />
                    <span className="cv-doc__label">{r.label}</span>
                  </button>
                ) : (
                  <div key={r.key} className={cls} aria-disabled="true">
                    <span className="cv-doc__check" aria-hidden="true" />
                    <img className="cv-doc__ico" src={fileIco} alt="" aria-hidden="true" />
                    <span className="cv-doc__label">{r.label} — не завантажено</span>
                  </div>
                );
              })}
            </div>

            <button
              className={"cv-confirm " + (allViewed ? "is-ready" : "")}
              type="button"
              disabled={!allViewed}
              onClick={async () => {
                try {
                  const r = await fetch(
                    `/api/moder/cases/${kind === "complaint" ? "complaints" : "requests"}/${id}/approve`,
                    { method: "POST", credentials: "include" }
                  );
                  if (r.ok) navigate(-1);
                } catch {}
              }}
            >
              Підтвердити
            </button>

            {error && <div className="cv-error">{error}</div>}
          </>
        )}
      </section>

      {preview && (
        <div className="cv-modal" role="dialog" aria-modal="true">
          <div
            className="cv-modal__backdrop"
            onClick={() => {
              setChecked((s) => ({ ...s, [preview.key]: true }));
              setPreview(null);
            }}
          />
          <div className="cv-modal__dialog">
            <button
              className="cv-modal__close"
              onClick={() => {
                setChecked((s) => ({ ...s, [preview.key]: true }));
                setPreview(null);
              }}
            >
              ×
            </button>
            <img className="cv-modal__img" src={preview.src} alt="" />
          </div>
        </div>
      )}
    </main>
  );
}
