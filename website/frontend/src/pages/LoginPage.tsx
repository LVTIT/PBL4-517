import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../services/auth';
import { messageFrom } from '../services/api';
import { EyeIcon, EyeOffIcon, ArrowIcon } from '../components/Icon';
import { getPageTitle } from '../config/brand';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/products';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = getPageTitle('Đăng nhập');
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || loading) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // Ensure only internal safe paths are navigated to
      const target = from.startsWith('/') && !from.startsWith('//') ? from : '/products';
      navigate(target, { replace: true });
    } catch (err) {
      setError(messageFrom(err));
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 0);
    } finally {
      setPassword('');
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-container">
      <div className="auth-card">
        {loading ? (
          <div className="state-panel" role="status">
            <span className="spinner" />
            <p>Đang kiểm tra phiên làm việc…</p>
          </div>
        ) : user ? (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
                fontWeight: 700,
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              {user.name.slice(0, 1)}
            </div>
            <p className="section-eyebrow">PHIÊN ĐĂNG NHẬP HIỆN TẠI</p>
            <h1 className="auth-title">Chào {user.name}!</h1>
            <p className="auth-subtitle" style={{ marginBottom: '24px' }}>
              Bạn đang đăng nhập bằng email: <strong>{user.email}</strong>
            </p>
            <Link to="/products" className="button button-primary button-large" style={{ width: '100%' }}>
              <span>Khám phá sản phẩm KEVILO</span>
              <ArrowIcon size={18} />
            </Link>
          </div>
        ) : (
          <>
            <div className="auth-header">
              <p className="section-eyebrow">TÀI KHOẢN KEVILO</p>
              <h1 className="auth-title">Chào mừng trở lại</h1>
              <p className="auth-subtitle">
                Đăng nhập để đồng bộ giỏ hàng và theo dõi đơn hàng của bạn.
              </p>
            </div>

            <form onSubmit={(event) => void handleSubmit(event)}>
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email đăng nhập
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@example.com"
                  required
                  maxLength={254}
                  className="form-input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Mật khẩu
                </label>
                <div className="form-input-password-wrap">
                  <input
                    ref={passwordInputRef}
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Nhập mật khẩu của bạn"
                    required
                    minLength={8}
                    maxLength={72}
                    className="form-input"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (error) setError(null);
                    }}
                    disabled={submitting}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div id="login-error" className="notice notice-error" role="alert" style={{ marginBottom: '16px' }}>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="button button-primary button-large"
                style={{ width: '100%', marginTop: '8px' }}
                disabled={submitting}
              >
                {submitting ? 'Đang xác thực…' : 'Đăng nhập'}
              </button>
            </form>

            <div className="auth-footer">
              <span>Chưa có tài khoản? </span>
              <Link
                to="/register"
                state={{ from }}
                style={{ color: 'var(--color-primary)', fontWeight: 600 }}
              >
                Tạo tài khoản KEVILO
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
