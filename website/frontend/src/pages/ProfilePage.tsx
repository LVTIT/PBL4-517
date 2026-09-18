import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../services/auth';
import { messageFrom } from '../services/api';

export function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!user) {
    return (
      <div className="container page-content">
        <div className="notice notice-error" role="alert">
          <span>Vui lòng đăng nhập để xem thông tin tài khoản.</span>
          <Link className="button button-primary" to="/login" style={{ marginLeft: '16px' }}>Đăng nhập</Link>
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
      setProfileMsg({ type: 'success', text: 'Cập nhật thông tin thành công.' });
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

  return (
    <div className="container page-content">
      <div className="page-header">
        <p className="eyebrow">TÀI KHOẢN CỦA TÔI</p>
        <h1>Hồ sơ cá nhân</h1>
        <p className="muted">Quản lý thông tin cá nhân và bảo mật tài khoản tại 517 Store.</p>
      </div>

      <div className="profile-grid">
        <section className="profile-card">
          <h2>Thông tin chung</h2>
          <div className="profile-meta-item">
            <span className="profile-label">Email tài khoản:</span>
            <span className="profile-value"><strong>{user.email}</strong></span>
          </div>
          <div className="profile-meta-item">
            <span className="profile-label">Vai trò hệ thống:</span>
            <span className="badge">{user.role}</span>
          </div>

          <form onSubmit={(e) => void handleUpdateProfile(e)} style={{ marginTop: '24px' }}>
            <div className="form-field">
              <label htmlFor="profile-name">Họ và tên</label>
              <input
                id="profile-name"
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={updatingProfile}
              />
            </div>
            {profileMsg && (
              <p className={profileMsg.type === 'success' ? 'form-success' : 'form-error'}>
                {profileMsg.text}
              </p>
            )}
            <button className="button button-primary" type="submit" disabled={updatingProfile}>
              {updatingProfile ? 'Đang lưu…' : 'Lưu họ tên mới'}
            </button>
          </form>

          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--line)' }}>
            <Link to="/orders" className="inline-link">
              <span>Xem lịch sử đơn hàng của bạn →</span>
            </Link>
          </div>
        </section>

        <section className="profile-card">
          <h2>Bảo mật & Mật khẩu</h2>
          <p className="muted small">Thay đổi mật khẩu định kỳ để bảo vệ tài khoản của bạn.</p>

          <form onSubmit={(e) => void handleChangePassword(e)}>
            <div className="form-field">
              <label htmlFor="old-pass">Mật khẩu hiện tại</label>
              <input
                id="old-pass"
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={changingPass}
              />
            </div>
            <div className="form-field">
              <label htmlFor="new-pass">Mật khẩu mới</label>
              <input
                id="new-pass"
                type="password"
                required
                minLength={8}
                maxLength={72}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changingPass}
              />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-new-pass">Xác nhận mật khẩu mới</label>
              <input
                id="confirm-new-pass"
                type="password"
                required
                minLength={8}
                maxLength={72}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changingPass}
              />
            </div>
            {passMsg && (
              <p className={passMsg.type === 'success' ? 'form-success' : 'form-error'}>
                {passMsg.text}
              </p>
            )}
            <button className="button button-primary" type="submit" disabled={changingPass}>
              {changingPass ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
