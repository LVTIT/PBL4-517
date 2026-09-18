import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowIcon } from '../components/Icon';
import { useAuth } from '../services/auth';
import { messageFrom } from '../services/api';

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/products';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || loading) return;

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container login-page">
      <section className="login-story">
        <p className="eyebrow">THÀNH VIÊN MỚI</p>
        <h1>Bắt đầu hành trình <br />cùng không gian <br /><span>gọn gàng.</span></h1>
        <p>Đăng ký tài khoản 517 Store để lưu trữ giỏ hàng, nhận ưu đãi và trải nghiệm mua sắm đồng bộ.</p>
        <div className="login-art" aria-hidden="true"><span /><span /><span /><span /></div>
        <span className="login-story-note">JOIN 517 COMMUNITY TODAY.</span>
      </section>
      <section className="login-form-panel" aria-labelledby="register-heading">
        {loading ? (
          <div className="state-panel" role="status">
            <span className="spinner" />
            <p>Đang kiểm tra thông tin…</p>
          </div>
        ) : user ? (
          <div className="account-panel">
            <span className="account-avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
            <p className="eyebrow">BẠN ĐÃ ĐĂNG NHẬP</p>
            <h2 id="register-heading">Chào {user.name}!</h2>
            <p className="account-email">{user.email}</p>
            <p>Bạn đã đăng nhập rồi, hãy khám phá các sản phẩm ngay.</p>
            <Link className="button button-primary" to="/products">Khám phá sản phẩm <ArrowIcon /></Link>
          </div>
        ) : (
          <>
            <p className="eyebrow">TẠO TÀI KHOẢN MỚI</p>
            <h2 id="register-heading">Đăng ký thành viên</h2>
            <p className="muted">Nhập thông tin bên dưới để tạo tài khoản.</p>
            <form onSubmit={(event) => void handleSubmit(event)}>
              <div className="form-field">
                <label htmlFor="name">Họ và tên</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="form-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="ban@example.com"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="form-field">
                <label htmlFor="password">Mật khẩu</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Tối thiểu 8 ký tự"
                  required
                  minLength={8}
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="form-field">
                <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  required
                  minLength={8}
                  maxLength={72}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={submitting}
                />
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button-primary submit-button" type="submit" disabled={submitting}>
                {submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
                <ArrowIcon />
              </button>
            </form>
            <div className="login-bottom-note">
              Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
