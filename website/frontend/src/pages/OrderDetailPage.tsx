import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError, get, messageFrom, patch, post } from '../services/api';
import { useAuth } from '../services/auth';
import type { Order } from '../types/api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AlertCircleIcon, RefreshIcon, ArrowLeftIcon } from '../components/Icon';
import { STATUS_MAP } from './OrdersPage';
import { getPageTitle } from '../config/brand';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

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

  // Cancel dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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
        document.title = getPageTitle(`Đơn hàng #${data.id.slice(0, 8)}`);
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

  const handleConfirmCancel = async () => {
    if (!id || !order) return;
    setCancelling(true);
    setActionNotice(null);
    try {
      const cancelled = await post<Order>(`/orders/${id}/cancel`);
      setOrder(cancelled);
      setShowCancelDialog(false);
      setActionNotice({
        type: 'success',
        message: 'Đơn hàng đã được hủy thành công và hoàn trả số lượng vào kho.',
      });
    } catch (err) {
      setActionNotice({ type: 'error', message: messageFrom(err) });
    } finally {
      setCancelling(false);
    }
  };

  if (!user) {
    return (
      <div className="container page-content">
        <div className="state-panel" role="alert">
          <h2>Yêu cầu xác thực tài khoản</h2>
          <p>Vui lòng đăng nhập để tra cứu chi tiết đơn hàng của bạn.</p>
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
          <p>Đang tải thông tin chi tiết đơn hàng #{id}…</p>
        </div>
      </div>
    );
  }

  // OWASP A01 IDOR Demonstration: 403 Forbidden display
  if (errorCode === 403) {
    return (
      <div className="container page-content">
        <nav className="breadcrumb" aria-label="Đường dẫn">
          <Link to="/">Trang chủ</Link>
          <span className="breadcrumb-separator" aria-hidden="true">/</span>
          <Link to="/orders">Đơn hàng</Link>
          <span className="breadcrumb-separator" aria-hidden="true">/</span>
          <span aria-current="page">Bảo mật truy cập</span>
        </nav>

        <div className="idor-security-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-danger-subtle)',
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertCircleIcon size={28} />
            </div>
            <div>
              <h2 style={{ color: 'var(--color-danger)', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                403 FORBIDDEN — TRUY CẬP BỊ TỪ CHỐI
              </h2>
              <p className="small muted" style={{ margin: '4px 0 0 0' }}>
                Cơ chế Access Control (OWASP Top 10 A01 - IDOR) đã chặn yêu cầu này.
              </p>
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-bg)',
              padding: '16px 20px',
              borderRadius: 'var(--radius-control)',
              border: '1px solid var(--color-border)',
              marginBottom: '20px',
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem', fontWeight: 600 }}>
              Thông báo phản hồi từ máy chủ Express:
            </p>
            <p style={{ margin: 0, color: 'var(--color-danger)', fontWeight: 500, fontSize: '0.9375rem' }}>
              {error}
            </p>
            <p className="small muted" style={{ margin: '8px 0 0 0' }}>
              Mã đơn hàng yêu cầu: <code style={{ color: 'var(--color-text)' }}>{id}</code> | Tài khoản hiện tại: <strong>{user.email}</strong>
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-control)',
              padding: '16px 20px',
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1.6,
              marginBottom: '24px',
            }}
          >
            <strong style={{ color: 'var(--color-text)' }}>Kiến trúc bảo mật PBL4-517:</strong> Hệ thống thực thi chính sách <em>Database-level Query Scoping</em>. Dữ liệu của chủ đơn không được nạp vào bộ nhớ tiến trình nếu tài khoản yêu cầu không khớp với quyền sở hữu.
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link to="/orders" className="button button-primary">
              <ArrowLeftIcon size={16} />
              <span>Về danh sách đơn hàng</span>
            </Link>
            <button type="button" onClick={fetchOrder} className="button button-secondary">
              <RefreshIcon size={16} />
              <span>Thử tải lại (Retry)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container page-content">
        <div className="state-panel" role="alert">
          <h2>Không tìm thấy đơn hàng</h2>
          <p>{error ?? 'Đơn hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.'}</p>
          <Link to="/orders" className="button button-primary" style={{ marginTop: '16px' }}>
            Quay lại danh sách đơn hàng
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[order.status] ?? { text: order.status, className: 'status-pending' };

  return (
    <div className="container page-content">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <Link to="/">Trang chủ</Link>
        <span className="breadcrumb-separator" aria-hidden="true">/</span>
        <Link to="/orders">Đơn hàng</Link>
        <span className="breadcrumb-separator" aria-hidden="true">/</span>
        <span aria-current="page">#{order.id.slice(0, 8)}</span>
      </nav>

      <header className="section-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p className="section-eyebrow">CHI TIẾT ĐƠN HÀNG</p>
            <h1 className="section-title" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem' }}>
              #{order.id}
            </h1>
            <p className="small muted" style={{ margin: '4px 0 0 0' }}>
              Đặt ngày {new Date(order.createdAt).toLocaleString('vi-VN')}
            </p>
          </div>
          <div>
            <span className={`order-status-badge ${statusInfo.className}`} style={{ fontSize: '0.875rem', padding: '6px 14px' }}>
              {statusInfo.text}
            </span>
          </div>
        </div>
      </header>

      {actionNotice && (
        <div className={`notice notice-${actionNotice.type}`} style={{ marginBottom: '20px' }}>
          <span>{actionNotice.message}</span>
        </div>
      )}

      <div className="cart-layout">
        {/* Items List */}
        <div className="cart-card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 16px 0' }}>
            Sản phẩm trong đơn ({order.items.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {order.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBlock: '12px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 4px 0' }}>
                    {item.product?.name ?? 'Sản phẩm KEVILO'}
                  </h3>
                  <span className="small muted">
                    Đơn giá: {currency.format(Number(item.unitPrice))} × {item.quantity}
                  </span>
                </div>
                <strong style={{ color: 'var(--color-text)' }}>
                  {currency.format(Number(item.unitPrice) * item.quantity)}
                </strong>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '16px',
              marginTop: '16px',
              borderTop: '2px solid var(--color-border)',
            }}
          >
            <span style={{ fontWeight: 600 }}>Tổng tiền đơn hàng:</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              {currency.format(Number(order.totalPrice))}
            </span>
          </div>
        </div>

        {/* Shipping & Management */}
        <div className="cart-card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 16px 0' }}>
            Thông tin nhận hàng
          </h2>

          {!isEditingAddress ? (
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                {order.shippingAddress}
              </p>
              {order.customerPhone && (
                <p className="small muted" style={{ margin: '0 0 16px 0' }}>
                  Số điện thoại: {order.customerPhone}
                </p>
              )}

              {order.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => setIsEditingAddress(true)}
                  >
                    Sửa địa chỉ giao hàng
                  </button>
                  <button
                    type="button"
                    className="button button-small"
                    style={{
                      backgroundColor: 'var(--color-danger-subtle)',
                      color: 'var(--color-danger)',
                      borderColor: 'var(--color-danger-border)',
                    }}
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Hủy đơn hàng này
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={(e) => void handleUpdateAddress(e)}>
              <div className="form-group">
                <label htmlFor="edit-address" className="form-label">
                  Địa chỉ mới
                </label>
                <textarea
                  id="edit-address"
                  className="form-textarea"
                  rows={3}
                  required
                  minLength={5}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  disabled={updating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-phone" className="form-label">
                  Số điện thoại (tùy chọn)
                </label>
                <input
                  id="edit-phone"
                  type="tel"
                  className="form-input"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  disabled={updating}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  type="submit"
                  className="button button-primary button-small"
                  disabled={updating}
                >
                  {updating ? 'Đang lưu…' : 'Lưu địa chỉ'}
                </button>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  onClick={() => setIsEditingAddress(false)}
                  disabled={updating}
                >
                  Hủy
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Cancel Order Dialog */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        title="Xác nhận hủy đơn hàng"
        message={`Bạn có chắc chắn muốn hủy đơn hàng #${order.id.slice(0, 8)}? Số lượng sản phẩm sẽ được hoàn lại vào kho hàng KEVILO.`}
        confirmLabel="Hủy đơn hàng"
        cancelLabel="Đóng"
        variant="danger"
        loading={cancelling}
        onConfirm={() => void handleConfirmCancel()}
        onCancel={() => setShowCancelDialog(false)}
      />
    </div>
  );
}
