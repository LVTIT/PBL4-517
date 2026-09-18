import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { get, messageFrom } from '../services/api';
import { useAuth } from '../services/auth';
import type { Order } from '../types/api';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                  <p className="order-code"><strong>{order.id}</strong></p>
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
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
