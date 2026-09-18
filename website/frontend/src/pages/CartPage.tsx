import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { useCart } from '../services/cart';
import { useAuth } from '../services/auth';
import { messageFrom, post } from '../services/api';
import type { Order } from '../types/api';
import { CheckIcon } from '../components/Icon';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function CartPage() {
  const { items, updateQuantity, removeFromCart, clearCart, totalCount, totalAmount } = useCart();
  const { user } = useAuth();

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('Số 54 Nguyễn Lương Bằng, Đà Nẵng');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  async function handleCheckout(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0 || submitting) return;

    if (user?.role === 'ADMIN') {
      setError('Tài khoản Quản trị viên chỉ dùng để quản trị hệ thống, không thể mua sắm hoặc đặt hàng.');
      return;
    }

    if (!user) {
      if (!guestName.trim()) {
        setError('Vui lòng nhập họ và tên nhận hàng.');
        return;
      }
      if (!guestEmail.trim()) {
        setError('Vui lòng nhập địa chỉ email nhận thông báo đơn hàng.');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guestEmail.trim())) {
        setError('Địa chỉ email không đúng định dạng.');
        return;
      }
    }

    if (!shippingAddress.trim() || shippingAddress.trim().length < 5) {
      setError('Địa chỉ giao hàng phải có ít nhất 5 ký tự.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const orderPayload = {
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      shippingAddress: shippingAddress.trim(),
      ...(user
        ? {}
        : {
            guestInfo: {
              name: guestName.trim(),
              email: guestEmail.trim(),
              phone: guestPhone.trim() || undefined,
            },
          }),
    };

    try {
      const order = await post<Order>('/orders', orderPayload);
      clearCart();
      setCreatedOrder(order);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (createdOrder) {
    return (
      <div className="container page-content">
        <div className="order-success-card">
          <div className="order-success-icon"><CheckIcon /></div>
          <h1>Đặt hàng thành công!</h1>
          <p className="order-id-label">Mã đơn hàng: <strong>{createdOrder.id}</strong></p>
          <p className="muted">
            Đơn hàng của bạn đang ở trạng thái <strong>{createdOrder.status}</strong>. Chúng mình sẽ liên hệ và giao hàng tới địa chỉ:
          </p>
          <p className="shipping-box">{createdOrder.shippingAddress}</p>
          <div className="order-success-total">
            <span>Tổng thanh toán:</span>
            <strong>{currency.format(Number(createdOrder.totalPrice))}</strong>
          </div>
          <div className="order-success-actions">
            {user ? (
              <Link to="/orders" className="button button-primary">Xem danh sách đơn hàng</Link>
            ) : (
              <Link to="/register" className="button button-primary">Đăng ký tài khoản để theo dõi</Link>
            )}
            <Link to="/products" className="button">Tiếp tục mua sắm</Link>
          </div>
          {!user && (
            <p className="muted small" style={{ marginTop: '16px', textAlign: 'center' }}>
              Thông tin xác nhận đơn hàng đã được ghi nhận cho email <strong>{createdOrder.customerEmail}</strong>. Bạn có thể tạo tài khoản bất cứ lúc nào với email này để theo dõi tiến trình giao hàng.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container page-content">
        <div className="state-panel">
          <h2>Giỏ hàng của bạn đang trống</h2>
          <p className="muted">Hãy lựa chọn những món đồ hữu ích để thêm vào không gian làm việc của bạn.</p>
          <Link to="/products" className="button button-primary" style={{ marginTop: '16px' }}>
            Khám phá sản phẩm
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-content">
      <div className="page-header">
        <p className="eyebrow">MUA SẮM</p>
        <h1>Giỏ hàng ({totalCount})</h1>
      </div>

      <div className="cart-grid">
        <div className="cart-items-panel">
          {items.map(({ productId, product, quantity }) => {
            const subtotal = Number(product.price) * quantity;
            return (
              <article key={productId} className="cart-item-row">
                <div className="cart-item-visual">
                  <span className="small muted">{product.category ?? '517'}</span>
                </div>
                <div className="cart-item-details">
                  <Link to={`/products/${productId}`} className="cart-item-title">
                    {product.name}
                  </Link>
                  <span className="muted small">Đơn giá: {currency.format(Number(product.price))}</span>
                </div>
                <div className="cart-item-qty">
                  <button
                    type="button"
                    onClick={() => updateQuantity(productId, quantity - 1)}
                    aria-label="Giảm 1"
                  >
                    −
                  </button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    disabled={quantity >= product.stock}
                    onClick={() => updateQuantity(productId, quantity + 1)}
                    aria-label="Tăng 1"
                  >
                    +
                  </button>
                </div>
                <div className="cart-item-subtotal">
                  <strong>{currency.format(subtotal)}</strong>
                </div>
                <button
                  type="button"
                  className="remove-button"
                  onClick={() => removeFromCart(productId)}
                  title="Xóa khỏi giỏ hàng"
                  aria-label={`Xóa ${product.name}`}
                >
                  ✕
                </button>
              </article>
            );
          })}
        </div>

        <div className="cart-summary-panel">
          <h2>Tổng kết đơn hàng</h2>
          <div className="summary-row">
            <span>Tổng số lượng:</span>
            <strong>{totalCount} sản phẩm</strong>
          </div>
          <div className="summary-row">
            <span>Tạm tính:</span>
            <strong>{currency.format(totalAmount)}</strong>
          </div>
          <div className="summary-row">
            <span>Phí vận chuyển:</span>
            <span>Miễn phí</span>
          </div>
          <div className="summary-row total-row">
            <span>Tổng cộng:</span>
            <span className="total-price">{currency.format(totalAmount)}</span>
          </div>

          <form onSubmit={(e) => void handleCheckout(e)} style={{ marginTop: '20px' }}>
            {user?.role === 'ADMIN' ? (
              <div className="notice notice-error" role="alert" style={{ marginBottom: '16px' }}>
                <p><strong>Lưu ý quyền hạn:</strong> Tài khoản <strong>Quản trị viên (ADMIN)</strong> chỉ có quyền quản trị hệ thống, sản phẩm và đơn hàng. Quản trị viên không thể mua sắm hoặc đặt đơn hàng.</p>
                <div style={{ marginTop: '12px' }}>
                  <Link to="/admin" className="button button-small button-primary">Đến Bảng điều khiển Admin</Link>
                </div>
              </div>
            ) : (
              <>
                {user ? (
                  <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'var(--color-bg-secondary, #f8f9fa)', borderRadius: '6px', fontSize: '0.9rem' }}>
                    <span>Đặt hàng với tài khoản: </span>
                    <strong>{user.name}</strong> <span className="muted">({user.email})</span>
                  </div>
                ) : (
                  <div className="guest-info-section" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>Thông tin người nhận (Khách vãng lai)</span>
                      <Link to="/login" state={{ from: '/cart' }} className="inline-link small">Đăng nhập</Link>
                    </div>
                    <div className="form-field">
                      <label htmlFor="guest-name">Họ và tên *</label>
                      <input
                        id="guest-name"
                        type="text"
                        required
                        maxLength={100}
                        placeholder="Ví dụ: Nguyễn Văn A"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="guest-email">Email nhận đơn *</label>
                      <input
                        id="guest-email"
                        type="email"
                        required
                        maxLength={254}
                        placeholder="email@example.com"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="guest-phone">Số điện thoại</label>
                      <input
                        id="guest-phone"
                        type="tel"
                        maxLength={20}
                        placeholder="0901234567"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                  </div>
                )}

                <div className="form-field">
                  <label htmlFor="shipping-addr">Địa chỉ nhận hàng *</label>
                  <textarea
                    id="shipping-addr"
                    required
                    rows={2}
                    maxLength={255}
                    placeholder="Nhập số nhà, tên đường, quận/huyện, thành phố..."
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                {error && <p className="form-error" role="alert">{error}</p>}

                <button
                  type="submit"
                  className="button button-primary submit-button"
                  disabled={submitting || items.length === 0}
                  style={{ width: '100%', marginTop: '12px' }}
                >
                  {submitting
                    ? 'Đang gửi đơn hàng…'
                    : user
                      ? 'Xác nhận đặt hàng'
                      : 'Đặt hàng với tư cách Khách'}
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
