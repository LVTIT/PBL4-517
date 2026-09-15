import { useEffect, useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { BoxIcon } from '../components/Icon';
import { get, messageFrom } from '../services/api';
import type { Product } from '../types/api';

type ProductState =
  | { status: 'loading' }
  | { status: 'success'; products: Product[] }
  | { status: 'error'; message: string };

export function ProductsPage() {
  const [state, setState] = useState<ProductState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    get<Product[]>('/products', controller.signal)
      .then((products) => setState({ status: 'success', products }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: messageFrom(error) });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="container page-content">
      <header className="page-heading">
        <p className="eyebrow">BỘ SƯU TẬP 517</p>
        <h1>Nhỏ gọn. Hữu ích. Mỗi ngày.</h1>
        <p>Khám phá phụ kiện dành cho góc làm việc của bạn.</p>
      </header>
      <div className="collection-bar"><span>Tất cả sản phẩm</span><span className="muted small">{state.status === 'success' ? `${state.products.length} sản phẩm` : 'Bộ sưu tập phụ kiện'}</span></div>
      {state.status === 'loading' && <div className="state-panel" role="status"><span className="spinner" /><p>Đang tải sản phẩm…</p></div>}
      {state.status === 'error' && <div className="state-panel" role="alert"><h2>Chưa thể tải sản phẩm</h2><p>{state.message}</p><button className="button button-primary" onClick={() => setAttempt((value) => value + 1)}>Thử lại</button></div>}
      {state.status === 'success' && (state.products.length === 0 ? <div className="state-panel" role="status"><BoxIcon /><h2>Sản phẩm sẽ sớm có mặt</h2><p>Chúng tôi đang chuẩn bị bộ sưu tập. Bạn hãy quay lại sau nhé.</p></div> : <div className="product-grid">{state.products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div>)}
    </div>
  );
}
