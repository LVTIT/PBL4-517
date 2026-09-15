import type { Product } from '../types/api';
import { BoxIcon } from './Icon';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function ProductCard({ product, index }: { product: Product; index: number }) {
  return (
    <article className="product-card">
      <div className={`product-visual product-tone-${index % 3}`} aria-hidden="true">
        <span className="product-number">517 / {String(index + 1).padStart(2, '0')}</span>
        <div className="product-symbol"><BoxIcon /></div>
        <span className="product-visual-label">EVERYDAY ESSENTIALS</span>
      </div>
      <div className="product-content">
        <span className={`stock ${product.stock === 0 ? 'stock-empty' : ''}`}><span />{product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Tạm hết hàng'}</span>
        <h2>{product.name}</h2>
        <p className="product-description">{product.description}</p>
        <p className="product-price">{currency.format(Number(product.price))}</p>
      </div>
    </article>
  );
}
