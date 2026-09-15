import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../services/auth';
import { messageFrom } from '../services/api';

export function Layout() {
  const { user, loading, error, refresh, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
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
      <div className="announcement">Những điều nhỏ. Một ngày làm việc tốt hơn.</div>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label="517 Store, trang chủ"><span className="brand-mark">517</span><span>store<span className="brand-dot">.</span></span></Link>
          <nav className="main-nav" aria-label="Điều hướng chính">
            <NavLink to="/" end>Trang chủ</NavLink>
            <NavLink to="/products">Sản phẩm</NavLink>
          </nav>
          <div className="account-nav">
            {loading ? <span className="muted small" role="status">Đang tải tài khoản…</span> : user ? <>
              <span className="account-name" title={user.email}>Chào, {user.name}</span>
              <button className="text-button" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
            </> : <NavLink className="login-link" to="/login">Đăng nhập <span aria-hidden="true">↗</span></NavLink>}
          </div>
        </div>
      </header>
      {(error || logoutError) && <div className="container notice notice-error" role="alert">
        <span>{logoutError ?? `Chưa thể tải tài khoản. ${error}`}</span>
        {error && <button className="text-button" disabled={loading} onClick={() => void refresh()}>Thử lại</button>}
      </div>}
      <main id="main-content"><Outlet /></main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Link className="footer-brand" to="/">517 store.</Link>
          <p>Phụ kiện giản đơn, cảm hứng mỗi ngày.</p>
          <span className="small">PBL4 · Nhóm 517</span>
        </div>
      </footer>
    </>
  );
}
