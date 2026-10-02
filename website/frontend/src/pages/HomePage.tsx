import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowIcon, CategoryIcon } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';
import { LiveToast, type ToastMessage } from '../components/LiveToast';
import { get } from '../services/api';
import type { Product } from '../types/api';
import {
  BRAND_DEFAULT_TITLE,
  BRAND_HERO_CTA,
  BRAND_SUBTITLE,
  BRAND_TAGLINE,
} from '../config/brand';

const CATEGORIES = [
  { name: 'Bàn phím', slug: 'Bàn phím' },
  { name: 'Chuột', slug: 'Chuột' },
  { name: 'Âm thanh', slug: 'Âm thanh' },
  { name: 'Phụ kiện', slug: 'Phụ kiện' },
  { name: 'Đèn bàn', slug: 'Đèn bàn' },
];

export function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    document.title = BRAND_DEFAULT_TITLE;
    const controller = new AbortController();

    get<Product[]>('/products', controller.signal)
      .then((products) => {
        // Take up to 4 in-stock products for stable featured display
        const inStock = products.filter((p) => p.stock > 0).slice(0, 4);
        setFeaturedProducts(inStock.length > 0 ? inStock : products.slice(0, 4));
      })
      .catch(() => {
        // Non-blocking for homepage
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

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
    <div className="container">
      {/* 1. HERO SECTION */}
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-grid">
          <div className="hero-text">
            <span className="hero-eyebrow">KEVILO WORKSPACE</span>
            <h1 id="hero-title" className="hero-heading">
              {BRAND_TAGLINE}
            </h1>
            <p className="hero-description">
              {BRAND_SUBTITLE}
            </p>
            <div className="hero-actions">
              <Link to="/products" className="button button-primary button-large">
                <span>{BRAND_HERO_CTA}</span>
                <ArrowIcon size={18} />
              </Link>
            </div>
          </div>

          <div className="hero-image-card">
            <img
              src="/images/hero/hero-workspace.webp"
              alt="Góc làm việc hiện đại cùng các phụ kiện công nghệ KEVILO"
              className="hero-img"
              width="1376"
              height="768"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* 2. CATEGORIES SECTION */}
      <section className="section-header" aria-labelledby="categories-title" style={{ marginTop: '32px' }}>
        <p className="section-eyebrow">DANH MỤC</p>
        <h2 id="categories-title" className="section-title">
          Khám phá theo danh mục
        </h2>
      </section>

      <section className="category-grid" aria-label="Danh sách danh mục sản phẩm">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            to={`/products?category=${encodeURIComponent(cat.slug)}`}
            className="category-card"
          >
            <div className="category-icon-box" aria-hidden="true">
              <CategoryIcon category={cat.slug} size={28} />
            </div>
            <span className="category-name">{cat.name}</span>
          </Link>
        ))}
      </section>

      {/* 3. FEATURED PRODUCTS SECTION */}
      <section className="section-header" aria-labelledby="featured-title">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p className="section-eyebrow">BỘ SƯU TẬP</p>
            <h2 id="featured-title" className="section-title">
              Gợi ý cho góc làm việc
            </h2>
          </div>
          <Link to="/products" className="inline-link" style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
            <span>Xem tất cả</span>
            <ArrowIcon size={16} />
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="state-panel" role="status">
          <span className="spinner" />
          <p>Đang tải gợi ý sản phẩm…</p>
        </div>
      ) : featuredProducts.length > 0 ? (
        <div className="product-grid" aria-label="Sản phẩm gợi ý">
          {featuredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddedToCart={handleProductAdded}
            />
          ))}
        </div>
      ) : (
        <div className="state-panel">
          <p>Đang cập nhật các sản phẩm gợi ý.</p>
          <Link to="/products" className="button button-primary">
            Khám phá danh mục sản phẩm
          </Link>
        </div>
      )}

      {/* 4. INTRO / PHILOSOPHY SECTION */}
      <section
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          padding: '40px',
          marginBlock: '32px 64px',
          boxShadow: 'var(--shadow-sm)',
        }}
        aria-labelledby="about-title"
      >
        <div style={{ maxWidth: '640px' }}>
          <p className="section-eyebrow">TRIẾT LÝ THIẾT KẾ</p>
          <h2 id="about-title" style={{ fontSize: '1.5rem', fontWeight: 700, margin: '8px 0 16px 0' }}>
            Không gian tinh giản, tối đa hiệu suất
          </h2>
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
            KEVILO chú trọng từng chi tiết: từ vật liệu nhôm anode cao cấp, switch bàn phím êm ái đến ánh sáng đèn bàn dịu mắt. Từng phụ kiện được tạo ra để cùng bạn tạo nên một bàn làm việc chỉn chu, ngăn nắp và tràn đầy năng lượng sáng tạo.
          </p>
        </div>
      </section>

      {/* Live Toast Feedback */}
      <LiveToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
