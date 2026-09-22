import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { get, messageFrom, post } from '../services/api';
import { useAuth } from '../services/auth';
import type { Order } from '../types/api';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role === 'ADMIN') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    get<Order[]>('/orders')
      .then((data) => {
        setOrders(data);
        setError(null);
      })
      .catch((err) => {
        setError(messageFrom(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy đơn hàng này? Các sản phẩm sẽ được hoàn lại vào kho.')) {
      return;
    }
    setCancellingId(orderId);
    setActionNotice(null);
    try {
      const cancelled = await post<Order>(`/orders/${orderId}/cancel`);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? cancelled : o)));
      setActionNotice({ type: 'success', message: `Đơn hàng #${orderId.slice(0, 8)} đã được hủy thành công.` });
    } catch (err) {
      setActionNotice({ type: 'error', message: messageFrom(err) });
    } finally {
      setCancellingId(null);
    }
  };

  if (!user) {
    return (
      <div className="container page-content">
        <div className="state-panel">
          <h2>Xem lịch sử đơn hàng</h2>
          <p className="muted">Vui lòng đăng nhập bằng tài khoản Khách hàng để tra cứu các đơn hàng đã đặt.</p>
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
          <p className="muted">Tài khoản Quản trị viên không thực hiện đặt hàng cá nhân. Vui lòng chuyển sang Bảng điều khiển để theo dõi và xử lý toàn bộ đơn hàng trong hệ thống.</p>
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
      <div className="page-header">
        <p className="eyebrow">TÀI KHOẢN CỦA TÔI</p>
        <h1>Lịch sử đơn hàng ({orders.length})</h1>
        <p className="muted">Theo dõi tình trạng đơn và các mặt hàng bạn đã đặt mua tại 517 Store.</p>
      </div>

      {actionNotice && (
        <div className={`notice notice-${actionNotice.type}`} style={{ marginBottom: '20px' }}>
          {actionNotice.message}
        </div>
      )}

      {error && <div className="notice notice-error" role="alert">{error}</div>}

      {orders.length === 0 ? (
        <div className="state-panel">
          <h2>Bạn chưa có đơn hàng nào</h2>
          <p className="muted">Các sản phẩm bạn mua sẽ xuất hiện tại đây sau khi đặt hàng.</p>
          <Link to="/products" className="button button-primary" style={{ marginTop: '16px' }}>
            Mua sắm ngay
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <article key={order.id} className="order-card">
              <header className="order-card-header">
                <div>
                  <span className="small muted">MÃ ĐƠN HÀNG</span>
                  <p className="order-code">
                    <Link to={`/orders/${order.id}`} title="Bấm để xem chi tiết" style={{ color: 'inherit', textDecoration: 'underline' }}>
                      <strong>{order.id}</strong>
                    </Link>
                  </p>
                </div>
                <div>
                  <span className="small muted">NGÀY ĐẶT</span>
                  <p className="small">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
                <div>
                  <span className="small muted">TRẠNG THÁI</span>
                  <div>
                    <span className={`status-tag status-${order.status.toLowerCase()}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
                <div className="order-total-col">
                  <span className="small muted">TỔNG TIỀN</span>
                  <p className="order-price"><strong>{currency.format(Number(order.totalPrice))}</strong></p>
                </div>
              </header>

              <div className="order-card-body">
                <p className="order-shipping">
                  <span className="muted small">Địa chỉ nhận hàng:</span> {order.shippingAddress}
                </p>
                <div className="order-items-list">
                  {order.items.map((item) => (
                    <div key={item.id} className="order-item-row">
                      <span className="item-name">{item.product?.name ?? 'Sản phẩm'}</span>
                      <span className="item-qty">x{item.quantity}</span>
                      <span className="item-price">{currency.format(Number(item.unitPrice) * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f0f3eb' }}>
                  <Link to={`/orders/${order.id}`} className="button button-secondary" style={{ padding: '6px 14px', fontSize: '.82rem' }}>
                    Xem chi tiết
                  </Link>
                  {order.status === 'PENDING' && (
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={cancellingId === order.id}
                      className="button"
                      style={{
                        padding: '6px 14px',
                        fontSize: '.82rem',
                        background: '#fff0f0',
                        color: '#c84b31',
                        borderColor: '#fad2cb',
                      }}
                    >
                      {cancellingId === order.id ? 'Đang hủy…' : 'Hủy đơn'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
