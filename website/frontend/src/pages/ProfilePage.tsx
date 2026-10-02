import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../services/auth';
import { messageFrom } from '../services/api';
import { EyeIcon, EyeOffIcon, ArrowIcon } from '../components/Icon';
import { getPageTitle } from '../config/brand';

export function ProfilePage() {
  const { user, loading: authLoading, updateProfile, changePassword } = useAuth();

  const [name, setName] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    document.title = getPageTitle('Hồ sơ cá nhân');
  }, []);

  // Initialize name only after auth has completed loading
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.name]);

  if (authLoading) {
    return (
      <div className="container page-content">
        <div className="state-panel" role="status">
          <span className="spinner" />
          <p>Đang tải thông tin tài khoản…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container page-content">
        <div className="state-panel" role="alert">
          <h2>Yêu cầu đăng nhập</h2>
          <p>Vui lòng đăng nhập để xem và quản lý thông tin tài khoản của bạn.</p>
          <Link to="/login" className="button button-primary" style={{ marginTop: '16px' }}>
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  async function handleUpdateProfile(e: FormEvent) {
    e.preventDefault();
    if (updatingProfile) return;
    setUpdatingProfile(true);
    setProfileMsg(null);
    try {
      await updateProfile(name.trim());
      setProfileMsg({ type: 'success', text: 'Cập nhật họ tên thành công.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: messageFrom(err) });
    } finally {
      setUpdatingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (changingPass) return;
    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    if (newPassword.length < 8) {
      setPassMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
      return;
    }
    setChangingPass(true);
    setPassMsg(null);
    try {
      await changePassword(oldPassword, newPassword);
      setPassMsg({ type: 'success', text: 'Đổi mật khẩu thành công.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassMsg({ type: 'error', text: messageFrom(err) });
    } finally {
      setChangingPass(false);
    }
  }

  const roleText = user.role === 'ADMIN' ? 'Quản trị viên' : 'Khách hàng';

  return (
    <div className="container page-content">
      <header className="section-header" style={{ marginBottom: '32px' }}>
        <p className="section-eyebrow">TÀI KHOẢN KEVILO</p>
        <h1 className="section-title">Hồ sơ cá nhân</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>
          Quản lý thông tin định danh và bảo mật tài khoản.
        </p>
      </header>

      <div className="profile-grid">
        {/* Personal Info Card */}
        <section className="profile-card" aria-labelledby="personal-info-heading">
          <h2 id="personal-info-heading" style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 16px 0' }}>
            Thông tin chung
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span className="small muted">Email đăng nhập:</span>
              <strong style={{ fontSize: '0.9375rem' }}>{user.email}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="small muted">Vai trò hệ thống:</span>
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: user.role === 'ADMIN' ? '#EFF6FF' : '#F1F5F9',
                  color: user.role === 'ADMIN' ? 'var(--color-primary)' : 'var(--color-text)',
                }}
              >
                {roleText}
              </span>
            </div>
          </div>

          <form onSubmit={(e) => void handleUpdateProfile(e)}>
            <div className="form-group">
              <label htmlFor="profile-name" className="form-label">
                Họ và tên
              </label>
              <input
                id="profile-name"
                type="text"
                required
                maxLength={100}
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={updatingProfile}
              />
            </div>

            {profileMsg && (
              <div
                className={`notice notice-${profileMsg.type}`}
                style={{ marginBottom: '16px' }}
              >
                {profileMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="button button-primary"
              disabled={updatingProfile || !name.trim() || name.trim() === user.name}
            >
              {updatingProfile ? 'Đang lưu…' : 'Cập nhật họ tên'}
            </button>
          </form>

          {/* Role specific link */}
          <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--color-border-subtle)' }}>
            {user.role === 'ADMIN' ? (
              <Link to="/admin" className="button button-secondary" style={{ width: '100%' }}>
                <span>Đến Bảng điều khiển Quản trị</span>
                <ArrowIcon size={16} />
              </Link>
            ) : (
              <Link to="/orders" className="button button-secondary" style={{ width: '100%' }}>
                <span>Xem lịch sử đơn hàng của bạn</span>
                <ArrowIcon size={16} />
              </Link>
            )}
          </div>
        </section>

        {/* Change Password Card */}
        <section className="profile-card" aria-labelledby="security-heading">
          <h2 id="security-heading" style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 8px 0' }}>
            Bảo mật & Mật khẩu
          </h2>
          <p className="small muted" style={{ margin: '0 0 20px 0' }}>
            Thay đổi mật khẩu định kỳ để nâng cao tính bảo mật.
          </p>

          <form onSubmit={(e) => void handleChangePassword(e)}>
            <div className="form-group">
              <label htmlFor="old-pass" className="form-label">
                Mật khẩu hiện tại
              </label>
              <div className="form-input-password-wrap">
                <input
                  id="old-pass"
                  type={showOldPass ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className="form-input"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  disabled={changingPass}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowOldPass((p) => !p)}
                  aria-label={showOldPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showOldPass ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="new-pass" className="form-label">
                Mật khẩu mới
              </label>
              <div className="form-input-password-wrap">
                <input
                  id="new-pass"
                  type={showNewPass ? 'text' : 'password'}
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  placeholder="Tối thiểu 8 ký tự"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changingPass}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowNewPass((p) => !p)}
                  aria-label={showNewPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showNewPass ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirm-pass" className="form-label">
                Xác nhận mật khẩu mới
              </label>
              <div className="form-input-password-wrap">
                <input
                  id="confirm-pass"
                  type={showConfirmPass ? 'text' : 'password'}
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu mới"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={changingPass}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowConfirmPass((p) => !p)}
                  aria-label={showConfirmPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showConfirmPass ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>

            {passMsg && (
              <div
                className={`notice notice-${passMsg.type}`}
                style={{ marginBottom: '16px' }}
              >
                {passMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="button button-primary"
              disabled={changingPass || !oldPassword || !newPassword}
            >
              {changingPass ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
