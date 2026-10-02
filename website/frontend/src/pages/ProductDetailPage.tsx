import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { get, messageFrom, post } from '../services/api';
import { useAuth } from '../services/auth';
import { useCart } from '../services/cart';
import type { Product, Review } from '../types/api';
import { ProductMedia } from '../components/ProductMedia';
import { StarIcon, RefreshIcon } from '../components/Icon';
import { LiveToast, type ToastMessage } from '../components/LiveToast';
import { getPageTitle } from '../config/brand';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Review form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  const fetchProduct = () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    get<Product>(`/products/${id}`)
      .then((data) => {
        setProduct(data);
        document.title = getPageTitle(data.name);
      })
      .catch((err) => {
        setError(messageFrom(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  function handleAddToCart() {
    if (!product || product.stock <= 0 || user?.role === 'ADMIN') return;
    addToCart(product, quantity);
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: `Đã thêm ${quantity} × "${product.name}" vào giỏ hàng.`,
      actionText: 'Xem giỏ hàng',
      actionHref: '/cart',
    });
  }

  async function handleAddReview(e: FormEvent) {
    e.preventDefault();
    if (!id || submittingReview || !comment.trim()) return;

    setSubmittingReview(true);
    setReviewError(null);
    setReviewSuccess(null);
    try {
      const newReview = await post<Review>(`/products/${id}/reviews`, {
        rating,
        comment: comment.trim(),
      });
      setReviewSuccess('Cảm ơn bạn đã gửi đánh giá cho sản phẩm!');
      setComment('');
      setRating(5);
      if (product) {
        const updatedReviews = [newReview, ...(product.reviews ?? [])];
        const newAvg = Number(
          (updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length).toFixed(1)
        );
        setProduct({
          ...product,
          reviews: updatedReviews,
          reviewCount: updatedReviews.length,
          averageRating: newAvg,
        });
      }
    } catch (err) {
      setReviewError(messageFrom(err));
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) {
    return (
      <div className="container page-content">
        <div className="state-panel" role="status">
          <span className="spinner" />
          <p>Đang tải chi tiết sản phẩm…</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container page-content">
        <div className="state-panel" role="alert">
          <h2>Chưa thể tải thông tin sản phẩm</h2>
          <p>{error ?? 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.'}</p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="button button-secondary" onClick={fetchProduct}>
              <RefreshIcon size={16} />
              <span>Thử lại</span>
            </button>
            <Link className="button button-primary" to="/products">
              Quay lại danh mục
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isOutOfStock = product.stock <= 0;
  const hasReviews = (product.reviewCount ?? 0) > 0;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="container page-content">
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Đường dẫn trang">
        <Link to="/">Trang chủ</Link>
        <span className="breadcrumb-separator" aria-hidden="true">/</span>
        <Link to="/products">Phụ kiện cho góc làm việc</Link>
        <span className="breadcrumb-separator" aria-hidden="true">/</span>
        <span aria-current="page" style={{ color: 'var(--color-text)', fontWeight: 500 }}>
          {product.name}
        </span>
      </nav>

      {/* Main Product Info Grid */}
      <div className="detail-grid">
        {/* Media Column */}
        <div className="detail-media-card">
          <ProductMedia
            imageKey={product.imageKey}
            name={product.name}
            category={product.category}
            aspectRatio="1/1"
            priority={true}
          />
        </div>

        {/* Info & Purchase Column */}
        <div className="detail-info">
          <div className="product-category-row">
            <span className="product-category-tag">{product.category ?? 'Phụ kiện'}</span>
            <span className={`stock-badge ${isOutOfStock ? 'stock-empty' : 'stock-available'}`}>
              {isOutOfStock ? 'Tạm hết hàng' : `Còn ${product.stock} sản phẩm`}
            </span>
          </div>

          <h1 className="detail-title">{product.name}</h1>

          {/* Rating Summary */}
          <div className="rating-bar">
            {hasReviews ? (
              <>
                <span className="star-rating">
                  <StarIcon size={18} />
                  <span>{product.averageRating?.toFixed(1) ?? '5.0'}</span>
                </span>
                <span className="small muted">({product.reviewCount} đánh giá từ khách hàng)</span>
              </>
            ) : (
              <span className="rating-none">Chưa có đánh giá nào</span>
            )}
          </div>

          <p className="detail-price">{currency.format(Number(product.price))}</p>

          <p className="detail-description">{product.description}</p>

          {/* Admin vs Customer Purchase Block */}
          {isAdmin ? (
            <div className="notice" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <div>
                <strong>Tài khoản Quản trị viên</strong>
                <p className="small muted" style={{ margin: '4px 0 12px 0' }}>
                  Quản trị viên quản lý danh mục và kho hàng tại Bảng điều khiển, không thực hiện mua sắm.
                </p>
                <Link to="/admin" className="button button-primary button-small">
                  Đến Bảng điều khiển Admin
                </Link>
              </div>
            </div>
          ) : (
            <div className="detail-purchase-box">
              <div className="quantity-control-group">
                <label htmlFor="qty-input" className="form-label" style={{ margin: 0 }}>
                  Số lượng:
                </label>
                <div className="quantity-selector">
                  <button
                    type="button"
                    className="qty-btn"
                    disabled={quantity <= 1 || isOutOfStock}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Giảm số lượng"
                  >
                    −
                  </button>
                  <input
                    id="qty-input"
                    type="number"
                    className="qty-input"
                    min={1}
                    max={product.stock}
                    value={quantity}
                    disabled={isOutOfStock}
                    onChange={(e) =>
                      setQuantity(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))
                    }
                    aria-label="Số lượng sản phẩm cần mua"
                  />
                  <button
                    type="button"
                    className="qty-btn"
                    disabled={quantity >= product.stock || isOutOfStock}
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    aria-label="Tăng số lượng"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="button button-primary button-large"
                disabled={isOutOfStock}
                onClick={handleAddToCart}
              >
                {isOutOfStock ? 'Sản phẩm tạm hết hàng' : 'Thêm vào giỏ hàng'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Customer Reviews Section */}
      <section className="reviews-section" aria-labelledby="reviews-heading">
        <div className="reviews-header">
          <p className="section-eyebrow">TRẢI NGHIỆM KHÁCH HÀNG</p>
          <h2 id="reviews-heading" className="section-title" style={{ fontSize: '1.5rem' }}>
            Đánh giá sản phẩm ({product.reviewCount ?? 0})
          </h2>
        </div>

        {/* Submit Review Form (Customers Only) */}
        {user && user.role !== 'ADMIN' && (
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
              marginBottom: '32px',
            }}
          >
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 16px 0' }}>
              Chia sẻ cảm nhận của bạn
            </h3>
            <form onSubmit={(e) => void handleAddReview(e)}>
              <div className="form-group">
                <label htmlFor="review-rating" className="form-label">
                  Mức độ hài lòng:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`${star} sao`}
                      style={{
                        padding: '6px',
                        color: star <= rating ? '#D97706' : '#D1D5DB',
                      }}
                    >
                      <StarIcon size={24} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="review-comment" className="form-label">
                  Nhận xét của bạn:
                </label>
                <textarea
                  id="review-comment"
                  className="form-textarea"
                  rows={3}
                  required
                  maxLength={1000}
                  placeholder="Chia sẻ trải nghiệm của bạn về thiết kế, chất liệu, cảm giác sử dụng…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={submittingReview}
                />
              </div>

              {reviewError && <p className="form-error">{reviewError}</p>}
              {reviewSuccess && <p className="form-success">{reviewSuccess}</p>}

              <button
                type="submit"
                className="button button-primary button-small"
                disabled={submittingReview || !comment.trim()}
                style={{ marginTop: '8px' }}
              >
                {submittingReview ? 'Đang gửi…' : 'Gửi đánh giá'}
              </button>
            </form>
          </div>
        )}

        {!user && (
          <div className="notice" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <span>Đăng nhập để chia sẻ đánh giá của bạn về sản phẩm này.</span>
            <Link to="/login" className="button button-secondary button-small">
              Đăng nhập
            </Link>
          </div>
        )}

        {/* Reviews List */}
        {!hasReviews ? (
          <div className="state-panel" style={{ padding: '32px' }}>
            <p className="muted" style={{ margin: 0 }}>
              Chưa có đánh giá nào cho sản phẩm này. Hãy là người đầu tiên chia sẻ cảm nhận!
            </p>
          </div>
        ) : (
          <div className="reviews-list">
            {product.reviews?.map((r) => (
              <div key={r.id} className="review-item">
                <div className="review-meta">
                  <span className="review-author">{r.user?.name ?? 'Khách hàng'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="star-rating">
                      {[...Array(r.rating)].map((_, i) => (
                        <StarIcon key={i} size={14} />
                      ))}
                    </div>
                    <span className="review-date">
                      {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
                <p className="review-comment">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Toast Feedback */}
      <LiveToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
