import { Link } from 'react-router';
import type { Product } from '../types/api';
import { ProductMedia } from './ProductMedia';
import { useCart, type AddToCartResult } from '../services/cart';
import { useAuth } from '../services/auth';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

interface ProductCardProps {
  product: Product;
  onAddedToCart?: (productName: string, result?: AddToCartResult) => void;
}

export function ProductCard({ product, onAddedToCart }: ProductCardProps) {
  const { addToCart, getItemQuantity } = useCart();
  const { user } = useAuth();

  const isOutOfStock = product.stock <= 0;
  const inCartCount = getItemQuantity(product.id);
  const isMaxInCart = product.stock > 0 && inCartCount >= product.stock;
  const isAdmin = user?.role === 'ADMIN';

  function handleAddToCart() {
    if (isOutOfStock || isAdmin) return;
    const result = addToCart(product, 1);
    if (onAddedToCart) {
      onAddedToCart(product.name, result);
    }
  }

  const buttonLabel = isOutOfStock
    ? 'Hết hàng'
    : isMaxInCart
    ? 'Đã đạt tối đa'
    : '+ Giỏ hàng';

  const buttonAriaLabel = isOutOfStock
    ? `${product.name} đã hết hàng`
    : isMaxInCart
    ? `Đã có tối đa số lượng ${product.name} trong giỏ hàng`
    : `Thêm ${product.name} vào giỏ hàng`;

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
            {isOutOfStock ? 'Hết hàng' : isMaxInCart ? `Trong giỏ: ${inCartCount}/${product.stock}` : `Còn ${product.stock}`}
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
              className="button button-small button-primary product-card-cta"
              disabled={isOutOfStock || isMaxInCart}
              onClick={handleAddToCart}
              aria-label={buttonAriaLabel}
            >
              {buttonLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
