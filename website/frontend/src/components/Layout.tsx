import { useState, useEffect, useRef, Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../services/auth';
import { useCart } from '../services/cart';
import { messageFrom } from '../services/api';
import { BrandLogo } from './BrandLogo';
import { CartIcon, MenuIcon, CloseIcon, UserIcon } from './Icon';
import { BRAND_FOOTER_NOTE, BRAND_TAGLINE, BRAND_COMMUNITY } from '../config/brand';

export function Layout() {
  const { user, loading, error, refresh, logout } = useAuth();
  const { totalCount, clearCart } = useCart();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  const drawerRef = useRef<HTMLElement>(null);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle Escape key, focus trapping, and lock body scroll for mobile drawer
  useEffect(() => {
    if (!mobileMenuOpen) return;

    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      if (drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          focusables[0]?.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMobileMenu();
        return;
      }

      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      clearCart();
      await logout();
    } catch (err) {
      setLogoutError(messageFrom(err));
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>

      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand-link" to="/" aria-label="KEVILO, trang chủ">
            <BrandLogo size={32} />
          </Link>

          {/* Desktop Navigation */}
          <nav className="desktop-nav" aria-label="Điều hướng chính">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Trang chủ
            </NavLink>
            <NavLink to="/products" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Sản phẩm
            </NavLink>
            {user?.role === 'CUSTOMER' && (
              <NavLink to="/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Đơn hàng
              </NavLink>
            )}
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Quản trị
              </NavLink>
            )}
          </nav>

          {/* Header Actions */}
          <div className="header-actions">
            {user?.role !== 'ADMIN' && (
              <Link
                to="/cart"
                className="cart-btn-link"
                aria-label={`Giỏ hàng, có ${totalCount} sản phẩm`}
              >
                <CartIcon size={20} />
                <span className="cart-label">Giỏ hàng</span>
                {totalCount > 0 && <span className="cart-badge">{totalCount}</span>}
              </Link>
            )}

            {loading ? (
              <span className="small muted header-session-status" role="status">Đang tải…</span>
            ) : user ? (
              <div className="account-dropdown-wrap header-account-actions">
                <NavLink
                  to="/profile"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  title={user.email}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <UserIcon size={16} />
                  <span>{user.name}</span>
                </NavLink>
                <button
                  type="button"
                  className="text-button small"
                  disabled={loggingOut}
                  onClick={() => void handleLogout()}
                >
                  {loggingOut ? 'Đang thoát…' : 'Đăng xuất'}
                </button>
              </div>
            ) : (
              <div className="header-account-actions">
                <NavLink to="/login" className="button button-small button-secondary">
                  Đăng nhập
                </NavLink>
                <NavLink to="/register" className="button button-small button-primary">
                  Đăng ký
                </NavLink>
              </div>
            )}

            {/* Mobile menu trigger */}
            <button
              ref={menuButtonRef}
              type="button"
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở menu điều hướng"
              aria-expanded={mobileMenuOpen}
            >
              <MenuIcon size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={closeMobileMenu}
        >
          <aside
            ref={drawerRef}
            className="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu điều hướng di động"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <Link to="/" onClick={closeMobileMenu} aria-label="KEVILO, trang chủ">
                <BrandLogo size={28} />
              </Link>
              <button
                type="button"
                className="dialog-close-btn"
                onClick={closeMobileMenu}
                aria-label="Đóng menu"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <nav className="drawer-nav" aria-label="Điều hướng di động">
              <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeMobileMenu}>
                Trang chủ
              </NavLink>
              <NavLink to="/products" className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeMobileMenu}>
                Sản phẩm
              </NavLink>
              {user?.role === 'CUSTOMER' && (
                <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeMobileMenu}>
                  Đơn hàng của tôi
                </NavLink>
              )}
              {user?.role === 'ADMIN' && (
                <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeMobileMenu}>
                  Bảng điều khiển Quản trị
                </NavLink>
              )}
              {user && (
                <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeMobileMenu}>
                  Hồ sơ cá nhân
                </NavLink>
              )}
            </nav>

            <div className="drawer-footer">
              {user ? (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={loggingOut}
                  onClick={() => void handleLogout()}
                >
                  {loggingOut ? 'Đang thoát…' : 'Đăng xuất tài khoản'}
                </button>
              ) : (
                <>
                  <NavLink to="/login" className="button button-primary" onClick={closeMobileMenu}>
                    Đăng nhập
                  </NavLink>
                  <NavLink to="/register" className="button button-secondary" onClick={closeMobileMenu}>
                    Đăng ký tài khoản
                  </NavLink>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Global Error Banner */}
      {(error || logoutError) && (
        <div className="container" style={{ marginTop: '16px' }}>
          <div className="notice notice-error" role="alert">
            <span>{logoutError ?? `Chưa thể tải thông tin phiên đăng nhập. ${error}`}</span>
            {error && (
              <button
                type="button"
                className="text-button"
                disabled={loading}
                onClick={() => void refresh()}
              >
                Thử lại
              </button>
            )}
          </div>
        </div>
      )}

      <main id="main-content">
        <Suspense
          fallback={
            <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
              <div className="state-panel" role="status">
                <span className="spinner" />
                <p>Đang tải trang…</p>
              </div>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-inner">
            <div>
              <div className="footer-brand-title">KEVILO</div>
              <p className="footer-tagline">{BRAND_TAGLINE}</p>
            </div>
            <div>
              <span className="small">{BRAND_COMMUNITY}</span>
            </div>
          </div>
          <div className="footer-note">
            <p style={{ margin: 0 }}>{BRAND_FOOTER_NOTE}</p>
          </div>
        </div>
      </footer>
    </>
  );
}
