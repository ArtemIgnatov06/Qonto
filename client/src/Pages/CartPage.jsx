// client/src/Pages/Cart.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../Styles/CartPage.css';

export default function CartPage() {
  const items = []; // <-- replace with your real cart data
  const navigate = useNavigate();
  const isEmpty = !items || items.length === 0;

  return (
    <div className="cart-page">
      {isEmpty ? <EmptyState onGoShop={() => navigate('/catalog')} /> : (
        <FilledCart items={items} />
      )}

      <section className="cart-section">
        <div className="cart-section-header">
          <h3 className="hits-title">Хіт продаж</h3>
          <a className="link-all" href="/catalog">
            <span className="text">Усі категорії</span>
            <span className="icon"><img src="/assets/cart/arrow.png" alt="" /></span>
          </a>
        </div>
        <div className="cards-grid">
          {/* добавил несколько карточек-примеров, чтобы было видно строку, а не колонку */}
          <ProductCard title="Пральний порошок, 2 кг" priceNow="207 грн" priceOld="259 грн" rating="4,4" image="/assets/cart/poroshok2.png" />
          <ProductCard title="Гель для прання, 1 л" priceNow="189 грн" priceOld="229 грн" rating="4,7" image="/assets/cart/poroshok2.png" />
          <ProductCard title="Кондиціонер, 900 мл" priceNow="165 грн" priceOld="199 грн" rating="4,6" image="/assets/cart/poroshok2.png" />
          <ProductCard title="Капсули для прання" priceNow="239 грн" priceOld="289 грн" rating="4,8" image="/assets/cart/poroshok2.png" />
        </div>
      </section>

      <section className="cart-section">
        <div className="cart-section-header">
          <h3 className="for-you-title">Спеціально для вас</h3>
          <a className="link-more" href="/catalog">
            <span className="text">Більше товарів</span>
            <span className="icon"><img src="/assets/cart/arrow.png" alt="" /></span>
          </a>
        </div>
        <div className="cards-grid">
          <ProductCard title="Пральний порошок, 2 кг" priceNow="207 грн" priceOld="259 грн" rating="4,4" image="/assets/cart/poroshok2.png" />
          <ProductCard title="Гель для прання, 1 л" priceNow="189 грн" priceOld="229 грн" rating="4,7" image="/assets/cart/poroshok2.png" />
          <ProductCard title="Кондиціонер, 900 мл" priceNow="165 грн" priceOld="199 грн" rating="4,6" image="/assets/cart/poroshok2.png" />
          <ProductCard title="Капсули для прання" priceNow="239 грн" priceOld="289 грн" rating="4,8" image="/assets/cart/poroshok2.png" />
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-wrap">
      <div className="empty-title">Кошик порожній</div>
      <img className="empty-illustration" src="/assets/cart/cart-empty.png" alt="" />
      <Link to="/catalog" className="frame-303">
        <span className="btn-text">За покупками</span>
        <img className="icon-99" src="/assets/cart/plane.png" alt="" aria-hidden="true" />
      </Link>
    </div>
  );
}

function FilledCart({ items }) {
  return (
    <div className="filled-wrap">
      <h1 className="filled-title">Корзина</h1>
      {items.map((item) => (
        <div key={item.id} className="filled-row">
          <img className="filled-photo" src={item.image} alt={item.title} />
          <div className="filled-info">
            <div className="filled-name">{item.title}</div>
            <div className="filled-price">{item.price} ₴</div>
          </div>
          <div className="filled-controls">
            <button type="button" className="qty-btn">-</button>
            <span className="qty-val">{item.qty || 1}</span>
            <button type="button" className="qty-btn">+</button>
            <button type="button" className="remove-btn">×</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductCard({ className = '', title, priceNow, priceOld, rating, image }) {
  return (
    <div className={`product-card ${className}`}>
      <div className="card-frame" />
      <div className="photo-mask">
        <div className="photo-bg" />
        <img className="photo-img" src={image} alt={title} />
        <a className="product-link" href="/product/placeholder" aria-label={title} />
        <div className="badge">
          <div className="badge-bg" />
          <img className="badge-img" src="/assets/cart/discount.png" alt="-20%" />
        </div>
      </div>

      <div className="title">{title}</div>

      <div className="rating">
        <span className="star"><img src="/assets/cart/star.png" alt="" /></span>
        <div className="val">{rating}</div>
      </div>

      <div className="price-row">
        <div className="price-now">{priceNow}</div>
        <div className="price-old">{priceOld}</div>
        <button className="btn-ghost" type="button" aria-label="В обране">
          <img src="/assets/cart/favorites.png" alt="" />
        </button>
        <button className="btn-green" type="button" aria-label="В корзину">
          <img src="/assets/cart/basket.png" alt="" />
        </button>
      </div>
    </div>
  );
}
