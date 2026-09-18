import { useEffect, useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { BoxIcon } from '../components/Icon';
import { get, messageFrom } from '../services/api';
import type { Product } from '../types/api';

type ProductState =
  | { status: 'loading' }
  | { status: 'success'; products: Product[] }
  | { status: 'error'; message: string };

const CATEGORIES = ['Tất cả', 'Bàn phím', 'Chuột', 'Âm thanh', 'Phụ kiện', 'Đèn bàn'];

export function ProductsPage() {
  const [state, setState] = useState<ProductState>({ status: 'loading' });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (selectedCategory && selectedCategory !== 'Tất cả') params.set('category', selectedCategory);

    const queryString = params.toString() ? `?${params.toString()}` : '';

    get<Product[]>(`/products${queryString}`, controller.signal)
      .then((products) => setState({ status: 'success', products }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: messageFrom(error) });
      });

    return () => controller.abort();
  }, [search, selectedCategory, attempt]);

  return (
    <div className="container page-content">
      <header className="page-heading">
        <p className="eyebrow">BỘ SƯU TẬP 517</p>
        <h1>Nhỏ gọn. Hữu ích. Mỗi ngày.</h1>
        <p>Khám phá phụ kiện tinh tế dành cho góc làm việc của bạn.</p>
      </header>

      {/* Filter and Search Bar */}
      <div className="catalog-toolbar">
        <div className="category-tags" role="tablist">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="search-box">
          <input
            type="search"
            placeholder="Tìm kiếm sản phẩm…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Tìm kiếm sản phẩm"
          />
          {search && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setSearch('')}
              aria-label="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="collection-bar">
        <span>{selectedCategory !== 'Tất cả' ? selectedCategory : 'Tất cả sản phẩm'}</span>
        <span className="muted small">
          {state.status === 'success' ? `${state.products.length} sản phẩm` : 'Đang lọc…'}
        </span>
      </div>

      {state.status === 'loading' && (
        <div className="state-panel" role="status">
          <span className="spinner" />
          <p>Đang tải sản phẩm…</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="state-panel" role="alert">
          <h2>Chưa thể tải sản phẩm</h2>
          <p>{state.message}</p>
          <button className="button button-primary" onClick={() => setAttempt((value) => value + 1)}>
            Thử lại
          </button>
        </div>
      )}

      {state.status === 'success' && (
        state.products.length === 0 ? (
          <div className="state-panel" role="status">
            <BoxIcon />
            <h2>Không tìm thấy sản phẩm phù hợp</h2>
            <p>Hãy thử tìm kiếm với từ khóa khác hoặc chọn danh mục khác nhé.</p>
            {(search || selectedCategory !== 'Tất cả') && (
              <button
                className="button button-primary"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('Tất cả');
                }}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="product-grid">
            {state.products.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
