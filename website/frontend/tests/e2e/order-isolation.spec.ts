import { test, expect } from '@playwright/test';

const user = { id: 'owner-a', name: 'Owner A', email: 'a@example.com', role: 'CUSTOMER' };
const order = { id: 'order-private-a', userId: user.id, totalPrice: '1000.00', status: 'PENDING', shippingAddress: 'PRIVATE ADDRESS A', items: [] };

test('confirmation waits for auth, survives owner refresh and is cleared on logout', async ({ page }) => {
  let releaseAuth!: () => void;
  const gate = new Promise<void>(resolve => { releaseAuth = resolve; });
  await page.route('**/api/auth/me', async route => {
    await gate;
    await route.fulfill({ json: { data: { user } } });
  });
  await page.route('**/api/auth/csrf', route => route.fulfill({ json: { data: { csrfToken: 'a'.repeat(64) } } }));
  await page.route('**/api/auth/logout', route => route.fulfill({ json: { data: { user: null } } }));
  await page.addInitScript(order => {
    if (!sessionStorage.getItem('test-initialized')) {
      sessionStorage.setItem('pbl517_last_order', JSON.stringify({ version: 1, ownerId: order.userId, order }));
      sessionStorage.setItem('test-initialized', 'yes');
    }
  }, order);
  await page.goto('/cart');
  await expect(page.getByText('PRIVATE ADDRESS A')).toHaveCount(0);
  releaseAuth();
  await expect(page.getByRole('heading', { name: 'Đặt hàng thành công!' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('PRIVATE ADDRESS A', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đặt hàng thành công!' })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('pbl517_last_order'))).toBeNull();
});

for (const legacy of [false, true]) {
  test(`rejects ${legacy ? 'legacy' : 'another owner'} confirmation`, async ({ page }) => {
    await page.route('**/api/auth/me', route => route.fulfill({ json: { data: { user: { ...user, id: 'owner-b' } } } }));
    await page.addInitScript(({ order, legacy }) => {
      sessionStorage.setItem('pbl517_last_order', JSON.stringify(legacy ? order : { version: 1, ownerId: order.userId, order }));
    }, { order, legacy });
    await page.goto('/cart');
    await expect(page.getByText('Giỏ hàng của bạn đang trống')).toBeVisible();
    await expect(page.getByText('PRIVATE ADDRESS A')).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('pbl517_last_order'))).toBeNull();
  });
}
