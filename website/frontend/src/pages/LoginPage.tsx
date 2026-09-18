import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowIcon } from '../components/Icon';
import { useAuth } from '../services/auth';
import { messageFrom } from '../services/api';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/products';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || loading) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (error) {
      setError(messageFrom(error));
    } finally {
      setPassword('');
      setSubmitting(false);
    }
  }

  return (
    <div className="container login-page">
      <section className="login-story">
        <p className="eyebrow">XIN CHÀO TỪ 517 STORE</p>
        <h1>Một góc nhỏ <br />dành riêng <br /><span>cho bạn.</span></h1>
        <p>Đăng nhập và tiếp tục khám phá những món đồ hữu ích cho mỗi ngày.</p>
        <div className="login-art" aria-hidden="true"><span /><span /><span /><span /></div>
        <span className="login-story-note">MAKE SPACE FOR GOOD THINGS.</span>
      </section>
      <section className="login-form-panel" aria-labelledby="login-heading">
        {loading ? <div className="state-panel" role="status"><span className="spinner" /><p>Đang kiểm tra phiên đăng nhập…</p></div> : user ? <div className="account-panel">
          <span className="account-avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
          <p className="eyebrow">BẠN ĐÃ ĐĂNG NHẬP</p>
          <h2 id="login-heading">Chào {user.name}!</h2>
          <p className="account-email">{user.email}</p>
          <p>Rất vui được gặp bạn tại 517 Store.</p>
          <Link className="button button-primary" to="/products">Khám phá sản phẩm <ArrowIcon /></Link>
        </div> : <>
          <p className="eyebrow">TÀI KHOẢN CỦA BẠN</p>
          <h2 id="login-heading">Chào mừng trở lại.</h2>
          <p className="muted">Đăng nhập bằng email để tiếp tục.</p>
          <form onSubmit={(event) => void handleSubmit(event)}>
            <div className="form-field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" placeholder="ban@example.com" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} /></div>
            <div className="form-field"><label htmlFor="password">Mật khẩu</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu của bạn" required minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} aria-describedby={error ? 'login-error' : undefined} /></div>
            {error && <p id="login-error" className="form-error" role="alert">{error}</p>}
            <button className="button button-primary submit-button" type="submit" disabled={submitting}>{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}<ArrowIcon /></button>
          </form>
          <div className="login-bottom-note">
            <span>Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></span>
            <span style={{ marginInline: '8px' }}>·</span>
            <Link to="/products">Khám phá sản phẩm</Link>
          </div>
        </>}
      </section>
    </div>
  );
}
