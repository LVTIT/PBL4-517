import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { getPageTitle } from '../config/brand';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AlertCircleIcon, RefreshIcon, TrashIcon } from '../components/Icon';
import { ProductMedia } from '../components/ProductMedia';
import { del, get, messageFrom, patch, post } from '../services/api';
import { useAuth } from '../services/auth';
import type { Order, OrderStatus, Product } from '../types/api';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const IMAGE_PRESETS = [
  { value: '', label: 'Mặc định (Icon theo danh mục)' },
  { value: 'mini-68-keyboard', label: 'Bàn phím cơ Mini 68' },
  { value: 'fullsize-keyboard', label: 'Bàn phím cơ Full-size' },
  { value: 'everyday-mouse', label: 'Chuột không dây Everyday' },
  { value: 'ergo-mouse', label: 'Chuột công thái học Ergo' },
  { value: 'studio-lite-headphone', label: 'Tai nghe Studio Lite' },
  { value: 'desk-speaker', label: 'Loa để bàn KEVILO' },
  { value: 'usb-c-hub', label: 'Hub chuyển đổi USB-C 7-in-1' },
  { value: 'laptop-stand', label: 'Giá đỡ laptop nhôm nguyên khối' },
  { value: 'leather-desk-mat', label: 'Thảm lót bàn da PU cao cấp' },
  { value: 'focus-desk-lamp', label: 'Đèn bàn làm việc Focus' },
];

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPED: 'Đang giao hàng',
  DELIVERED: 'Đã giao thành công',
  CANCELLED: 'Đã hủy',
};

const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  PENDING: 'status-pending',
  CONFIRMED: 'status-confirmed',
  SHIPPED: 'status-shipped',
  DELIVERED: 'status-delivered',
  CANCELLED: 'status-cancelled',
};

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'products' | 'orders'>('products');

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);

  // New product form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [category, setCategory] = useState('Phụ kiện');
  const [imageKey, setImageKey] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [productMsg, setProductMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete product dialog
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderLoadError, setOrderLoadError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [orderMsg, setOrderMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    document.title = getPageTitle('Bảng điều khiển Admin');
  }, []);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    loadProducts();
    loadOrders();
  }, [user]);

  function loadProducts() {
    setLoadingProducts(true);
    setProductLoadError(null);
    get<Product[]>('/products')
      .then((data) => setProducts(data))
      .catch((err) => setProductLoadError(messageFrom(err)))
      .finally(() => setLoadingProducts(false));
  }

  function loadOrders() {
    setLoadingOrders(true);
    setOrderLoadError(null);
    get<Order[]>('/admin/orders')
      .then((data) => setOrders(data))
      .catch((err) => setOrderLoadError(messageFrom(err)))
      .finally(() => setLoadingOrders(false));
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="container page-content">
        <div className="notice notice-error" role="alert">
          <span>Yêu cầu quyền Quản trị viên (ADMIN) để truy cập trang này.</span>
          <Link to="/" className="button button-primary" style={{ marginLeft: '16px' }}>
            Về trang chủ
          </Link>
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
        imageKey: imageKey.trim() || undefined,
      });

      setProductMsg({ type: 'success', text: 'Thêm sản phẩm thành công vào hệ thống KEVILO!' });
      setName('');
      setDescription('');
      setPrice('');
      setStock('10');
      setImageKey('');
      loadProducts();
    } catch (err) {
      setProductMsg({ type: 'error', text: messageFrom(err) });
    } finally {
      setSavingProduct(false);
    }
  }

  async function confirmDeleteProduct() {
    if (!productToDelete) return;
    setDeletingProduct(true);
    try {
      await del(`/products/${productToDelete.id}`);
      setProductMsg({ type: 'success', text: `Đã xóa sản phẩm "${productToDelete.name}".` });
      setProductToDelete(null);
      loadProducts();
    } catch (err) {
      setProductMsg({ type: 'error', text: messageFrom(err) });
      setProductToDelete(null);
    } finally {
      setDeletingProduct(false);
    }
  }

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    setUpdatingOrderId(orderId);
    setOrderMsg(null);
    try {
      await patch(`/admin/orders/${orderId}/status`, { status: newStatus });
      setOrderMsg({
        type: 'success',
        text: `Đã cập nhật đơn hàng ${orderId.slice(0, 8)}… thành "${ORDER_STATUS_LABELS[newStatus]}".`,
      });
      loadOrders();
    } catch (err) {
      setOrderMsg({ type: 'error', text: messageFrom(err) });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  return (
    <div className="container page-content">
      <div className="page-header">
        <p className="eyebrow">KHU VỰC QUẢN TRỊ</p>
        <h1>Bảng điều khiển Admin</h1>
        <p className="muted">Quản lý kho sản phẩm KEVILO và danh sách đơn đặt hàng của toàn hệ thống.</p>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Khu vực quản trị">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'products'}
          className={`admin-tab-btn ${tab === 'products' ? 'active' : ''}`}
          onClick={() => setTab('products')}
        >
          Kho sản phẩm ({products.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'orders'}
          className={`admin-tab-btn ${tab === 'orders' ? 'active' : ''}`}
          onClick={() => setTab('orders')}
        >
          Đơn đặt hàng ({orders.length})
        </button>
      </div>

      {tab === 'products' ? (
        <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
          {/* Add Product Section */}
          <section className="profile-card" aria-labelledby="add-product-title">
            <h2 id="add-product-title" style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)' }}>
              Thêm sản phẩm mới
            </h2>

            <form onSubmit={(e) => void handleCreateProduct(e)} className="form">
              <div className="form-field">
                <label htmlFor="prod-name">Tên sản phẩm *</label>
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
                <label htmlFor="prod-cat">Danh mục *</label>
                <input
                  id="prod-cat"
                  type="text"
                  required
                  placeholder="Bàn phím, Chuột, Âm thanh, Phụ kiện, Đèn bàn"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={savingProduct}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="form-field">
                  <label htmlFor="prod-price">Giá bán (VNĐ) *</label>
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
                  <label htmlFor="prod-stock">Số lượng tồn kho *</label>
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
                <label htmlFor="prod-image">Ảnh sản phẩm (Studio Key)</label>
                <select
                  id="prod-image"
                  value={imageKey}
                  onChange={(e) => setImageKey(e.target.value)}
                  disabled={savingProduct}
                >
                  {IMAGE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                {imageKey && (
                  <div style={{ marginTop: 'var(--space-2)', width: '64px', height: '64px', borderRadius: 'var(--radius-control)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <ProductMedia imageKey={imageKey} category={category} name="Preview" aspectRatio="1/1" />
                  </div>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="prod-desc">Mô tả chi tiết *</label>
                <textarea
                  id="prod-desc"
                  rows={3}
                  required
                  placeholder="Thông số kỹ thuật, chất liệu, tính năng nổi bật..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={savingProduct}
                />
              </div>

              {productMsg && (
                <div className={`notice ${productMsg.type === 'success' ? 'notice-success' : 'notice-error'}`} role="status">
                  {productMsg.text}
                </div>
              )}

              <button className="button button-primary button-full" type="submit" disabled={savingProduct}>
                {savingProduct ? 'Đang thêm…' : '+ Thêm vào kho'}
              </button>
            </form>
          </section>

          {/* Product List Section */}
          <section className="profile-card" aria-labelledby="product-list-title">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h2 id="product-list-title" style={{ fontSize: '1.25rem', margin: 0 }}>
                Danh sách sản phẩm ({products.length})
              </h2>
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={loadProducts}
                disabled={loadingProducts}
                title="Làm mới danh sách sản phẩm"
              >
                <RefreshIcon size={14} /> Làm mới
              </button>
            </div>

            {loadingProducts ? (
              <div className="state-panel" style={{ padding: 'var(--space-8)' }}>
                <span className="spinner" aria-hidden="true" />
                <p>Đang tải dữ liệu sản phẩm…</p>
              </div>
            ) : productLoadError ? (
              <div className="state-panel" style={{ padding: 'var(--space-8)', borderColor: 'var(--color-danger-border)' }}>
                <AlertCircleIcon size={32} color="var(--color-danger)" />
                <h3>Không thể tải danh sách sản phẩm</h3>
                <p>{productLoadError}</p>
                <button type="button" className="button button-primary button-small" onClick={loadProducts}>
                  Thử lại
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="state-panel" style={{ padding: 'var(--space-8)' }}>
                <p className="muted">Chưa có sản phẩm nào trong kho.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '64px' }}>Ảnh</th>
                        <th>Tên & Danh mục</th>
                        <th>Giá bán</th>
                        <th>Tồn kho</th>
                        <th style={{ textAlign: 'right' }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-control)', overflow: 'hidden' }}>
                              <ProductMedia imageKey={p.imageKey} category={p.category} name={p.name} aspectRatio="1/1" />
                            </div>
                          </td>
                          <td>
                            <strong>{p.name}</strong>
                            <div className="small muted">{p.category ?? 'Phụ kiện'}</div>
                          </td>
                          <td>
                            <strong>{currency.format(Number(p.price))}</strong>
                          </td>
                          <td>
                            <span className={`status-badge ${p.stock > 0 ? 'status-confirmed' : 'status-cancelled'}`}>
                              {p.stock > 0 ? `Còn ${p.stock}` : 'Hết hàng'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                              <Link to={`/products/${p.id}`} className="button button-small button-secondary" target="_blank">
                                Xem
                              </Link>
                              <button
                                type="button"
                                className="button button-small button-danger"
                                onClick={() => setProductToDelete(p)}
                                title="Xóa sản phẩm"
                              >
                                <TrashIcon size={14} /> Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="admin-card-list">
                  {products.map((p) => (
                    <article key={p.id} className="order-card" style={{ padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-control)', overflow: 'hidden', flexShrink: 0 }}>
                          <ProductMedia imageKey={p.imageKey} category={p.category} name={p.name} aspectRatio="1/1" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>{p.name}</h4>
                          <p className="small muted" style={{ margin: '2px 0' }}>{p.category ?? 'Phụ kiện'} · {currency.format(Number(p.price))}</p>
                          <span className={`status-badge ${p.stock > 0 ? 'status-confirmed' : 'status-cancelled'}`}>
                            {p.stock > 0 ? `Kho: ${p.stock}` : 'Hết hàng'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)' }}>
                        <Link to={`/products/${p.id}`} className="button button-small button-secondary button-full" target="_blank">
                          Xem
                        </Link>
                        <button
                          type="button"
                          className="button button-small button-danger button-full"
                          onClick={() => setProductToDelete(p)}
                        >
                          Xóa
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        /* Orders Tab */
        <section className="orders-section" aria-labelledby="orders-list-title">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <h2 id="orders-list-title" style={{ fontSize: '1.25rem', margin: 0 }}>
              Danh sách đơn đặt hàng ({orders.length})
            </h2>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={loadOrders}
              disabled={loadingOrders}
              title="Làm mới danh sách đơn hàng"
            >
              <RefreshIcon size={14} /> Làm mới
            </button>
          </div>

          {orderMsg && (
            <div className={`notice ${orderMsg.type === 'success' ? 'notice-success' : 'notice-error'}`} role="status">
              {orderMsg.text}
            </div>
          )}

          {loadingOrders ? (
            <div className="state-panel">
              <span className="spinner" aria-hidden="true" />
              <p>Đang tải danh sách đơn đặt hàng…</p>
            </div>
          ) : orderLoadError ? (
            <div className="state-panel" style={{ borderColor: 'var(--color-danger-border)' }}>
              <AlertCircleIcon size={32} color="var(--color-danger)" />
              <h3>Không thể tải đơn đặt hàng</h3>
              <p>{orderLoadError}</p>
              <button type="button" className="button button-primary button-small" onClick={loadOrders}>
                Thử lại
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="state-panel">
              <p className="muted">Chưa có đơn hàng nào trong hệ thống KEVILO.</p>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <article key={order.id} className="order-card">
                  <header className="order-card-header">
                    <div>
                      <span className="small muted">MÃ ĐƠN HÀNG</span>
                      <p className="order-code">
                        <strong>{order.id}</strong>
                      </p>
                    </div>

                    <div>
                      <span className="small muted">KHÁCH HÀNG</span>
                      <p className="small" style={{ margin: '2px 0 0' }}>
                        {order.user ? (
                          <>
                            <span className="status-badge status-confirmed" style={{ marginRight: '6px' }}>Thành viên</span>
                            <strong>{order.user.name}</strong> ({order.user.email})
                          </>
                        ) : (
                          <>
                            <span className="status-badge status-pending" style={{ marginRight: '6px' }}>Khách vãng lai</span>
                            <strong>{order.customerName || 'Khách vãng lai'}</strong>
                            {order.customerEmail && <span className="muted"> · {order.customerEmail}</span>}
                            {order.customerPhone && <span className="muted"> · SĐT: {order.customerPhone}</span>}
                          </>
                        )}
                      </p>
                    </div>

                    <div>
                      <span className="small muted">TỔNG TIỀN</span>
                      <p className="order-price">
                        <strong>{currency.format(Number(order.totalPrice))}</strong>
                      </p>
                    </div>

                    <div>
                      <span className="small muted">TRẠNG THÁI HIỆN TẠI</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '4px' }}>
                        <span className={`status-badge ${ORDER_STATUS_CLASSES[order.status]}`}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                        <select
                          aria-label={`Thay đổi trạng thái cho đơn ${order.id}`}
                          value={order.status}
                          disabled={updatingOrderId === order.id}
                          onChange={(e) => void handleStatusChange(order.id, e.target.value as OrderStatus)}
                          className="status-select"
                          style={{
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-control)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            fontWeight: 500,
                            fontSize: '0.8125rem',
                          }}
                        >
                          <option value="PENDING">PENDING (Chờ xác nhận)</option>
                          <option value="CONFIRMED">CONFIRMED (Đã xác nhận)</option>
                          <option value="SHIPPED">SHIPPED (Đang giao)</option>
                          <option value="DELIVERED">DELIVERED (Đã giao)</option>
                          <option value="CANCELLED">CANCELLED (Đã hủy)</option>
                        </select>
                        {updatingOrderId === order.id && <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} aria-hidden="true" />}
                      </div>
                    </div>
                  </header>

                  <div className="order-card-body">
                    <p className="order-shipping" style={{ margin: '0 0 var(--space-3) 0' }}>
                      <strong className="muted small">Địa chỉ nhận hàng:</strong> {order.shippingAddress}
                    </p>

                    <div className="order-items-list">
                      {order.items.map((item) => (
                        <div key={item.id} className="order-item-row">
                          <span className="item-name">
                            {item.product?.name ?? 'Sản phẩm không xác định'}
                          </span>
                          <span className="item-qty">x{item.quantity}</span>
                          <span className="item-price">
                            {currency.format(Number(item.unitPrice) * item.quantity)}
                          </span>
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

      {/* Product deletion confirmation dialog */}
      <ConfirmDialog
        isOpen={Boolean(productToDelete)}
        title="Xác nhận xóa sản phẩm"
        message={`Bạn có chắc chắn muốn xóa sản phẩm "${productToDelete?.name}" khỏi kho KEVILO? Hành động này sẽ không thể hoàn tác nếu sản phẩm chưa liên kết với đơn hàng nào.`}
        confirmText="Xóa sản phẩm"
        cancelText="Giữ lại"
        variant="danger"
        isLoading={deletingProduct}
        onConfirm={() => void confirmDeleteProduct()}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
}
