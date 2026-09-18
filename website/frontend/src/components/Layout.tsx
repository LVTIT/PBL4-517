import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../services/auth';
import { useCart } from '../services/cart';
import { messageFrom } from '../services/api';

export function Layout() {
  const { user, loading, error, refresh, logout } = useAuth();
  const { totalCount, clearCart } = useCart();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      clearCart();
      await logout();
    } catch (error) {
      setLogoutError(messageFrom(error));
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Đến nội dung chính</a>
      <div className="announcement">Những điều nhỏ. Một ngày làm việc tốt hơn. PBL4 - Đề tài 517.</div>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label="517 Store, trang chủ">
            <span className="brand-mark">517</span>
            <span>store<span className="brand-dot">.</span></span>
          </Link>
          <nav className="main-nav" aria-label="Điều hướng chính">
            <NavLink to="/" end>Trang chủ</NavLink>
            <NavLink to="/products">Sản phẩm</NavLink>
            {user?.role === 'CUSTOMER' && <NavLink to="/orders">Đơn hàng</NavLink>}
            {user?.role === 'ADMIN' && <NavLink to="/admin" className="admin-nav-link">Quản trị</NavLink>}
          </nav>

          <div className="account-nav">
            {user?.role !== 'ADMIN' && (
              <Link to="/cart" className="cart-nav-link" aria-label={`Giỏ hàng có ${totalCount} sản phẩm`}>
                <span className="cart-icon" aria-hidden="true">🛒</span>
                <span>Giỏ hàng</span>
                {totalCount > 0 && <span className="cart-badge">{totalCount}</span>}
              </Link>
            )}

            {loading ? (
              <span className="muted small" role="status">Đang tải…</span>
            ) : user ? (
              <>
                <NavLink to="/profile" className="account-name" title={user.email}>
                  Chào, {user.name}
                </NavLink>
                <button
                  className="text-button"
                  disabled={loggingOut}
                  onClick={() => void handleLogout()}
                >
                  {loggingOut ? 'Đang thoát…' : 'Đăng xuất'}
                </button>
              </>
            ) : (
              <div className="auth-links">
                <NavLink to="/register" className="register-nav-link">Đăng ký</NavLink>
                <NavLink className="login-link" to="/login">
                  Đăng nhập <span aria-hidden="true">↗</span>
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </header>
      {(error || logoutError) && (
        <div className="container notice notice-error" role="alert">
          <span>{logoutError ?? `Chưa thể tải tài khoản. ${error}`}</span>
          {error && <button className="text-button" disabled={loading} onClick={() => void refresh()}>Thử lại</button>}
        </div>
      )}
      <main id="main-content"><Outlet /></main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Link className="footer-brand" to="/">517 store.</Link>
          <p>Phụ kiện giản đơn, cảm hứng mỗi ngày. Nền tảng kiểm thử bảo mật AWS Cloud.</p>
          <span className="small">PBL4 · Nhóm 517</span>
        </div>
      </footer>
    </>
  );
}
