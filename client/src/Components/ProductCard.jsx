// components/ProductCard.jsx
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext.jsx';

export default function ProductCard({ product, onBuy }) {
  const { t } = useTranslation(); // defaultNS: common
  const { convertFromUAH, formatMoney } = useCurrency();
  const { id, title, price, seller_name, category, preview_image_url } = product || {};

  // Готовим сумму в UAH (исходная), затем конвертируем и форматируем под выбранную валюту
  const priceUAH = useMemo(() => {
    const v = Number(price);
    return Number.isFinite(v) ? v : null;
  }, [price]);

  const priceText = useMemo(() => {
    if (priceUAH === null) return '—';
    const converted = convertFromUAH(priceUAH); // округление до целого внутри
    return formatMoney(converted); // формат без дробной части
  }, [priceUAH, convertFromUAH, formatMoney]);

  return (
    <div className="product-card" aria-label={t('product.cardAria', { title })}>
      <Link
        to={`/product/${id}`}
        className="thumb"
        title={t('product.openDetails')}
        aria-label={t('product.openDetails')}
      >
        {preview_image_url ? (
          <img src={preview_image_url} alt={title} className="thumb-fixed" />
        ) : (
          <div className="thumb-placeholder">{t('product.noPhoto')}</div>
        )}
      </Link>

      <h3>
        <Link to={`/product/${id}`} title={t('product.openDetails')}>
          {title}
        </Link>
      </h3>

      <div className="meta">
        <span>{category}</span> · <span>{seller_name}</span>
      </div>

      <div className="row">
        <div className="price" aria-label={t('product.priceAria', { price: priceText })}>
          {priceText}
        </div>
        <button
          onClick={() => onBuy?.(product)}
          className="btn"
          type="button"
          aria-label={t('product.buy')}
          title={t('product.buy')}
        >
          {t('product.buy')}
        </button>
      </div>
    </div>
  );
}
