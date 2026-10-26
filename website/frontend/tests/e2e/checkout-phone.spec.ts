import { test, expect } from '@playwright/test';

const product = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Chuột thử nghiệm', description: 'Sản phẩm kiểm thử checkout',
  price: '290000.00', stock: 10, category: 'Chuột',
};
const customer = { id: 'customer-phone-test', name: 'Khách thử nghiệm', email: 'phone@example.com', role: 'CUSTOMER' };

for (const loggedIn of [true, false]) {
  for (const phone of ['0912345678', '']) {
    test(`${loggedIn ? 'Customer' : 'Guest'} checkout ${phone ? 'saves recipient phone' : 'allows omitted phone'}`, async ({ page }) => {
      const user = loggedIn ? customer : null;
      await page.route('**/api/auth/me', (route) => route.fulfill({ json: { data: { user } } }));
      await page.route('**/api/auth/csrf', (route) => route.fulfill({
        json: { data: { csrfToken: 'a'.repeat(64) } },
      }));
      await page.addInitScript(({ product, user }) => {
        const key = user ? `pbl517_cart_user_${user.id}` : 'pbl517_cart_guest';
        localStorage.setItem(key, JSON.stringify([{ productId: product.id, product, quantity: 1 }]));
      }, { product, user });
      await page.route('**/api/orders', async (route) => {
        const body = route.request().postDataJSON();
        await route.fulfill({ status: 201, json: { data: {
          id: '22222222-2222-4222-8222-222222222222',
          userId: user?.id ?? null, totalPrice: product.price, status: 'PENDING',
          shippingAddress: body.shippingAddress,
          customerPhone: body.customerPhone ?? body.guestInfo?.phone ?? null,
          items: [], createdAt: new Date().toISOString(),
        } } });
      });

      await page.goto('/cart');
      const phoneInput = page.getByLabel('Số điện thoại người nhận (tùy chọn)');
      await expect(phoneInput).toBeVisible();
      await expect(phoneInput).toHaveAttribute('type', 'tel');
      await expect(phoneInput).toHaveValue('');
      if (!loggedIn) {
        await page.getByLabel('Họ và tên người nhận').fill('Khách thử nghiệm');
        await page.getByLabel('Email liên hệ').fill('guest-phone@example.com');
      }
      await phoneInput.fill(phone ? ` ${phone} ` : '');
      await page.getByLabel('Địa chỉ giao hàng').fill('123 Đường Kiểm Thử, Đà Nẵng');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const requestPromise = page.waitForRequest((request) => request.url().endsWith('/api/orders') && request.method() === 'POST');
      await page.getByRole('button', { name: 'Xác nhận đặt hàng' }).click();
      const payload = (await requestPromise).postDataJSON();
      expect(payload.shippingAddress).toBe('123 Đường Kiểm Thử, Đà Nẵng');
      expect(loggedIn ? payload.customerPhone : payload.guestInfo.phone).toBe(phone || undefined);
      if (loggedIn) expect(payload).not.toHaveProperty('guestInfo');
      await expect(page.getByRole('heading', { name: 'Đặt hàng thành công!' })).toBeVisible();
      if (phone) await expect(page.getByText(`Số điện thoại người nhận: ${phone}`, { exact: true })).toBeVisible();
    });
  }
}
