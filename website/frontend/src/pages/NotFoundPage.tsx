import { useEffect } from 'react';
import { Link } from 'react-router';
import { getPageTitle } from '../config/brand';
import { ArrowLeftIcon } from '../components/Icon';

export function NotFoundPage() {
  useEffect(() => {
    document.title = getPageTitle('Không tìm thấy trang');
  }, []);

  return (
    <div className="container page-content" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="state-panel" style={{ maxWidth: '520px', padding: 'var(--space-12) var(--space-8)' }}>
        <p className="eyebrow" style={{ color: 'var(--color-primary)', fontWeight: 700, letterSpacing: '0.1em' }}>
          404 · KHÔNG TÌM THẤY TRANG
        </p>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 'var(--space-2) 0 var(--space-3) 0', color: 'var(--color-text)' }}>
          Trang bạn tìm kiếm không tồn tại
        </h1>
        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
          Đường dẫn có thể đã thay đổi, bị xóa hoặc nhập chưa chính xác. Hãy quay về danh mục phụ kiện KEVILO để tiếp tục khám phá.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link className="button button-primary" to="/products">
            Khám phá sản phẩm
          </Link>
          <Link className="button button-secondary" to="/">
            <ArrowLeftIcon size={16} /> Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
