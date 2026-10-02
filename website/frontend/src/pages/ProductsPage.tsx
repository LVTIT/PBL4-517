import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { ProductCard } from '../components/ProductCard';
import { LiveToast, type ToastMessage } from '../components/LiveToast';
import { SearchIcon, CloseIcon, RefreshIcon } from '../components/Icon';
import { get, messageFrom } from '../services/api';
import type { Product } from '../types/api';
import { getPageTitle } from '../config/brand';

type ProductState =
  | { status: 'loading' }
  | { status: 'success'; products: Product[] }
  | { status: 'error'; message: string };

const CATEGORIES = ['Tất cả', 'Bàn phím', 'Chuột', 'Âm thanh', 'Phụ kiện', 'Đèn bàn'];

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL query params as single source of truth
  const urlCategory = searchParams.get('category') || 'Tất cả';
  const urlSearch = searchParams.get('search') || '';
  const urlSort = searchParams.get('sort') || 'default';

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [state, setState] = useState<ProductState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const debounceTimerRef = useRef<number | null>(null);

  // Set document title
  useEffect(() => {
    document.title = getPageTitle('Phụ kiện cho góc làm việc');
  }, []);

  // Sync searchInput when URL search changes externally (e.g. Back/Forward)
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  // Debounced search input handler (300ms)
  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (val.trim()) {
            next.set('search', val.trim());
          } else {
            next.delete('search');
          }
          return next;
        },
        { replace: true }
      );
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('search');
        return next;
      },
      { replace: true }
    );
  };

  const handleCategorySelect = (cat: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (cat !== 'Tất cả') {
          next.set('category', cat);
        } else {
          next.delete('category');
        }
        return next;
      },
      { replace: true }
    );
  };

  const handleSortChange = (sortVal: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (sortVal !== 'default') {
          next.set('sort', sortVal);
        } else {
          next.delete('sort');
        }
        return next;
      },
      { replace: true }
    );
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  // Fetch products with abort controller
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    const params = new URLSearchParams();
    if (urlSearch.trim()) params.set('search', urlSearch.trim());
    if (urlCategory && urlCategory !== 'Tất cả') params.set('category', urlCategory);

    const queryString = params.toString() ? `?${params.toString()}` : '';

    get<Product[]>(`/products${queryString}`, controller.signal)
      .then((products) => {
        setState({ status: 'success', products });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', message: messageFrom(error) });
        }
      });

    return () => controller.abort();
  }, [urlSearch, urlCategory, attempt]);

  // Apply sorting client-side
  const sortedProducts = useMemo(() => {
    if (state.status !== 'success') return [];
    const list = [...state.products];
    if (urlSort === 'price-asc') {
      list.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (urlSort === 'price-desc') {
      list.sort((a, b) => Number(b.price) - Number(a.price));
    }
    return list;
  }, [state, urlSort]);

  function handleProductAdded(productName: string) {
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: `Đã thêm "${productName}" vào giỏ hàng.`,
      actionText: 'Xem giỏ hàng',
      actionHref: '/cart',
    });
  }

  return (
    <div className="container page-content">
      <header className="section-header" style={{ marginBottom: '32px' }}>
        <p className="section-eyebrow">KEVILO CATALOG</p>
        <h1 className="section-title" style={{ fontSize: '2rem' }}>
          Phụ kiện cho góc làm việc
        </h1>
        <p style={{ color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>
          Tuyển chọn phụ kiện tối giản, chất liệu cao cấp và kết nối thông minh.
        </p>
      </header>

      {/* Toolbar: Category pills, Search, Sort */}
      <div className="catalog-toolbar">
        <div className="search-field-wrapper">
          <span className="search-icon-left" aria-hidden="true">
            <SearchIcon size={18} />
          </span>
          <input
            type="search"
            className="search-field-input"
            placeholder="Tìm kiếm theo tên hoặc mô tả…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Tìm kiếm sản phẩm"
          />
          {searchInput && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClearSearch}
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>

        <div className="toolbar-controls">
          <label htmlFor="sort-select" className="small muted" style={{ display: 'none' }}>
            Sắp xếp
          </label>
          <select
            id="sort-select"
            className="sort-select"
            value={urlSort}
            onChange={(e) => handleSortChange(e.target.value)}
            aria-label="Sắp xếp danh sách sản phẩm"
          >
            <option value="default">Sắp xếp: Mặc định</option>
            <option value="price-asc">Giá: Thấp đến cao</option>
            <option value="price-desc">Giá: Cao đến thấp</option>
          </select>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div
        className="filter-tabs"
        role="tablist"
        aria-label="Lọc theo danh mục"
        style={{ marginBottom: '24px' }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={urlCategory === cat}
            className={`filter-tab ${urlCategory === cat ? 'active' : ''}`}
            onClick={() => handleCategorySelect(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results Count Summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
          {urlCategory !== 'Tất cả' ? urlCategory : 'Tất cả sản phẩm'}
        </span>
        <span className="small muted">
          {state.status === 'success' ? `${sortedProducts.length} sản phẩm` : 'Đang tải…'}
        </span>
      </div>

      {/* Loading State */}
      {state.status === 'loading' && (
        <div className="state-panel" role="status">
          <span className="spinner" />
          <p>Đang tìm kiếm sản phẩm phù hợp…</p>
        </div>
      )}

      {/* Error State with Retry */}
      {state.status === 'error' && (
        <div className="state-panel" role="alert">
          <h2>Chưa thể kết nối danh mục</h2>
          <p>{state.message}</p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setAttempt((a) => a + 1)}
          >
            <RefreshIcon size={16} />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Success State */}
      {state.status === 'success' && (
        sortedProducts.length === 0 ? (
          <div className="state-panel" role="status">
            <h2>Không tìm thấy sản phẩm phù hợp</h2>
            <p>Hãy thử tìm với từ khóa khác hoặc chọn danh mục khác nhé.</p>
            {(urlSearch || urlCategory !== 'Tất cả') && (
              <button
                type="button"
                className="button button-primary"
                onClick={handleResetFilters}
                style={{ marginTop: '12px' }}
              >
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="product-grid" aria-label="Danh sách sản phẩm">
            {sortedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddedToCart={handleProductAdded}
              />
            ))}
          </div>
        )
      )}

      {/* Toast Notification */}
      <LiveToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
