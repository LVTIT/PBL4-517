import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../../website/frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const origin = 'https://47.129.214.70';
const out = new URL('./', import.meta.url);
const report = { origin, sha: '524c878c00570df76a1765f0d774361f18de021f', checkedAt: new Date().toISOString(), grids: [], cart: [], accessibility: [], assets: [], errors: [] };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const health = await context.request.get(origin + '/api/health');
  assert.equal(health.status(), 200);
  report.health = (await health.json()).data;
  assert.equal(report.health.database, 'connected');
  const response = await context.request.get(origin + '/api/products');
  assert.equal(response.status(), 200);
  const products = (await response.json()).data;
  assert.ok(products.length >= 2);
  assert.ok(products.every(p => p.category !== 'Deployment verification' && !/NOT FOR SALE|DO NOT BUY/i.test(p.name)));
  report.publicProducts = products.length;
  for (const key of ['usb-c-hub', 'laptop-stand', 'leather-desk-mat']) {
    const path = '/images/products/' + key + '.webp';
    const asset = await context.request.get(origin + path);
    assert.equal(asset.status(), 200);
    const bytes = await asset.body();
    assert.equal(hash(bytes), hash(await fs.readFile(new URL('../../../website/frontend/public' + path, import.meta.url))));
    report.assets.push({ path, sha256: hash(bytes), bytes: bytes.length });
  }
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  for (const width of [320, 375, 390, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/products']) {
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('.product-card').first()).toBeVisible();
      const dims = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.product-card')];
        const grid = cards[0].parentElement;
        const first = cards[0].getBoundingClientRect();
        const second = cards[1].getBoundingClientRect();
        return { viewport: innerWidth, content: document.documentElement.scrollWidth, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, first: { x: first.x, y: first.y, width: first.width }, second: { x: second.x, y: second.y, width: second.width } };
      });
      assert.ok(dims.content <= width, `${path} overflow at ${width}`);
      if (width < 768) {
        assert.equal(dims.columns, 2, `${path} columns at ${width}`);
        assert.ok(Math.abs(dims.first.y - dims.second.y) < 1);
        assert.ok(dims.second.x > dims.first.x);
      }
      report.grids.push({ path, ...dims });
      if (width === 390 || width === 1440) {
        const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        report.accessibility.push({ path, width, violations: scan.violations.map(v => ({ id: v.id, impact: v.impact })), incomplete: scan.incomplete.map(v => v.id) });
        assert.equal(scan.violations.length, 0);
      }
      if (width === 390) {
        for (const img of await page.locator('.product-card img').all()) {
          await img.scrollIntoViewIfNeeded();
          await expect(img).toHaveJSProperty('complete', true);
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: fileURLToPath(new URL(path === '/' ? 'home-390.png' : 'catalog-390.png', out)), fullPage: true });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/products', { waitUntil: 'networkidle' });
  const keyboardCount = products.filter(p => p.category === 'Bàn phím').length;
  await page.getByRole('button', { name: 'Bàn phím', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(keyboardCount);
  await page.locator('#catalog-search-input').fill('bàn phím');
  await page.getByRole('button', { name: 'Đặt lại bộ lọc', exact: true }).click();
  await page.waitForTimeout(450);
  await expect(page.locator('#catalog-search-input')).toHaveValue('');
  await expect(page.locator('.product-card')).toHaveCount(products.length);
  const available = products.find(p => p.stock > 0);
  assert.ok(available);
  await page.getByRole('button', { name: `Thêm ${available.name} vào giỏ hàng`, exact: true }).click();
  await expect(page.locator('.live-toast')).toContainText('Đã thêm');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin + '/cart', { waitUntil: 'networkidle' });
    await expect(page.locator('.cart-item-row')).toHaveCount(1);
    await expect(page.locator('#shipping-address')).toHaveValue('');
    const content = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(content <= width);
    report.cart.push({ width, content, items: 1 });
  }
  await page.screenshot({ path: fileURLToPath(new URL('cart-390.png', out)), fullPage: true });
  const toggle = page.getByRole('button', { name: 'Mở menu điều hướng', exact: true });
  await toggle.click();
  await expect(page.locator('.mobile-drawer')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  for (const path of [`/products/${available.id}`, '/login', '/register']) {
    assert.equal((await page.goto(origin + path, { waitUntil: 'networkidle' })).status(), 200);
    assert.match(await page.title(), /KEVILO/);
  }
  assert.deepEqual(report.errors, []);
  report.result = 'PASS';
  report.scope = 'Real public API/catalog, client-only cart, mobile grid, filters, drawer, auth form rendering; no mocks, login, registration or order submission.';
} catch (error) {
  report.result = 'FAIL';
  report.failure = String(error);
  throw error;
} finally {
  await fs.writeFile(new URL('public-verification.json', out), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}
