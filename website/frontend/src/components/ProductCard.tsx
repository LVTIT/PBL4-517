import { Link } from 'react-router';
import type { Product } from '../types/api';
import { ProductMedia } from './ProductMedia';
import { useCart } from '../services/cart';
import { useAuth } from '../services/auth';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

interface ProductCardProps {
  product: Product;
  onAddedToCart?: (productName: string) => void;
}

export function ProductCard({ product, onAddedToCart }: ProductCardProps) {
  const { addToCart } = useCart();
  const { user } = useAuth();

  const isOutOfStock = product.stock <= 0;
  const isAdmin = user?.role === 'ADMIN';

  function handleAddToCart() {
    if (isOutOfStock || isAdmin) return;
    addToCart(product, 1);
    if (onAddedToCart) {
      onAddedToCart(product.name);
    }
  }

  return (
    <article className="product-card">
      <Link
        to={`/products/${product.id}`}
        className="product-card-media"
        aria-label={`Xem chi tiết sản phẩm ${product.name}`}
      >
        <ProductMedia
          imageKey={product.imageKey}
          name={product.name}
          category={product.category}
          aspectRatio="1/1"
        />
      </Link>

      <div className="product-card-body">
        <div className="product-category-row">
          <span className="product-category-tag">{product.category ?? 'Phụ kiện'}</span>
          <span className={`stock-badge ${isOutOfStock ? 'stock-empty' : 'stock-available'}`}>
            {isOutOfStock ? 'Hết hàng' : `Còn ${product.stock}`}
          </span>
        </div>

        <h3 className="product-card-title">
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>

        <p className="product-card-desc">{product.description}</p>

        <div className="product-card-footer">
          <p className="product-price">{currency.format(Number(product.price))}</p>
          {!isAdmin && (
            <button
              type="button"
              className="button button-small button-primary"
              disabled={isOutOfStock}
              onClick={handleAddToCart}
              aria-label={isOutOfStock ? `${product.name} đã hết hàng` : `Thêm ${product.name} vào giỏ hàng`}
            >
              {isOutOfStock ? 'Hết hàng' : '+ Giỏ hàng'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
