import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { useCart } from '../services/cart';
import { useAuth } from '../services/auth';
import { messageFrom, post } from '../services/api';
import type { Order } from '../types/api';
import { ProductMedia } from '../components/ProductMedia';
import { TrashIcon, CheckIcon, AlertCircleIcon } from '../components/Icon';
import { getPageTitle } from '../config/brand';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function CartPage() {
  const { items, updateQuantity, removeFromCart, clearCart, totalCount, totalAmount } = useCart();
  const { user } = useAuth();

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  // Address starts EMPTY as required by specification
  const [shippingAddress, setShippingAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  useEffect(() => {
    document.title = getPageTitle('Giỏ hàng');
  }, []);

  async function handleCheckout(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0 || submitting) return;

    if (user?.role === 'ADMIN') {
      setError('Tài khoản Quản trị viên chỉ dùng để quản trị hệ thống, không thể mua sắm hoặc đặt hàng.');
      return;
    }

    if (!user) {
      if (!guestName.trim()) {
        setError('Vui lòng nhập họ và tên người nhận.');
        return;
      }
      if (!guestEmail.trim()) {
        setError('Vui lòng nhập địa chỉ email nhận thông tin đơn hàng.');
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

  // Order Success Screen
  if (createdOrder) {
    return (
      <div className="container page-content">
        <div
          style={{
            maxWidth: '600px',
            marginInline: 'auto',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: '36px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-success-subtle)',
              color: 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}
          >
            <CheckIcon size={28} />
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 8px 0' }}>
            Đặt hàng thành công!
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '0 0 20px 0' }}>
            Cảm ơn bạn đã lựa chọn các phụ kiện công nghệ từ KEVILO.
          </p>

          <div
            style={{
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-control)',
              padding: '16px 20px',
              textAlign: 'left',
              margin: '0 0 24px 0',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="small muted">Mã đơn hàng:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{createdOrder.id}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="small muted">Trạng thái:</span>
              <span className="order-status-badge status-pending">Chờ xử lý</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="small muted">Tổng thanh toán:</span>
              <strong style={{ color: 'var(--color-primary)' }}>
                {currency.format(Number(createdOrder.totalPrice))}
              </strong>
            </div>
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '8px', marginTop: '8px' }}>
              <span className="small muted">Địa chỉ giao hàng:</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9375rem' }}>{createdOrder.shippingAddress}</p>
            </div>
          </div>

          {!user ? (
            <div
              className="notice notice-warning"
              style={{ textAlign: 'left', marginBottom: '24px', alignItems: 'flex-start' }}
            >
              <AlertCircleIcon size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Lưu ý dành cho khách vãng lai:</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem' }}>
                  Bạn đang đặt hàng mà không đăng nhập. Vui lòng ghi lại hoặc chụp ảnh mã đơn hàng <code>{createdOrder.id}</code> để đối chiếu và tra cứu khi nhận hàng.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '24px' }}>
              <p className="small muted">
                Đơn hàng đã được lưu vào lịch sử mua sắm của tài khoản <strong>{user.email}</strong>.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {user ? (
              <Link to="/orders" className="button button-primary">
                Xem lịch sử đơn hàng
              </Link>
            ) : (
              <Link to="/register" className="button button-secondary">
                Đăng ký tài khoản KEVILO
              </Link>
            )}
            <Link to="/products" className="button button-secondary">
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Empty Cart Screen
  if (items.length === 0) {
    return (
      <div className="container page-content">
        <div className="state-panel">
          <h2>Giỏ hàng của bạn đang trống</h2>
          <p>Hãy lựa chọn những món đồ hữu ích để hoàn thiện không gian làm việc của bạn.</p>
          <Link to="/products" className="button button-primary" style={{ marginTop: '16px' }}>
            Khám phá sản phẩm
          </Link>
        </div>
      </div>
    );
  }

  // Cart & Checkout Layout
  return (
    <div className="container page-content">
      <header className="section-header" style={{ marginBottom: '28px' }}>
        <p className="section-eyebrow">MUA SẮM</p>
        <h1 className="section-title">Giỏ hàng ({totalCount})</h1>
      </header>

      <div className="cart-layout">
        {/* Left: Cart Items List */}
        <div className="cart-card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 16px 0' }}>
            Danh sách sản phẩm
          </h2>

          <div className="cart-items-wrapper">
            {items.map((item) => (
              <div key={item.productId} className="cart-item-row">
                <div className="cart-thumb">
                  <ProductMedia
                    imageKey={item.product.imageKey}
                    name={item.product.name}
                    category={item.product.category}
                    aspectRatio="1/1"
                  />
                </div>

                <div className="cart-item-details">
                  <Link
                    to={`/products/${item.productId}`}
                    className="cart-item-title"
                  >
                    {item.product.name}
                  </Link>
                  <span className="cart-item-price">
                    {currency.format(Number(item.product.price))}
                  </span>
                  {item.quantity > item.product.stock && (
                    <span className="form-error">
                      Chỉ còn {item.product.stock} trong kho!
                    </span>
                  )}
                </div>

                <div className="cart-item-actions">
                  <div className="quantity-selector">
                    <button
                      type="button"
                      className="qty-btn"
                      style={{ width: '36px', height: '36px' }}
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      aria-label={`Giảm số lượng ${item.product.name}`}
                    >
                      −
                    </button>
                    <span
                      style={{
                        width: '36px',
                        textAlign: 'center',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    >
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="qty-btn"
                      style={{ width: '36px', height: '36px' }}
                      disabled={item.quantity >= item.product.stock}
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      aria-label={`Tăng số lượng ${item.product.name}`}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    className="dialog-close-btn"
                    onClick={() => removeFromCart(item.productId)}
                    aria-label={`Xóa ${item.product.name} khỏi giỏ hàng`}
                    title="Xóa sản phẩm"
                  >
                    <TrashIcon size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Checkout & Address Panel */}
        <div className="cart-card checkout-panel">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
            Thông tin đặt hàng
          </h2>

          <div className="summary-row">
            <span>Tạm tính ({totalCount} sản phẩm):</span>
            <span>{currency.format(totalAmount)}</span>
          </div>
          <div className="summary-row">
            <span>Phí vận chuyển:</span>
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Miễn phí</span>
          </div>
          <div className="summary-row summary-total">
            <span>Tổng thanh toán:</span>
            <span style={{ color: 'var(--color-primary)' }}>{currency.format(totalAmount)}</span>
          </div>

          <form onSubmit={(e) => void handleCheckout(e)} style={{ marginTop: '16px' }}>
            {/* Guest Info Fields if not logged in */}
            {!user && (
              <>
                <div className="guest-order-notice notice notice-warning" style={{ marginBottom: '16px', fontSize: '0.875rem' }}>
                  <span>
                    <strong>Đặt hàng không cần tài khoản:</strong> Bạn có thể mua sắm ngay với tư cách khách vãng lai. Sau khi xác nhận đặt hàng, hãy lưu lại mã đơn để tiện đối chiếu khi nhận hàng.
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="guest-name" className="form-label">
                    Họ và tên người nhận <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="guest-name"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    className="form-input"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="guest-email" className="form-label">
                    Email nhận thông báo <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="guest-email"
                    type="email"
                    required
                    maxLength={254}
                    placeholder="ban@example.com"
                    className="form-input"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="guest-phone" className="form-label">
                    Số điện thoại liên hệ (tùy chọn)
                  </label>
                  <input
                    id="guest-phone"
                    type="tel"
                    maxLength={20}
                    placeholder="0912 345 678"
                    className="form-input"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </>
            )}

            {/* Shipping Address (Starts Empty) */}
            <div className="form-group">
              <label htmlFor="shipping-address" className="form-label">
                Địa chỉ giao hàng <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <textarea
                id="shipping-address"
                required
                minLength={5}
                maxLength={255}
                rows={3}
                placeholder="Nhập số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố…"
                className="form-textarea"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                disabled={submitting}
              />
            </div>

            {error && (
              <div className="notice notice-error" role="alert" style={{ marginBottom: '16px' }}>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="button button-primary button-large"
              style={{ width: '100%' }}
              disabled={submitting || items.length === 0}
            >
              {submitting ? 'Đang tạo đơn hàng…' : 'Xác nhận đặt hàng'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
