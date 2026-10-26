import { useState } from 'react';
import { CategoryIcon } from './Icon';

interface ProductMediaProps {
  imageKey?: string | null;
  name: string;
  category?: string;
  className?: string;
  aspectRatio?: '1/1' | '16/9' | '4/3';
  priority?: boolean;
}

export function ProductMedia({
  imageKey,
  name,
  category = 'Phụ kiện',
  className = '',
  aspectRatio = '1/1',
  priority = false,
}: ProductMediaProps) {
  const [imageError, setImageError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const imageSrc = imageKey ? `/images/products/${imageKey}.webp` : null;

  if (!imageSrc || imageError) {
    return (
      <div
        className={`product-media-fallback aspect-${aspectRatio.replace('/', '-')} ${className}`}
        aria-hidden="true"
      >
        <div className="fallback-pattern" />
        <div className="fallback-content">
          <div className="fallback-icon-ring">
            <CategoryIcon category={category} size={36} />
          </div>
          <span className="fallback-category">{category}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`product-media-container aspect-${aspectRatio.replace('/', '-')} ${className}`}>
      {!loaded && <div className="product-media-skeleton" aria-hidden="true" />}
      <img
        src={imageSrc}
        alt={name}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`product-media-img ${loaded ? 'is-loaded' : ''}`}
        onLoad={() => setLoaded(true)}
        onError={() => setImageError(true)}
      />
    </div>
  );
}
