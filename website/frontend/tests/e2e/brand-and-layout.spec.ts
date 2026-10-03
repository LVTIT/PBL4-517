import { test, expect } from '@playwright/test';
import { DEMO_CATALOG } from '../../../backend/src/data/catalog';

test.describe('Brand Identity (B0) & Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({
      json: { data: { user: null } },
    }));
    await page.route('**/api/products', (route) => route.fulfill({
      json: { data: DEMO_CATALOG.map(product => ({ ...product, stock: product.defaultStock })) },
    }));
  });
  test('Home page displays KEVILO brand identity and correct metadata', async ({ page }) => {
    await page.goto('/');

    // Title & Meta tags
    await expect(page).toHaveTitle(/KEVILO/);
    const metaDesc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(metaDesc).toContain('KEVILO');

    // Header & Logo
    const logoLink = page.locator('a[aria-label="KEVILO, trang chủ"]');
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toContainText('KEVILO');

    // Hero Tagline
    const heading = page.locator('.hero-heading');
    await expect(heading).toContainText('Nâng chuẩn góc làm việc.');

    // Footer Disclaimer
    const footer = page.locator('.site-footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('KEVILO');
    await expect(footer).toContainText('website demo thuộc đề tài PBL4-517');

    // Verify absence of outdated legacy brand strings in main content
    const pageBody = await page.locator('body').innerText();
    expect(pageBody).not.toContain('517 Store');
    expect(pageBody).not.toContain('517 PRODUCT');
    expect(pageBody).not.toContain('517 ESSENTIAL');
  });

  const breakpoints = [
    { name: 'Mobile 320px', width: 320, height: 600 },
    { name: 'Mobile 390px', width: 390, height: 844 },
    { name: 'Tablet 768px', width: 768, height: 1024 },
    { name: 'Laptop 1024px', width: 1024, height: 768 },
    { name: 'Desktop 1440px', width: 1440, height: 900 },
  ];

  for (const bp of breakpoints) {
    test(`No horizontal overflow at ${bp.name} (${bp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/');
      // Measure the populated page after auth controls and webfonts have loaded.
      await expect(page.locator('.header-account-actions')).toBeAttached();
      await expect(page.locator('.product-card')).toHaveCount(4);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('.brand-link')).toBeVisible();

      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing).toBe(false);
    });
  }

  test('Mobile navigation drawer traps focus and closes properly with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const menuToggle = page.getByRole('button', { name: 'Mở menu điều hướng', exact: true });
    await expect(menuToggle).toBeVisible();
    await menuToggle.click();
    const drawer = page.locator('.mobile-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Đăng ký tài khoản', exact: true })).toBeVisible();

    // Verify first element is focused inside drawer
    await page.waitForTimeout(100);
    const isFocusInsideDrawer = await page.evaluate(() => {
      const drawerEl = document.querySelector('.mobile-drawer');
      return drawerEl ? drawerEl.contains(document.activeElement) : false;
    });
    expect(isFocusInsideDrawer).toBe(true);

    // Press Escape to dismiss and verify focus restored to menuToggle
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    await expect(menuToggle).toBeFocused();
  });

  test('Product catalog displays in 2 columns on mobile viewports (320px & 390px)', async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 750 });
      await page.goto('/products');
      await expect(page.locator('.product-card')).toHaveCount(DEMO_CATALOG.length);

      const columnsCount = await page.evaluate(() => {
        const grid = document.querySelector('.product-grid');
        if (!grid) return 0;
        const style = window.getComputedStyle(grid);
        return style.gridTemplateColumns.split(' ').length;
      });
      expect(columnsCount).toBe(2);

      // Verify no horizontal page overflow at this mobile width
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing).toBe(false);
    }
  });

  test('Cart page has no horizontal overflow on mobile viewports (320px & 390px)', async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 750 });
      await page.goto('/products');

      // Add item to cart
      const addBtn = page.locator('.product-card').first().locator('.product-card-cta');
      await addBtn.click();
      await page.waitForTimeout(200);

      // Go to cart
      await page.goto('/cart');
      await expect(page.locator('.cart-item-row')).toBeVisible();

      // Check overflow
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing).toBe(false);
    }
  });
});
