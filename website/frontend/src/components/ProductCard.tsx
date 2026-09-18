import { Link } from 'react-router';
import type { Product } from '../types/api';
import { BoxIcon } from './Icon';
import { useCart } from '../services/cart';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function ProductCard({ product, index }: { product: Product; index: number }) {
  const { addToCart } = useCart();

  return (
    <article className="product-card">
      <Link to={`/products/${product.id}`} className="product-link-wrapper" aria-label={`Xem chi tiết ${product.name}`}>
        <div className={`product-visual product-tone-${index % 3}`} aria-hidden="true">
          <span className="product-number">517 / {String(index + 1).padStart(2, '0')}</span>
          <div className="product-symbol"><BoxIcon /></div>
          <span className="product-visual-label">{product.category ?? 'EVERYDAY ESSENTIALS'}</span>
        </div>
      </Link>
      <div className="product-content">
        <div className="product-header-row">
          <span className={`stock ${product.stock === 0 ? 'stock-empty' : ''}`}><span />{product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Tạm hết hàng'}</span>
          {product.category && <span className="product-category-tag">{product.category}</span>}
        </div>
        <h2><Link to={`/products/${product.id}`}>{product.name}</Link></h2>
        <p className="product-description">{product.description}</p>
        <div className="product-action-row">
          <p className="product-price">{currency.format(Number(product.price))}</p>
          <button
            type="button"
            className="button button-small button-primary"
            disabled={product.stock <= 0}
            onClick={() => addToCart(product, 1)}
            title={product.stock <= 0 ? 'Sản phẩm tạm hết hàng' : 'Thêm vào giỏ hàng'}
          >
            {product.stock > 0 ? '+ Giỏ hàng' : 'Hết hàng'}
          </button>
        </div>
      </div>
    </article>
  );
}
