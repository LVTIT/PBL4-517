import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { get, messageFrom, post } from '../services/api';
import { useAuth } from '../services/auth';
import { useCart } from '../services/cart';
import type { Product, Review } from '../types/api';
import { BoxIcon, CheckIcon } from '../components/Icon';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [addedNotice, setAddedNotice] = useState(false);

  // Review form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    get<Product>(`/products/${id}`)
      .then((data) => {
        setProduct(data);
        setError(null);
      })
      .catch((err) => {
        setError(messageFrom(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  function handleAddToCart() {
    if (!product || product.stock <= 0) return;
    addToCart(product, quantity);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 3000);
  }

  async function handleAddReview(e: FormEvent) {
    e.preventDefault();
    if (!id || submittingReview || !comment.trim()) return;

    setSubmittingReview(true);
    setReviewError(null);
    setReviewSuccess(null);
    try {
      const newReview = await post<Review>(`/products/${id}/reviews`, { rating, comment: comment.trim() });
      setReviewSuccess('Cảm ơn bạn đã gửi đánh giá!');
      setComment('');
      setRating(5);
      // Append to product reviews
      if (product) {
        const updatedReviews = [newReview, ...(product.reviews ?? [])];
        const newAvg = Number((updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length).toFixed(1));
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
        <div className="notice notice-error" role="alert">
          <span>{error ?? 'Sản phẩm không tồn tại.'}</span>
          <Link className="button button-primary" to="/products" style={{ marginLeft: '16px' }}>Quay lại danh sách</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-content">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <Link to="/">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <Link to="/products">Sản phẩm</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail-grid">
        <div className="product-detail-visual">
          <div className="detail-artwork">
            <span className="product-visual-label">{product.category ?? '517 ESSENTIAL'}</span>
            <div className="artwork-icon"><BoxIcon /></div>
            <span className="product-number">517 PRODUCT</span>
          </div>
        </div>

        <div className="product-detail-info">
          <div className="product-header-row">
            <span className={`stock ${product.stock === 0 ? 'stock-empty' : ''}`}>
              <span />
              {product.stock > 0 ? `Còn ${product.stock} sản phẩm sẵn sàng` : 'Tạm hết hàng'}
            </span>
            {product.category && <span className="product-category-tag">{product.category}</span>}
          </div>

          <h1>{product.name}</h1>

          <div className="rating-summary">
            <span className="star-rating">★ {product.averageRating ?? 5}</span>
            <span className="muted small">({product.reviewCount ?? 0} lượt đánh giá)</span>
          </div>

          <p className="detail-price">{currency.format(Number(product.price))}</p>

          <p className="detail-description">{product.description}</p>

          {user?.role === 'ADMIN' ? (
            <div className="notice" style={{ marginTop: '24px', background: 'var(--color-bg-secondary, #f8f9fa)', border: '1px solid var(--color-border, #e5e5e5)', padding: '16px', borderRadius: '8px' }}>
              <strong>Tài khoản Quản trị viên</strong>
              <p className="muted small" style={{ marginTop: '4px', marginBottom: '12px' }}>
                Quản trị viên quản lý danh mục và tồn kho của sản phẩm, không thực hiện mua sắm hay đặt hàng cá nhân.
              </p>
              <Link to="/admin" className="button button-primary">
                Quản lý tại Bảng điều khiển Admin
              </Link>
            </div>
          ) : (
            <div className="purchase-panel">
              <div className="quantity-selector">
                <label htmlFor="quantity-input" className="small muted">Số lượng:</label>
                <div className="qty-controls">
                  <button
                    type="button"
                    disabled={quantity <= 1 || product.stock <= 0}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Giảm số lượng"
                  >
                    −
                  </button>
                  <input
                    id="quantity-input"
                    type="number"
                    min={1}
                    max={product.stock}
                    value={quantity}
                    disabled={product.stock <= 0}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))}
                  />
                  <button
                    type="button"
                    disabled={quantity >= product.stock || product.stock <= 0}
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
                disabled={product.stock <= 0}
                onClick={handleAddToCart}
              >
                {product.stock > 0 ? 'Thêm vào giỏ hàng' : 'Tạm hết hàng'}
              </button>
            </div>
          )}

          {addedNotice && (
            <div className="notice notice-success" role="status">
              <CheckIcon />
              <span>Đã thêm <strong>{quantity} x {product.name}</strong> vào giỏ hàng!</span>
              <Link to="/cart" className="inline-link" style={{ marginLeft: 'auto' }}>Xem giỏ hàng →</Link>
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <section className="reviews-section" aria-labelledby="reviews-heading">
        <div className="section-header">
          <h2 id="reviews-heading">Đánh giá từ khách hàng ({product.reviews?.length ?? 0})</h2>
          <p className="muted small">Chia sẻ trải nghiệm sử dụng thực tế của bạn về sản phẩm này.</p>
        </div>

        {/* Add Review Form */}
        <div className="review-form-card">
          {user?.role === 'ADMIN' ? (
            <div className="login-to-review">
              <p>Tài khoản <strong>Quản trị viên</strong> không thể gửi đánh giá cho sản phẩm của cửa hàng.</p>
              <p className="muted small">Vui lòng đăng nhập với tài khoản Khách hàng để chia sẻ trải nghiệm sản phẩm.</p>
            </div>
          ) : user ? (
            <form onSubmit={(e) => void handleAddReview(e)}>
              <h3>Gửi nhận xét của bạn</h3>
              <div className="rating-picker">
                <label className="small">Đánh giá:</label>
                <div className="stars-input">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      className={`star-button ${star <= rating ? 'active' : ''}`}
                      onClick={() => setRating(star)}
                      title={`${star} sao`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="rating-label">{rating} / 5 sao</span>
                </div>
              </div>

              <div className="form-field" style={{ marginTop: '12px' }}>
                <label htmlFor="review-comment">Nhận xét chi tiết</label>
                <textarea
                  id="review-comment"
                  rows={3}
                  required
                  maxLength={1000}
                  placeholder="Chia sẻ cảm nhận về độ hoàn thiện, cảm giác cầm nắm, chất lượng..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={submittingReview}
                />
              </div>

              {reviewError && <p className="form-error" role="alert">{reviewError}</p>}
              {reviewSuccess && <p className="form-success" role="status">{reviewSuccess}</p>}

              <button
                type="submit"
                className="button button-primary"
                disabled={submittingReview || !comment.trim()}
              >
                {submittingReview ? 'Đang gửi…' : 'Gửi nhận xét'}
              </button>
            </form>
          ) : (
            <div className="login-to-review">
              <p>Bạn cần đăng nhập để gửi nhận xét về sản phẩm.</p>
              <Link to="/login" className="button button-primary">Đăng nhập để đánh giá</Link>
            </div>
          )}
        </div>

        {/* Reviews List */}
        <div className="reviews-list">
          {product.reviews && product.reviews.length > 0 ? (
            product.reviews.map((rev) => (
              <article key={rev.id} className="review-item">
                <div className="review-header">
                  <div className="reviewer-info">
                    <span className="account-avatar small-avatar" aria-hidden="true">
                      {(rev.user?.name ?? 'K').slice(0, 1)}
                    </span>
                    <strong>{rev.user?.name ?? 'Khách hàng'}</strong>
                  </div>
                  <div className="review-meta">
                    <span className="star-rating">{'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}</span>
                    <time className="muted small" dateTime={rev.createdAt}>
                      {new Date(rev.createdAt).toLocaleDateString('vi-VN')}
                    </time>
                  </div>
                </div>
                <p className="review-comment">{rev.comment}</p>
              </article>
            ))
          ) : (
            <p className="muted" style={{ paddingBlock: '24px' }}>Chưa có đánh giá nào cho sản phẩm này. Hãy là người đầu tiên nhận xét!</p>
          )}
        </div>
      </section>
    </div>
  );
}
