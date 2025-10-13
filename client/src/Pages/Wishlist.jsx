// client/src/Pages/Wishlist.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../Styles/Wishlist.css';

// TODO: wire to your real wishlist state
// import { useWishlist } from '../contexts/WishlistContext';
// import { useCart } from '../contexts/CartContext';

export default function WishlistPage(){
  // const { items, remove } = useWishlist();
  const items = []; // placeholder to render "empty" per mockup
  const navigate = useNavigate();
  const isEmpty = !items || items.length === 0;

  return (
    <div className="wishlist-page">
      {isEmpty ? <EmptyState onGoShop={() => navigate('/catalog')} /> : (
        <FilledWishlist items={items} />
      )}

      <Section title="Хіт продаж" ctaText="Усі категорії" ctaHref="/catalog">
        <div className="cards-grid">
          <ProductCard title="Пральний порошок, 2 кг" priceNow="207 грн" priceOld="259 грн" rating="4,4" image="/assets/wishlist/poroshok2.png" />
          <ProductCard title="Гель для прання, 1 л" priceNow="189 грн" priceOld="229 грн" rating="4,7" image="/assets/wishlist/poroshok2.png" />
          <ProductCard title="Кондиціонер, 900 мл" priceNow="165 грн" priceOld="199 грн" rating="4,6" image="/assets/wishlist/poroshok2.png" />
          <ProductCard title="Капсули для прання" priceNow="239 грн" priceOld="289 грн" rating="4,8" image="/assets/wishlist/poroshok2.png" />
        </div>
      </Section>

      <Section title="Спеціально для вас" ctaText="Більше товарів" ctaHref="/catalog">
        <div className="cards-grid">
          <ProductCard title="Пральний порошок, 2 кг" priceNow="207 грн" priceOld="259 грн" rating="4,4" image="/assets/wishlist/poroshok2.png" />
          <ProductCard title="Гель для прання, 1 л" priceNow="189 грн" priceOld="229 грн" rating="4,7" image="/assets/wishlist/poroshok2.png" />
          <ProductCard title="Кондиціонер, 900 мл" priceNow="165 грн" priceOld="199 грн" rating="4,6" image="/assets/wishlist/poroshok2.png" />
          <ProductCard title="Капсули для прання" priceNow="239 грн" priceOld="289 грн" rating="4,8" image="/assets/wishlist/poroshok2.png" />
        </div>
      </Section>
    </div>
  );
}

function EmptyState({ onGoShop }){
  return (
    <div className="wl-empty">
      <div className="wl-empty__title">Список бажань порожній</div>
      <img className="wl-empty__img" src="/assets/wishlist/wishlist-empty.png" alt="" />
      <Link to="/catalog" className="wl-btn">
        <span className="wl-btn__text">За покупками</span>
        <img className="wl-btn__icon" src="/assets/wishlist/plane.png" alt="" aria-hidden="true" />
      </Link>
    </div>
  );
}

function FilledWishlist({ items }){
  return (
    <div className="wl-filled">
      <h1 className="wl-filled__title">Список бажань</h1>
      {items.map((p) => (
        <div key={p.id} className="wl-row">
          <img className="wl-row__img" src={p.image} alt={p.title} />
          <div className="wl-row__info">
            <div className="wl-row__name">{p.title}</div>
            <div className="wl-row__price">{p.price} ₴</div>
          </div>
          <div className="wl-row__actions">
            <button className="wl-ghost" type="button" title="Удалить из списка">×</button>
            <button className="wl-green" type="button" title="В корзину">+</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, ctaText, ctaHref, children }){
  return (
    <section className="wl-section">
      <div className="wl-section__hdr">
        <h3 className="wl-h3">{title}</h3>
        <a className="wl-link" href={ctaHref}>
          <span className="text">{ctaText}</span>
          <span className="icon"><img src="/assets/wishlist/arrow.png" alt="" /></span>
        </a>
      </div>
      {children}
    </section>
  );
}

function ProductCard({ title, priceNow, priceOld, rating, image }){
  return (
    <div className="wl-card">
      <div className="wl-card__frame" />
      <div className="wl-card__photo">
        <img className="img" src={image} alt={title} />
        <a className="link" href="/product/placeholder" aria-label={title} />
        <div className="badge">
          <div className="badge__bg" />
          <img className="badge__img" src="/assets/wishlist/discount.png" alt="-20%" />
        </div>
      </div>

      <div className="wl-card__title">{title}</div>

      <div className="wl-card__rating">
        <span className="star"><img src="/assets/wishlist/star.png" alt="" /></span>
        <div className="val">{rating}</div>
      </div>

      <div className="wl-card__bottom">
        <div className="price-now">{priceNow}</div>
        <div className="price-old">{priceOld}</div>
        <button className="btn-ghost" type="button" aria-label="В обране">
          <img src="/assets/wishlist/favorites.png" alt="" />
        </button>
        <button className="btn-green" type="button" aria-label="В корзину">
          <img src="/assets/wishlist/basket.png" alt="" />
        </button>
      </div>
    </div>
  );
}
