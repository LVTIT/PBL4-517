import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../services/auth';
import { messageFrom } from '../services/api';
import { EyeIcon, EyeOffIcon } from '../components/Icon';
import { getPageTitle } from '../config/brand';

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/products';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<'name' | 'email' | 'password' | 'confirmPassword' | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = getPageTitle('Đăng ký thành viên');
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || loading) return;

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      setErrorField('confirmPassword');
      confirmPasswordInputRef.current?.focus();
      return;
    }

    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      setErrorField('password');
      passwordInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);
    setErrorField(null);
    try {
      await register(name.trim(), email.trim(), password);
      const target = from.startsWith('/') && !from.startsWith('//') ? from : '/products';
      navigate(target, { replace: true });
    } catch (err) {
      const msg = messageFrom(err);
      setError(msg);
      if (msg.toLowerCase().includes('email')) {
        setErrorField('email');
        emailInputRef.current?.focus();
      } else if (msg.toLowerCase().includes('mật khẩu') || msg.toLowerCase().includes('password')) {
        setErrorField('password');
        passwordInputRef.current?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-container">
      <div className="auth-card">
        {loading ? (
          <div className="state-panel" role="status">
            <span className="spinner" />
            <p>Đang kiểm tra thông tin…</p>
          </div>
        ) : user ? (
          <div style={{ textAlign: 'center' }}>
            <p className="section-eyebrow">BẠN ĐÃ ĐĂNG NHẬP</p>
            <h1 className="auth-title">Chào {user.name}!</h1>
            <p className="auth-subtitle" style={{ marginBottom: '24px' }}>
              Bạn đã có tài khoản KEVILO hoạt động.
            </p>
            <Link to="/products" className="button button-primary button-large" style={{ width: '100%' }}>
              Khám phá sản phẩm
            </Link>
          </div>
        ) : (
          <>
            <div className="auth-header">
              <p className="section-eyebrow">THÀNH VIÊN MỚI</p>
              <h1 className="auth-title">Tạo tài khoản KEVILO</h1>
              <p className="auth-subtitle">
                Trải nghiệm lưu trữ giỏ hàng và quản lý đơn hàng thuận tiện.
              </p>
            </div>

            <form onSubmit={(event) => void handleSubmit(event)}>
              <div className="form-group">
                <label htmlFor="name" className="form-label">
                  Họ và tên
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  required
                  maxLength={100}
                  className="form-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  ref={emailInputRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="ban@example.com"
                  required
                  maxLength={254}
                  className="form-input"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errorField === 'email') {
                      setError(null);
                      setErrorField(null);
                    }
                  }}
                  disabled={submitting}
                  aria-invalid={errorField === 'email' ? true : undefined}
                  aria-describedby={errorField === 'email' ? 'register-error' : undefined}
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
                    autoComplete="new-password"
                    placeholder="Tối thiểu 8 ký tự"
                    required
                    minLength={8}
                    maxLength={72}
                    className="form-input"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (errorField === 'password') {
                        setError(null);
                        setErrorField(null);
                      }
                    }}
                    disabled={submitting}
                    aria-invalid={errorField === 'password' ? true : undefined}
                    aria-describedby={errorField === 'password' ? 'register-error' : undefined}
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

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Xác nhận mật khẩu
                </label>
                <div className="form-input-password-wrap">
                  <input
                    ref={confirmPasswordInputRef}
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu"
                    required
                    minLength={8}
                    maxLength={72}
                    className="form-input"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      if (errorField === 'confirmPassword') {
                        setError(null);
                        setErrorField(null);
                      }
                    }}
                    disabled={submitting}
                    aria-invalid={errorField === 'confirmPassword' ? true : undefined}
                    aria-describedby={errorField === 'confirmPassword' ? 'register-error' : undefined}
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showConfirmPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div id="register-error" className="notice notice-error" role="alert" style={{ marginBottom: '16px' }}>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="button button-primary button-large"
                style={{ width: '100%', marginTop: '8px' }}
                disabled={submitting}
              >
                {submitting ? 'Đang tạo tài khoản…' : 'Hoàn tất đăng ký'}
              </button>
            </form>

            <div className="auth-footer">
              <span>Đã có tài khoản? </span>
              <Link
                to="/login"
                state={{ from }}
                style={{ color: 'var(--color-primary)', fontWeight: 600 }}
              >
                Đăng nhập ngay
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
