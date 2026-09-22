import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError, get, messageFrom, patch, post } from '../services/api';
import { useAuth } from '../services/auth';
import type { Order } from '../types/api';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  // Edit address state
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [updating, setUpdating] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchOrder = () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setErrorCode(null);

    get<Order>(`/orders/${id}`)
      .then((data) => {
        setOrder(data);
        setShippingAddress(data.shippingAddress);
        setCustomerPhone(data.customerPhone ?? '');
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setErrorCode(err.status);
        }
        setError(messageFrom(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOrder();
  }, [id, user]);

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !order) return;
    if (shippingAddress.trim().length < 5) {
      setActionNotice({ type: 'error', message: 'Địa chỉ giao hàng phải có ít nhất 5 ký tự.' });
      return;
    }
    setUpdating(true);
    setActionNotice(null);
    try {
      const updated = await patch<Order>(`/orders/${id}`, {
        shippingAddress: shippingAddress.trim(),
        customerPhone: customerPhone.trim() || undefined,
      });
      setOrder(updated);
      setIsEditingAddress(false);
      setActionNotice({ type: 'success', message: 'Cập nhật địa chỉ nhận hàng thành công!' });
    } catch (err) {
      setActionNotice({ type: 'error', message: messageFrom(err) });
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!id || !order) return;
    if (!window.confirm('Bạn có chắc chắn muốn hủy đơn hàng này? Các sản phẩm sẽ được hoàn lại vào kho.')) {
      return;
    }
    setUpdating(true);
    setActionNotice(null);
    try {
      const cancelled = await post<Order>(`/orders/${id}/cancel`);
      setOrder(cancelled);
      setActionNotice({ type: 'success', message: 'Đơn hàng đã được hủy thành công và đã hoàn lại số lượng tồn kho.' });
    } catch (err) {
      setActionNotice({ type: 'error', message: messageFrom(err) });
    } finally {
      setUpdating(false);
    }
  };

  if (!user) {
    return (
      <div className="container page-content">
        <div className="state-panel">
          <h2>Yêu cầu xác thực</h2>
          <p className="muted">Vui lòng đăng nhập để tra cứu thông tin chi tiết đơn hàng.</p>
          <Link to="/login" className="button button-primary" style={{ marginTop: '16px' }}>
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container page-content">
        <div className="state-panel" role="status">
          <span className="spinner" />
          <p>Đang tải thông tin đơn hàng #{id}…</p>
        </div>
      </div>
    );
  }

  // OWASP A01 Demonstration: 403 Forbidden display
  if (errorCode === 403) {
    return (
      <div className="container page-content">
        <nav className="breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span>/</span>
          <Link to="/orders">Đơn hàng</Link>
          <span>/</span>
          <span>Bảo mật truy cập</span>
        </nav>

        <div className="order-success-card" style={{ borderColor: '#c84b31', background: '#fff9f8', textAlign: 'left', maxWidth: '720px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fde8e4',
              color: '#c84b31',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 700
            }}>
              !
            </div>
            <div>
              <h2 style={{ color: '#c84b31', margin: 0, fontSize: '1.3rem' }}>403 FORBIDDEN — TRUY CẬP BỊ TỪ CHỐI</h2>
              <p className="small muted" style={{ margin: '2px 0 0' }}>Cơ chế Access Control (OWASP Top 10 A01) đã chặn yêu cầu này</p>
            </div>
          </div>

          <div style={{ background: 'white', padding: '16px', borderRadius: '6px', border: '1px solid #f2c2b8', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '.9rem', fontWeight: 600 }}>Chi tiết phản hồi từ máy chủ:</p>
            <p style={{ margin: 0, color: '#566459', fontSize: '.88rem' }}>{error}</p>
            <p className="small" style={{ margin: '8px 0 0', color: '#888' }}>
              Mã đơn hàng yêu cầu: <code style={{ color: '#c84b31' }}>{id}</code> | Tài khoản hiện tại: <strong>{user.email}</strong>
            </p>
          </div>

          <div style={{ background: '#f4f6f0', padding: '14px 18px', borderRadius: '6px', fontSize: '.85rem', color: '#444', marginBottom: '24px' }}>
            <strong>Kiến trúc bảo mật PBL4-517:</strong> Hệ thống thực thi chính sách <em>Database-level Query Scoping</em>. Dữ liệu của chủ đơn không được nạp vào bộ nhớ tiến trình nếu tài khoản yêu cầu không khớp với quyền sở hữu.
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Link to="/orders" className="button button-primary">
              Về danh sách đơn hàng của tôi
            </Link>
            <button onClick={fetchOrder} className="button button-secondary">
              Thử tải lại (Retry)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container page-content">
        <nav className="breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span>/</span>
          <Link to="/orders">Đơn hàng</Link>
        </nav>
        <div className="state-panel">
          <h2>Không tìm thấy đơn hàng</h2>
          <p className="muted">{error ?? 'Đơn hàng không tồn tại hoặc đã bị xóa.'}</p>
          <Link to="/orders" className="button button-primary" style={{ marginTop: '16px' }}>
            Về danh sách đơn hàng
          </Link>
        </div>
      </div>
    );
  }

  const isCrossUserOrder = order.userId && order.userId !== user.id && user.role !== 'ADMIN';

  return (
    <div className="container page-content">
      <nav className="breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/orders">Đơn hàng</Link>
        <span>/</span>
        <span>#{order.id.slice(0, 8)}...</span>
      </nav>

      {/* Warning banner if IDOR vulnerability mode is actively leaking cross-user order */}
      {isCrossUserOrder && (
        <div className="notice notice-error" style={{ marginBottom: '24px', padding: '16px 20px', borderLeft: '6px solid #c84b31' }}>
          <strong>⚠️ LAB DEMO — PHÁT HIỆN LỖ HỔNG IDOR (VULNERABLE MODE ACTIVE):</strong>
          <p style={{ margin: '4px 0 0', fontSize: '.88rem' }}>
            Bạn đang đăng nhập bằng tài khoản <strong>{user.email}</strong>, nhưng máy chủ đang trả về dữ liệu đơn hàng của khách hàng <strong>{order.customerName ?? order.user?.name} ({order.customerEmail ?? order.user?.email})</strong> do cờ <code>VULN_IDOR_ENABLED=true</code> đang được bật trong <code>.env</code>.
          </p>
        </div>
      )}

      {actionNotice && (
        <div className={`notice notice-${actionNotice.type}`} style={{ marginBottom: '20px' }}>
          {actionNotice.message}
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <p className="eyebrow">CHI TIẾT ĐƠN HÀNG</p>
          <h1 style={{ fontSize: '1.6rem', margin: '4px 0' }}>Mã: {order.id}</h1>
          <p className="muted small">Đặt ngày {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className={`status-tag status-${order.status.toLowerCase()}`} style={{ fontSize: '.85rem', padding: '6px 14px' }}>
            {order.status}
          </span>
          <Link to="/orders" className="button button-secondary">
            ← Quay lại
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Items */}
        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '6px', padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>Danh sách sản phẩm ({order.items.length})</h2>
          <div className="order-items-list">
            {order.items.map((item) => (
              <div key={item.id} className="order-item-row" style={{ padding: '12px 0' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{item.product?.name ?? 'Sản phẩm'}</p>
                  <p className="small muted" style={{ margin: '2px 0 0' }}>Đơn giá: {currency.format(Number(item.unitPrice))}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="small muted">x{item.quantity}</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--green)' }}>
                    {currency.format(Number(item.unitPrice) * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '2px solid var(--line)', marginTop: '20px', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>TỔNG CỘNG:</span>
            <span style={{ color: 'var(--green)', fontSize: '1.35rem', fontWeight: 700 }}>
              {currency.format(Number(order.totalPrice))}
            </span>
          </div>
        </div>

        {/* Right Column: Customer & Shipping Details & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '6px', padding: '20px' }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: '14px' }}>Thông tin người nhận</h2>
            <div style={{ fontSize: '.88rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <span className="muted">Họ tên:</span> <strong>{order.customerName ?? order.user?.name ?? 'Khách vãng lai'}</strong>
              </div>
              <div>
                <span className="muted">Email:</span> <strong>{order.customerEmail ?? order.user?.email ?? 'Không có'}</strong>
              </div>
              <div>
                <span className="muted">Điện thoại:</span> <strong>{order.customerPhone ?? 'Chưa cung cấp'}</strong>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', marginTop: '16px', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="muted" style={{ fontSize: '.88rem' }}>Địa chỉ nhận hàng:</span>
                {order.status === 'PENDING' && !isEditingAddress && (
                  <button
                    onClick={() => setIsEditingAddress(true)}
                    className="button button-secondary"
                    style={{ padding: '3px 8px', fontSize: '.75rem' }}
                  >
                    Chỉnh sửa
                  </button>
                )}
              </div>

              {isEditingAddress ? (
                <form onSubmit={handleUpdateAddress} style={{ marginTop: '10px' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <label className="small muted" style={{ display: 'block', marginBottom: '4px' }}>Địa chỉ mới:</label>
                    <textarea
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', fontSize: '.85rem' }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label className="small muted" style={{ display: 'block', marginBottom: '4px' }}>Số điện thoại:</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', fontSize: '.85rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" disabled={updating} className="button button-primary" style={{ padding: '6px 12px', fontSize: '.8rem' }}>
                      {updating ? 'Đang lưu…' : 'Lưu địa chỉ'}
                    </button>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => {
                        setIsEditingAddress(false);
                        setShippingAddress(order.shippingAddress);
                        setCustomerPhone(order.customerPhone ?? '');
                      }}
                      className="button button-secondary"
                      style={{ padding: '6px 12px', fontSize: '.8rem' }}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <p style={{ margin: 0, fontSize: '.9rem', color: '#333' }}>{order.shippingAddress}</p>
              )}
            </div>
          </div>

          {/* Action Box */}
          {order.status === 'PENDING' && (
            <div style={{ background: '#fafaf7', border: '1px solid var(--line)', borderRadius: '6px', padding: '16px' }}>
              <h3 style={{ fontSize: '.95rem', margin: '0 0 8px' }}>Thao tác đơn hàng</h3>
              <p className="small muted" style={{ margin: '0 0 12px' }}>
                Đơn hàng đang ở trạng thái Chờ xử lý (PENDING). Bạn có thể hủy đơn nếu không còn nhu cầu mua sắm.
              </p>
              <button
                onClick={handleCancelOrder}
                disabled={updating}
                className="button"
                style={{
                  width: '100%',
                  background: '#f8d7da',
                  color: '#721c24',
                  borderColor: '#f5c6cb',
                  padding: '9px 16px',
                  fontWeight: 600,
                  fontSize: '.85rem'
                }}
              >
                {updating ? 'Đang xử lý…' : 'Hủy đơn hàng này'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
