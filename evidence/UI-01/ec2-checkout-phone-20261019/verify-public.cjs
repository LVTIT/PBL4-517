const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('../../../website/frontend/node_modules/@playwright/test');
(async () => {
  const base = 'https://13.251.128.130';
  const healthResponse = await fetch(`${base}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).data.database, 'connected');
  const response = await fetch(`${base}/api/products`);
  assert.equal(response.status, 200);
  const { data: products } = await response.json();
  const product = products.find((p) => p.stock > 0);
  assert.ok(product);
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [1440, 390]) {
      for (const customerView of [false, true]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        // Read-only visual QA: no production account/order is created or submitted.
        await context.route('**/api/**', (route) => {
          if (!['GET', 'HEAD'].includes(route.request().method())) return route.abort();
          return route.continue();
        });
        const page = await context.newPage();
        const user = customerView ? { id: 'visual-qa-only', email: 'visual-qa@example.com', name: 'Kiểm tra giao diện', role: 'CUSTOMER' } : null;
        if (customerView) {
          await page.route('**/api/auth/me', (route) => route.fulfill({ json: { data: { user } } }));
        }
        await page.addInitScript(({ product, user }) => {
          const key = user ? `pbl517_cart_user_${user.id}` : 'pbl517_cart_guest';
          localStorage.setItem(key, JSON.stringify([{ productId: product.id, product, quantity: 1 }]));
        }, { product, user });
        const pageResponse = await page.goto(`${base}/cart`);
        assert.equal(pageResponse.status(), 200);
        const phone = page.getByLabel('Số điện thoại người nhận (tùy chọn)');
        await phone.waitFor({ state: 'visible' });
        assert.equal(await phone.getAttribute('type'), 'tel');
        assert.equal(await phone.count(), 1);
        await page.getByLabel('Địa chỉ giao hàng').waitFor({ state: 'visible' });
        await phone.fill('0912345678');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        const screenshot = path.join(__dirname, `public-${customerView ? 'customer-view' : 'guest'}-${width}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        results.push({ width, view: customerView ? 'customer UI with mocked auth only' : 'real unauthenticated guest', phoneVisible: true, phoneInputCount: 1, horizontalOverflow: false, screenshot: path.basename(screenshot) });
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  await fs.writeFile(path.join(__dirname, 'public-verification.json'), JSON.stringify({ target: base, health: 'database connected', productionMutations: 0, results }, null, 2));
  console.log('PASS: public HTTPS checkout phone field in guest/customer UI at 1440px and 390px; no production account/order mutations. Customer UI uses mocked auth only.');
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
