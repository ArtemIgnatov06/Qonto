// components/ProductCard.jsx
import { Link } from 'react-router-dom';

export default function ProductCard({ product, onBuy }) {
  const { id, title, price, seller_name, category, preview_image_url } = product;

  return (
    <div className="product-card">
      <Link to={`/product/${id}`} className="thumb">
        {preview_image_url ? (
          <img src={preview_image_url} alt={title} className="thumb-fixed" />
        ) : (
          <div className="thumb-placeholder">Нет фото</div>
        )}
      </Link>

      <h3><Link to={`/product/${id}`}>{title}</Link></h3>

      <div className="meta">
        <span>{category}</span> · <span>{seller_name}</span>
      </div>

      <div className="row">
        <div className="price">{Number(price).toFixed(2)} ₴</div>
        <button onClick={() => onBuy?.(product)} className="btn">Купить</button>
      </div>
    </div>
  );
}
