import { test, expect } from '@playwright/test';

test.describe('Brand Identity (B0) & Responsive Layout', () => {
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
      await page.waitForLoadState('domcontentloaded');

      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing).toBe(false);
    });
  }

  test('Mobile navigation drawer opens and closes properly with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const menuToggle = page.locator('button[aria-label="Mở danh mục điều hướng"]');
    if (await menuToggle.isVisible()) {
      await menuToggle.click();
      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      // Press Escape to dismiss
      await page.keyboard.press('Escape');
      await expect(drawer).not.toBeVisible();
    }
  });
});
