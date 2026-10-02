import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WCAG 2.2 AA Accessibility Audits', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({
      json: { data: { user: null } },
    }));
  });
  test('Home page passes automated axe accessibility scan', async ({ page }) => {
    // Mock products for deterministic testing
    await page.route('**/api/products', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'test-1',
              name: 'Bàn phím cơ Mini 68',
              description: 'Bàn phím cơ không dây layout 68 phím.',
              price: '1450000.00',
              stock: 15,
              category: 'Bàn phím',
              imageKey: 'mini-68-keyboard',
              averageRating: 4.8,
              reviewCount: 12,
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Catalog page passes automated accessibility scan', async ({ page }) => {
    await page.route('**/api/products*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'test-1',
              name: 'Bàn phím cơ Mini 68',
              description: 'Bàn phím cơ không dây layout 68 phím.',
              price: '1450000.00',
              stock: 15,
              category: 'Bàn phím',
              imageKey: 'mini-68-keyboard',
              averageRating: null,
              reviewCount: 0,
            },
          ],
        }),
      });
    });

    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
