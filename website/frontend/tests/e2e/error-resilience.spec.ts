import { test, expect } from '@playwright/test';

test.describe('Error Resilience & Boundary Handling', () => {
  test('Catalog gracefully displays error message and retry button when API fails', async ({ page }) => {
    // Force 500 error on products API
    await page.route('**/api/products*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Database connection timeout.' } }),
      });
    });

    await page.goto('/products');

    const errorPanel = page.locator('.state-panel');
    await expect(errorPanel).toBeVisible();
    await expect(errorPanel).toContainText('Chưa thể kết nối danh mục');
    await expect(errorPanel).toContainText('Database connection timeout.');

    const retryBtn = errorPanel.locator('button:has-text("Thử lại")');
    await expect(retryBtn).toBeVisible();
  });

  test('404 Not Found page displays KEVILO title and return link', async ({ page }) => {
    await page.goto('/non-existent-route-517');

    await expect(page).toHaveTitle(/Không tìm thấy trang/);
    const heading = page.locator('h1');
    await expect(heading).toContainText('Trang bạn tìm kiếm không tồn tại');

    const homeLink = page.locator('a:has-text("Về trang chủ")');
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute('href', '/');
  });
});
