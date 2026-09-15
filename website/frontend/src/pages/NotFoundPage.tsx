import { Link } from 'react-router';

export function NotFoundPage() {
  return <div className="container state-panel"><p className="eyebrow">404</p><h1>Trang này không tồn tại.</h1><p>Quay lại trang chủ để tiếp tục khám phá.</p><Link className="button button-primary" to="/">Về trang chủ</Link></div>;
}
