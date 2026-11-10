// Real-browser probe of an already persisted harmless fixture; never deletes it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../website/frontend/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const { values } = parseArgs({ options: { url: { type: 'string' }, fixture: { type: 'string' }, expect: { type: 'string' }, revision: { type: 'string' }, observe: { type: 'boolean' }, trace: { type: 'boolean' }, 'show-evidence': { type: 'boolean' } } });
let browser;
const report = { scenario: 'xss', target: values.url, at: new Date().toISOString() };
if (values.expect) report.expected = values.expect;
const trace = (path, status) => {
  const entry = { actor: 'Chromium', method: 'GET', path, status };
  report.requests.push(entry);
  if (values.trace) console.error(`[${String(report.requests.length).padStart(2, '0')}] [Chromium] GET ${path} -> ${status}`);
};
try {
  assert.ok(values.observe ? !values.expect : ['vulnerable', 'secure'].includes(values.expect));
  const url = new URL(values.url || 'http://127.0.0.1:5173');
  report.target = url.origin;
  assert.ok(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)));
  assert.ok(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  assert.ok(local || (values.fixture && values.revision), 'Remote XSS requires explicit fixture and revision.');
  const fixture = JSON.parse(readFileSync(values.fixture || fileURLToPath(new URL('../../.local/private/lab-fixtures.json', import.meta.url)), 'utf8'));
  report.run = fixture.run;
  report.productId = fixture.productId;
  report.payload = fixture.xssPayload;
  report.requests = [];
  browser = await chromium.launch();
  const page = await browser.newPage();
  const versionResponse = await page.request.get(url.origin + '/api/version');
  trace('/api/version', versionResponse.status());
  assert.equal(versionResponse.status(), 200);
  const version = (await versionResponse.json()).data;
  report.revision = version.revision;
  report.dirty = version.dirty;
  if (values.revision) { assert.equal(version.revision, values.revision); assert.equal(version.dirty, false); }
  const productResponse = await page.request.get(url.origin + '/api/products/' + fixture.productId);
  trace('/api/products/' + fixture.productId, productResponse.status());
  assert.equal(productResponse.status(), 200);
  const product = (await productResponse.json()).data;
  assert.ok(product.reviews.some(review => review.id === fixture.reviewId && review.comment === fixture.xssPayload));
  const response = await page.goto(url.origin + '/products/' + fixture.productId);
  trace('/products/' + fixture.productId, response.status());
  assert.equal(response.status(), 200);
  const review = page.locator('.review-comment').filter({ hasText: fixture.xssPayload });
  const commentImages = page.locator('.review-comment img');
  let result;
  let imageCount;
  let marker;
  if (product.labUnsafeReviewHtml === true) {
    await page.waitForFunction(() => window.__pbl517_xss_probe === 1, undefined, { timeout: 10000 });
    result = 'EXPLOIT_CONFIRMED';
  } else {
    await review.waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await commentImages.count(), 0);
    assert.equal(await page.evaluate(() => window.__pbl517_xss_probe), undefined);
    result = 'DEFENSE_VERIFIED';
  }
  imageCount = await commentImages.count();
  marker = await page.evaluate(() => window.__pbl517_xss_probe);
  const evidence = {
    observedTitle: 'Dấu hiệu thực thi trong trình duyệt',
    observed: [
      { label: 'Payload', value: fixture.xssPayload },
      { label: 'Review ID', value: fixture.reviewId },
      { label: 'Sản phẩm', value: product.name || fixture.productId },
      { label: 'labUnsafeReviewHtml', value: String(product.labUnsafeReviewHtml === true) },
      { label: '<img> trong review', value: String(imageCount) },
      { label: 'window.__pbl517_xss_probe', value: String(marker) },
    ],
    controlsTitle: 'Đối chứng',
    controls: [
      { label: 'Review qua API', value: 'tồn tại, đúng payload' },
      { label: 'Trang sản phẩm', value: '200 OK' },
    ],
    limits: ['Chỉ chứng minh marker trên trang fixture; không lấy cookie, không gửi dữ liệu ra ngoài.'],
  };
  if (!local && !values['show-evidence']) {
    evidence.redacted = true;
    evidence.observed = evidence.observed.map(item => ({ label: item.label, value: '<redacted: non-loopback target>' }));
    evidence.limits.push('Chi tiết observed bị che vì target ngoài loopback; dùng --show-evidence nếu được phép.');
  }
  report.evidence = evidence;
  report.result = result;
  report.observation = result === 'EXPLOIT_CONFIRMED' ? 'Stored review executed window.__pbl517_xss_probe=1' : 'Same stored review is text; no img element and no marker';
  if (values.observe) {
    report.completed = true;
    process.exitCode = 0;
  } else {
    report.passed = result === (values.expect === 'secure' ? 'DEFENSE_VERIFIED' : 'EXPLOIT_CONFIRMED');
    process.exitCode = report.passed ? 0 : 1;
  }
} catch {
  Object.assign(report, { result: 'INCONCLUSIVE', detail: 'Check TLS, revision, stored fixture, browser/API availability and rendering.' });
  report[values.observe ? 'completed' : 'passed'] = false;
  process.exitCode = 2;
} finally { if (browser) await browser.close(); }
console.log(JSON.stringify(report));
