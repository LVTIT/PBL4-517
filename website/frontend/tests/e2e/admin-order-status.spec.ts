import { test, expect } from '@playwright/test';
import type { OrderStatus } from '../../src/types/api';

const statuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const orders = statuses.map(status => ({
  id: `order-${status}`, status, totalPrice: '1000.00', shippingAddress: 'Synthetic admin fixture',
  createdAt: '2026-11-03T00:00:00Z', items: [],
}));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { data: { user: {
    id: 'admin-fixture', name: 'Admin fixture', email: 'admin-fixture@example.com', role: 'ADMIN',
  } } } }));
  await page.route('**/api/auth/csrf', route => route.fulfill({ json: { data: { csrfToken: 'a'.repeat(64) } } }));
  await page.route('**/api/products', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/admin/orders', route => route.fulfill({ json: { data: orders } }));
  await page.goto('/admin');
  await page.getByRole('tab', { name: /Đơn đặt hàng/ }).click();
});

test('admin options match the workflow and terminal orders cannot change', async ({ page }) => {
  const allowed = [['CONFIRMED', 'CANCELLED'], ['SHIPPED', 'CANCELLED'], ['DELIVERED'], [], []];
  for (const [index, status] of statuses.entries()) {
    const select = page.getByRole('combobox', { name: `Thay đổi trạng thái cho đơn order-${status}` });
    const choices = select.locator('option:not([disabled])');
    await expect(choices).toHaveCount(allowed[index].length);
    for (const [choice, value] of allowed[index].entries()) {
      await expect(choices.nth(choice)).toHaveAttribute('value', value);
    }
    await expect(select).toHaveValue(status);
    if (allowed[index].length === 0) await expect(select).toBeDisabled();
    else await expect(select).toBeEnabled();
  }
});

test('admin sees a server conflict and retains the current status', async ({ page }) => {
  await page.route('**/api/admin/orders/order-PENDING/status', route => route.fulfill({
    status: 409, json: { error: { code: 'INVALID_STATUS_TRANSITION', message: 'Trạng thái đơn hàng vừa thay đổi. Vui lòng tải lại và thử lại.' } },
  }));
  const select = page.getByRole('combobox', { name: 'Thay đổi trạng thái cho đơn order-PENDING' });
  await select.selectOption('CANCELLED');
  await expect(page.getByRole('status').filter({ hasText: 'Trạng thái đơn hàng vừa thay đổi' })).toBeVisible();
  await expect(select).toHaveValue('PENDING');
  await expect(select).toBeEnabled();
});
