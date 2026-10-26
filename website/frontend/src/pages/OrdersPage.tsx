import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { get, messageFrom, post } from '../services/api';
import { useAuth } from '../services/auth';
import type { Order, OrderStatus } from '../types/api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RefreshIcon } from '../components/Icon';
import { getPageTitle } from '../config/brand';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export const STATUS_MAP: Record<OrderStatus, { text: string; className: string }> = {
  PENDING: { text: 'Chờ xử lý', className: 'status-pending' },
  CONFIRMED: { text: 'Đã xác nhận', className: 'status-confirmed' },
  SHIPPED: { text: 'Đang giao', className: 'status-shipped' },
  DELIVERED: { text: 'Đã giao', className: 'status-delivered' },
  CANCELLED: { text: 'Đã hủy', className: 'status-cancelled' },
};

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    document.title = getPageTitle('Lịch sử đơn hàng');
  }, []);

  const loadOrders = () => {
    if (!user || user.role === 'ADMIN') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    get<Order[]>('/orders')
      .then((data) => {
        setOrders(data);
      })
      .catch((err) => {
        setError(messageFrom(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadOrders();
  }, [user]);

  async function handleConfirmCancel() {
    if (!cancellingOrder) return;
    setIsCancelling(true);
    setActionNotice(null);
    try {
      const cancelled = await post<Order>(`/orders/${cancellingOrder.id}/cancel`);
      setOrders((prev) => prev.map((o) => (o.id === cancellingOrder.id ? cancelled : o)));
      setActionNotice({
        type: 'success',
        message: `Đơn hàng #${cancellingOrder.id.slice(0, 8)} đã được hủy thành công và hoàn trả số lượng vào kho.`,
      });
      setCancellingOrder(null);
    } catch (err) {
      setActionNotice({ type: 'error', message: messageFrom(err) });
    } finally {
      setIsCancelling(false);
    }
  }

  if (!user) {
    return (
      <div className="container page-content">
        <div className="state-panel" role="alert">
          <h2>Yêu cầu đăng nhập</h2>
          <p>Vui lòng đăng nhập bằng tài khoản Khách hàng để theo dõi lịch sử đơn hàng của bạn.</p>
          <Link to="/login" className="button button-primary" style={{ marginTop: '16px' }}>
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  if (user.role === 'ADMIN') {
    return (
      <div className="container page-content">
        <div className="state-panel">
          <h2>Khu vực Quản trị Đơn hàng</h2>
          <p>
            Tài khoản Quản trị viên theo dõi và xử lý toàn bộ đơn hàng của khách hàng tại Bảng điều khiển.
          </p>
          <Link to="/admin" className="button button-primary" style={{ marginTop: '16px' }}>
            Quản lý đơn hàng tại Bảng điều khiển Admin
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
          <p>Đang tải danh sách đơn hàng…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-content">
      <header className="section-header" style={{ marginBottom: '28px' }}>
        <p className="section-eyebrow">TÀI KHOẢN KEVILO</p>
        <h1 className="section-title">Lịch sử đơn hàng ({orders.length})</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>
          Theo dõi trạng thái và chi tiết các đơn hàng bạn đã đặt mua.
        </p>
      </header>

      {actionNotice && (
        <div className={`notice notice-${actionNotice.type}`} style={{ marginBottom: '20px' }}>
          <span>{actionNotice.message}</span>
        </div>
      )}

      {error && (
        <div className="notice notice-error" role="alert" style={{ marginBottom: '20px' }}>
          <span>{error}</span>
          <button type="button" className="text-button" onClick={loadOrders}>
            <RefreshIcon size={14} /> Thử lại
          </button>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="state-panel">
          <h2>Bạn chưa có đơn hàng nào</h2>
          <p>Các sản phẩm bạn đặt mua sẽ hiển thị tại đây.</p>
          <Link to="/products" className="button button-primary" style={{ marginTop: '16px' }}>
            Khám phá sản phẩm
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => {
            const statusInfo = STATUS_MAP[order.status] ?? {
              text: order.status,
              className: 'status-pending',
            };

            return (
              <article key={order.id} className="order-card">
                <header className="order-card-header">
                  <div>
                    <span className="small muted">MÃ ĐƠN HÀNG</span>
                    <p style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-mono)' }}>
                      <Link
                        to={`/orders/${order.id}`}
                        style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                      >
                        #{order.id.slice(0, 8)}…
                      </Link>
                    </p>
                  </div>

                  <div>
                    <span className="small muted">NGÀY ĐẶT</span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.9375rem' }}>
                      {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>

                  <div>
                    <span className="small muted">TRẠNG THÁI</span>
                    <div style={{ marginTop: '4px' }}>
                      <span className={`order-status-badge ${statusInfo.className}`}>
                        {statusInfo.text}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="small muted">TỔNG TIỀN</span>
                    <p style={{ margin: '4px 0 0 0', fontWeight: 700, color: 'var(--color-text)' }}>
                      {currency.format(Number(order.totalPrice))}
                    </p>
                  </div>
                </header>

                <div style={{ padding: '16px 0 0 0' }}>
                  <p className="small muted" style={{ margin: '0 0 12px 0' }}>
                    <strong>Địa chỉ giao hàng:</strong> {order.shippingAddress}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.875rem',
                          paddingBlock: '4px',
                        }}
                      >
                        <span>
                          {item.product?.name ?? 'Sản phẩm'}{' '}
                          <span className="small muted">× {item.quantity}</span>
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {currency.format(Number(item.unitPrice) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <Link
                      to={`/orders/${order.id}`}
                      className="button button-secondary button-small"
                    >
                      Xem chi tiết
                    </Link>

                    {order.status === 'PENDING' && (
                      <button
                        type="button"
                        className="button button-small"
                        style={{
                          backgroundColor: 'var(--color-danger-subtle)',
                          color: 'var(--color-danger)',
                          borderColor: 'var(--color-danger-border)',
                        }}
                        onClick={() => setCancellingOrder(order)}
                      >
                        Hủy đơn hàng
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Accessible Cancel Order Dialog */}
      <ConfirmDialog
        isOpen={Boolean(cancellingOrder)}
        title="Xác nhận hủy đơn hàng"
        message={`Bạn có chắc chắn muốn hủy đơn hàng #${cancellingOrder?.id.slice(0, 8)}? Số lượng sản phẩm sẽ được tự động hoàn lại vào kho hàng KEVILO.`}
        confirmLabel="Hủy đơn hàng"
        cancelLabel="Giữ lại"
        variant="danger"
        loading={isCancelling}
        onConfirm={() => void handleConfirmCancel()}
        onCancel={() => setCancellingOrder(null)}
      />
    </div>
  );
}
