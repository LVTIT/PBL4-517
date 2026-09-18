import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { del, get, messageFrom, patch, post } from '../services/api';
import { useAuth } from '../services/auth';
import type { Order, OrderStatus, Product } from '../types/api';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'products' | 'orders'>('products');

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [category, setCategory] = useState('Phụ kiện');
  const [savingProduct, setSavingProduct] = useState(false);
  const [productMsg, setProductMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderMsg, setOrderMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    loadProducts();
    loadOrders();
  }, [user]);

  function loadProducts() {
    get<Product[]>('/products')
      .then((data) => setProducts(data))
      .catch(() => {});
  }

  function loadOrders() {
    setLoadingOrders(true);
    get<Order[]>('/admin/orders')
      .then((data) => setOrders(data))
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="container page-content">
        <div className="notice notice-error" role="alert">
          <span>Yêu cầu quyền Quản trị viên (ADMIN) để truy cập trang này.</span>
          <Link to="/" className="button button-primary" style={{ marginLeft: '16px' }}>Về trang chủ</Link>
        </div>
      </div>
    );
  }

  async function handleCreateProduct(e: FormEvent) {
    e.preventDefault();
    if (savingProduct) return;
    setSavingProduct(true);
    setProductMsg(null);
    try {
      await post<Product>('/products', {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        stock: Number(stock),
        category: category.trim(),
      });
      setProductMsg({ type: 'success', text: 'Thêm sản phẩm thành công!' });
      setName('');
      setDescription('');
      setPrice('');
      setStock('10');
      loadProducts();
    } catch (err) {
      setProductMsg({ type: 'error', text: messageFrom(err) });
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
    try {
      await del(`/products/${id}`);
      loadProducts();
    } catch (err) {
      alert(messageFrom(err));
    }
  }

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    setOrderMsg(null);
    try {
      await patch(`/admin/orders/${orderId}/status`, { status: newStatus });
      setOrderMsg({ type: 'success', text: `Cập nhật đơn hàng ${orderId.slice(0, 8)}… thành ${newStatus}` });
      loadOrders();
    } catch (err) {
      setOrderMsg({ type: 'error', text: messageFrom(err) });
    }
  }

  return (
    <div className="container page-content">
      <div className="page-header">
        <p className="eyebrow">KHU VỰC QUẢN TRỊ</p>
        <h1>Bảng điều khiển Admin</h1>
        <p className="muted">Quản lý kho hàng sản phẩm và danh sách đơn đặt hàng của hệ thống.</p>
      </div>

      <div className="admin-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'products'}
          className={`tab-button ${tab === 'products' ? 'active' : ''}`}
          onClick={() => setTab('products')}
        >
          Sản phẩm ({products.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'orders'}
          className={`tab-button ${tab === 'orders' ? 'active' : ''}`}
          onClick={() => setTab('orders')}
        >
          Đơn hàng ({orders.length})
        </button>
      </div>

      {tab === 'products' ? (
        <div className="admin-grid">
          <section className="profile-card">
            <h2>Thêm sản phẩm mới</h2>
            <form onSubmit={(e) => void handleCreateProduct(e)}>
              <div className="form-field">
                <label htmlFor="prod-name">Tên sản phẩm</label>
                <input
                  id="prod-name"
                  type="text"
                  required
                  maxLength={150}
                  placeholder="Ví dụ: Bàn phím cơ không dây"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={savingProduct}
                />
              </div>

              <div className="form-field">
                <label htmlFor="prod-cat">Danh mục</label>
                <input
                  id="prod-cat"
                  type="text"
                  required
                  placeholder="Bàn phím, Chuột, Âm thanh, Phụ kiện..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={savingProduct}
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="prod-price">Giá (VNĐ)</label>
                  <input
                    id="prod-price"
                    type="number"
                    required
                    min="0"
                    step="1000"
                    placeholder="500000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={savingProduct}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="prod-stock">Tồn kho</label>
                  <input
                    id="prod-stock"
                    type="number"
                    required
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    disabled={savingProduct}
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="prod-desc">Mô tả sản phẩm</label>
                <textarea
                  id="prod-desc"
                  rows={3}
                  required
                  placeholder="Thông số kỹ thuật, chất liệu, tính năng..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={savingProduct}
                />
              </div>

              {productMsg && (
                <p className={productMsg.type === 'success' ? 'form-success' : 'form-error'}>
                  {productMsg.text}
                </p>
              )}

              <button className="button button-primary" type="submit" disabled={savingProduct}>
                {savingProduct ? 'Đang thêm…' : '+ Thêm sản phẩm'}
              </button>
            </form>
          </section>

          <section className="profile-card">
            <h2>Danh sách sản phẩm ({products.length})</h2>
            <div className="admin-product-list">
              {products.map((p) => (
                <div key={p.id} className="admin-product-row">
                  <div>
                    <strong>{p.name}</strong>
                    <div className="small muted">
                      {p.category ?? 'Phụ kiện'} · {currency.format(Number(p.price))} · Kho: {p.stock}
                    </div>
                  </div>
                  <div className="admin-actions">
                    <Link to={`/products/${p.id}`} className="button button-small" target="_blank">
                      Xem
                    </Link>
                    <button
                      type="button"
                      className="button button-small button-danger"
                      onClick={() => void handleDeleteProduct(p.id)}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="orders-section">
          {orderMsg && (
            <div className="notice notice-success" style={{ marginBottom: '16px' }}>
              {orderMsg.text}
            </div>
          )}
          {loadingOrders ? (
            <div className="state-panel">
              <span className="spinner" />
              <p>Đang tải danh sách đơn hàng…</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="state-panel">
              <p className="muted">Chưa có đơn hàng nào trong hệ thống.</p>
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
                      <span className="small muted">KHÁCH HÀNG</span>
                      <p className="small">
                        {order.user ? (
                          <>
                            <strong>{order.user.name}</strong> ({order.user.email})
                          </>
                        ) : (
                          <>
                            <span style={{ display: 'inline-block', padding: '1px 6px', fontSize: '0.75rem', borderRadius: '4px', background: 'var(--color-bg-secondary, #eee)', marginRight: '4px', fontWeight: 600 }}>Khách</span>
                            <strong>{order.customerName || 'Khách vãng lai'}</strong> ({order.customerEmail || 'Không có email'})
                            {order.customerPhone && <span className="muted"> · SĐT: {order.customerPhone}</span>}
                          </>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="small muted">TỔNG TIỀN</span>
                      <p className="order-price"><strong>{currency.format(Number(order.totalPrice))}</strong></p>
                    </div>
                    <div>
                      <span className="small muted">ĐỔI TRẠNG THÁI</span>
                      <select
                        value={order.status}
                        onChange={(e) => void handleStatusChange(order.id, e.target.value as OrderStatus)}
                        className="status-select"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="CONFIRMED">CONFIRMED</option>
                        <option value="SHIPPED">SHIPPED</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                  </header>
                  <div className="order-card-body">
                    <p className="order-shipping">
                      <span className="muted small">Địa chỉ:</span> {order.shippingAddress}
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
        </section>
      )}
    </div>
  );
}
