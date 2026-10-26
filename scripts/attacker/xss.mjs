// Real-browser probe of an already persisted harmless fixture; never deletes it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
const require = createRequire(new URL('../../website/frontend/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const { values } = parseArgs({ options: { url: { type: 'string' }, fixture: { type: 'string' }, expect: { type: 'string' }, revision: { type: 'string' } } });
let browser;
const report = { scenario: 'xss', target: values.url, expected: values.expect, at: new Date().toISOString() };
try {
  assert.ok(['vulnerable', 'secure'].includes(values.expect));
  const url = new URL(values.url);
  assert.ok(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)));
  assert.ok(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash);
  const fixture = JSON.parse(readFileSync(values.fixture, 'utf8'));
  report.run = fixture.run;
  browser = await chromium.launch();
  const page = await browser.newPage();
  const versionResponse = await page.request.get(url.origin + '/api/version');
  assert.equal(versionResponse.status(), 200);
  const version = (await versionResponse.json()).data;
  report.revision = version.revision;
  if (values.revision) { assert.equal(version.revision, values.revision); assert.equal(version.dirty, false); }
  const productResponse = await page.request.get(url.origin + '/api/products/' + fixture.productId);
  assert.equal(productResponse.status(), 200);
  const product = (await productResponse.json()).data;
  assert.ok(product.reviews.some(review => review.id === fixture.reviewId && review.comment === fixture.xssPayload));
  const response = await page.goto(url.origin + '/products/' + fixture.productId);
  assert.equal(response.status(), 200);
  const review = page.locator('.review-comment').filter({ hasText: fixture.xssPayload });
  let result;
  if (product.labUnsafeReviewHtml === true) {
    await page.waitForFunction(() => window.__pbl517_xss_probe === 1, undefined, { timeout: 10000 });
    result = 'EXPLOIT_CONFIRMED';
  } else {
    await review.waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await review.locator('img').count(), 0);
    assert.equal(await page.evaluate(() => window.__pbl517_xss_probe), undefined);
    result = 'DEFENSE_VERIFIED';
  }
  report.result = result;
  report.passed = result === (values.expect === 'secure' ? 'DEFENSE_VERIFIED' : 'EXPLOIT_CONFIRMED');
  process.exitCode = report.passed ? 0 : 1;
} catch {
  Object.assign(report, { result: 'INCONCLUSIVE', passed: false, detail: 'Check TLS, revision, stored fixture, browser/API availability and rendering.' });
  process.exitCode = 2;
} finally { if (browser) await browser.close(); }
console.log(JSON.stringify(report));
