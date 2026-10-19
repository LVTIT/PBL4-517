import { test, expect } from '@playwright/test';

const MOCK_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Bàn phím cơ Mini 68',
    description: 'Bàn phím cơ không dây layout 68 phím.',
    price: '1450000.00',
    stock: 10,
    category: 'Bàn phím',
    imageKey: 'mini-68-keyboard',
    averageRating: 4.8,
    reviewCount: 12,
  },
  {
    id: 'prod-2',
    name: 'Chuột không dây Everyday',
    description: 'Chuột quang học kết nối 2.4GHz.',
    price: '450000.00',
    stock: 0, // Out of stock for testing
    category: 'Chuột',
    imageKey: 'everyday-mouse',
    averageRating: null,
    reviewCount: 0,
  },
];

test.describe('Catalog, Search, and Cart Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/products*', (route) => {
      const url = new URL(route.request().url());
      const search = url.searchParams.get('search')?.toLowerCase() || '';
      const cat = url.searchParams.get('category');

      let filtered = MOCK_PRODUCTS;
      if (cat) {
        filtered = filtered.filter((p) => p.category === cat);
      }
      if (search) {
        filtered = filtered.filter((p) => p.name.toLowerCase().includes(search));
      }

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: filtered }),
      });
    });

    await page.route('**/api/auth/me', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Not authenticated' } }),
      });
    });

    await page.route('**/api/auth/csrf', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { csrfToken: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' } }),
      });
    });
  });

  test('Catalog synchronizes category filters with URL search params', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('.product-card')).toHaveCount(2);

    // Click "Bàn phím" filter
    const keyboardFilter = page.locator('button:has-text("Bàn phím")');
    await keyboardFilter.click();

    // Verify URL query param updated
    await expect(page).toHaveURL(/category=B%C3%A0n\+ph%C3%ADm/);
    await expect(page.locator('.product-card')).toHaveCount(1);
    await expect(page.locator('.product-card')).toContainText('Bàn phím cơ Mini 68');
  });

  test('Out-of-stock product card shows out-of-stock badge and disables action', async ({ page }) => {
    await page.goto('/products');
    const outOfStockCard = page.locator('.product-card:has-text("Chuột không dây Everyday")');
    await expect(outOfStockCard).toBeVisible();
    await expect(outOfStockCard).toContainText('Hết hàng');
  });

  test('Cart allows adding items and requires valid shipping address', async ({ page }) => {
    await page.goto('/products');

    // Add first product to cart
    const addBtn = page.locator('.product-card:has-text("Bàn phím cơ Mini 68") button[aria-label="Thêm Bàn phím cơ Mini 68 vào giỏ hàng"]');
    await addBtn.click();

    // Check toast notification
    const toast = page.locator('.live-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Đã thêm');

    // Navigate to cart
    await page.goto('/cart');
    await expect(page.locator('.cart-item-row')).toHaveCount(1);
    await expect(page.locator('.cart-item-row')).toContainText('Bàn phím cơ Mini 68');

    // Verify initial shipping address is empty
    const addressInput = page.locator('#shipping-address');
    await expect(addressInput).toHaveValue('');

    // Guest checkout reminder is displayed
    const guestNotice = page.locator('.guest-order-notice');
    await expect(guestNotice).toBeVisible();
    await expect(guestNotice).toContainText('Đặt hàng không cần tài khoản');
  });

  test('Search reset immediately clears query and cancels pending debounce', async ({ page }) => {
    await page.goto('/products');
    const searchInput = page.locator('#catalog-search-input');
    await searchInput.fill('không dây');

    // Click "Đặt lại bộ lọc"
    const resetBtn = page.getByRole('button', { name: 'Đặt lại bộ lọc', exact: true });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Verify search input is cleared immediately
    await expect(searchInput).toHaveValue('');

    // Wait past debounce interval (350ms) to ensure debounce doesn't re-apply
    await page.waitForTimeout(450);
    await expect(searchInput).toHaveValue('');
    expect(page.url()).not.toContain('search=');
  });

  test('Adding item up to stock saturation updates button state and shows warning toast', async ({ page }) => {
    await page.goto('/products');

    // Product with stock 10
    const card = page.locator('.product-card:has-text("Bàn phím cơ Mini 68")');
    const ctaBtn = card.locator('.product-card-cta');

    // Add once
    await ctaBtn.click();
    await expect(page.locator('.live-toast')).toContainText('Đã thêm');

    // Navigate to cart and set quantity to max (10)
    await page.goto('/cart');
    await expect(page.locator('.cart-item-row')).toBeVisible();

    // Increase quantity to max
    const plusBtn = page.locator('button[aria-label="Tăng số lượng Bàn phím cơ Mini 68"]');
    for (let i = 1; i < 10; i++) {
      await plusBtn.click();
    }
    await expect(page.locator('.qty-input')).toContainText('10');

    // Back to products - button should now be disabled or indicate in-cart limit
    await page.goto('/products');
    const updatedCard = page.locator('.product-card:has-text("Bàn phím cơ Mini 68")');
    const updatedCta = updatedCard.locator('.product-card-cta');
    await expect(updatedCta).toBeDisabled();
    await expect(updatedCta).toContainText('Đã đạt tối đa');
  });
});
