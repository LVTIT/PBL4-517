// Explicitly opt in on a disposable loopback database. Never targets a deployed host.
import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';

const flags = ['VULN_IDOR_ENABLED', 'VULN_SQLI_ENABLED', 'VULN_XSS_ENABLED', 'VULN_AUTH_ENABLED'];
const backend = fileURLToPath(new URL('../', import.meta.url));
const frontend = fileURLToPath(new URL('../../frontend/', import.meta.url));
const frontendRequire = createRequire(new URL('../../frontend/package.json', import.meta.url));
const password = 'LocalLabOnly517!'; // Synthetic, disposable account password.

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function launch(script, args, cwd, env, healthPath) {
  const child = spawn(process.execPath, [script, ...args], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const url = `http://127.0.0.1:${env.PORT}`;
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), delay(5000, undefined, { ref: false })]);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await once(child, 'exit'); }
  };
  try {
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(`Local test process exited: ${output}`);
      try {
        const response = await fetch(url + healthPath);
        if (response.ok) return { url, stop };
      } catch { /* Poll startup. */ }
      await delay(100);
    }
    throw new Error('Local test process did not become healthy.');
  } catch (error) { await stop(); throw error; }
}

class Session {
  cookie = '';
  constructor(url) { this.url = url; }
  async request(path, method = 'GET', body) {
    let token;
    if (method !== 'GET') token = (await this.request('/auth/csrf')).body.data.csrfToken;
    const response = await fetch(this.url + '/api' + path, {
      method, headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(token ? { 'X-CSRF-Token': token } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    for (const cookie of response.headers.getSetCookie()) {
      if (cookie.startsWith('pbl517.sid=')) this.cookie = cookie.split(';')[0];
    }
    return { status: response.status, body: await response.json() };
  }
}

test('isolated local exploit -> defense lifecycle', { timeout: 120000 }, async suite => {
  assert.equal(process.env.LOCAL_SECURITY_LAB, '1', 'Set LOCAL_SECURITY_LAB=1 explicitly.');
  assert.notEqual(process.env.NODE_ENV, 'production');
  const connection = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname));
  assert.ok(/(?:test|security|lab)/i.test(connection.pathname) || process.env.CI === 'true', 'Use a dedicated test/security/lab database.');
  const database = new Pool({ connectionString: process.env.DATABASE_URL });
  const productId = randomUUID();
  const runId = randomUUID().slice(0, 8);
  const users = [];
  const processes = [];
  let browser;
  try {
    const baseEnv = { ...process.env, NODE_ENV: 'development', TRUST_PROXY: '0',
      ...Object.fromEntries(flags.map(flag => [flag, 'false'])) };
    const endpoints = {};
    for (const mode of ['secure', 'vulnerable']) {
      const env = { ...baseEnv, PORT: String(await freePort()),
        ...Object.fromEntries(flags.map(flag => [flag, String(mode === 'vulnerable')])) };
      endpoints[mode] = await launch('dist/server.js', [], backend, env, '/api/health');
      processes.push(endpoints[mode]);
    }
    await database.query('INSERT INTO "Product" (id,name,description,price,stock,category,"updatedAt") VALUES ($1,$2,$3,1000,50,$4,NOW())',
      [productId, `Local security fixture ${runId}`, 'Synthetic lab product', 'Phụ kiện']);
    const sessions = {};
    for (const mode of ['secure', 'vulnerable']) {
      sessions[mode] = {};
      for (const role of ['owner', 'attacker']) {
        const session = new Session(endpoints[mode].url);
        const email = `${role}-${mode}-${runId}@example.com`;
        const result = await session.request('/auth/register', 'POST', { name: `Lab ${role}`, email, password });
        assert.equal(result.status, 201);
        users.push(result.body.data.user.id);
        sessions[mode][role] = { session, user: result.body.data.user };
      }
    }

    await suite.test('production refuses each vulnerable flag before serving requests', async () => {
      for (const flag of flags) {
        const child = spawn(process.execPath, ['-e', "import('./dist/lib/config.js')"], {
          cwd: backend, windowsHide: true, env: { ...baseEnv, NODE_ENV: 'production', [flag]: 'true' }, stdio: 'ignore',
        });
        const [code] = await once(child, 'exit');
        assert.notEqual(code, 0, `${flag} must be rejected in production`);
      }
    });

    await suite.test('IDOR read/update/cancel: vulnerable succeeds; defense preserves order and stock', async () => {
      for (const mode of ['secure', 'vulnerable']) {
        const { owner, attacker } = sessions[mode];
        const created = await owner.session.request('/orders', 'POST', {
          items: [{ productId, quantity: 2 }], shippingAddress: 'Synthetic owner address', customerPhone: '0900000000',
        });
        assert.equal(created.status, 201);
        const id = created.body.data.id;
        const before = (await database.query('SELECT stock FROM "Product" WHERE id=$1', [productId])).rows[0].stock;
        const read = await attacker.session.request(`/orders/${id}`);
        const update = await attacker.session.request(`/orders/${id}`, 'PATCH', { shippingAddress: 'Synthetic attacker address' });
        const cancel = await attacker.session.request(`/orders/${id}/cancel`, 'POST');
        for (const response of [read, update, cancel]) assert.equal(response.status, mode === 'secure' ? 403 : 200);
        const row = (await database.query('SELECT status,"shippingAddress" FROM "Order" WHERE id=$1', [id])).rows[0];
        const after = (await database.query('SELECT stock FROM "Product" WHERE id=$1', [productId])).rows[0].stock;
        assert.equal(row.status, mode === 'secure' ? 'PENDING' : 'CANCELLED');
        assert.equal(row.shippingAddress, mode === 'secure' ? 'Synthetic owner address' : 'Synthetic attacker address');
        assert.equal(after, before + (mode === 'secure' ? 0 : 2));
        assert.equal((await owner.session.request(`/orders/${id}`)).status, 200);
        if (mode === 'secure') {
          assert.equal((await owner.session.request(`/orders/${id}`, 'PATCH', { shippingAddress: 'Updated owner address' })).status, 200);
          assert.equal((await owner.session.request(`/orders/${id}/cancel`, 'POST')).status, 200);
        }
      }
    });

    await suite.test('SQLi: identical tautology and UNION disclose fixture data only in vulnerable mode', async () => {
      const payloads = ["' OR '1'='1", `') UNION SELECT id, name, email, NULL::text, 0, 'CUSTOMER', "createdAt", "updatedAt" FROM "User" --`];
      for (const mode of ['secure', 'vulnerable']) {
        const session = sessions[mode].attacker.session;
        for (const payload of payloads) {
          const response = await session.request('/products?search=' + encodeURIComponent(payload));
          assert.equal(response.status, 200);
          if (mode === 'secure') assert.deepEqual(response.body.data, []);
          else assert.ok(response.body.data.length > 0);
          if (payload.includes('UNION') && mode === 'vulnerable') {
            assert.ok(response.body.data.some(row => row.description === sessions[mode].owner.user.email));
          }
        }
        const normal = await session.request('/products?search=' + encodeURIComponent(`Local security fixture ${runId}`));
        assert.ok(normal.body.data.some(row => row.id === productId));
      }
    });

    await suite.test('stored XSS: same persisted review executes in lab; React escapes it in secure mode', async () => {
      const payload = '<img src="/missing-pbl517-probe" onerror="window.__pbl517_xss_probe=1">';
      const posted = await sessions.secure.owner.session.request(`/products/${productId}/reviews`, 'POST', { rating: 5, comment: payload });
      assert.equal(posted.status, 201);
      const stored = await database.query('SELECT comment FROM "Review" WHERE id=$1', [posted.body.data.id]);
      assert.equal(stored.rows[0].comment, payload);
      const previews = {};
      for (const mode of ['secure', 'vulnerable']) {
        const port = String(await freePort());
        previews[mode] = await launch('node_modules/vite/bin/vite.js', ['preview', '--port', port], frontend,
          { ...process.env, PORT: port, API_PROXY_TARGET: endpoints[mode].url }, '/');
        processes.push(previews[mode]);
      }
      const { chromium, expect } = frontendRequire('@playwright/test');
      browser = await chromium.launch();
      for (const mode of ['vulnerable', 'secure']) {
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          await page.goto(previews[mode].url + '/products/' + productId);
          await expect(page.locator('.review-comment')).toHaveCount(1);
          if (mode === 'vulnerable') {
            await page.waitForFunction(() => window.__pbl517_xss_probe === 1);
            await expect(page.getByText(/LAB XSS:/)).toBeVisible();
          } else {
            await expect(page.locator('.review-comment')).toHaveText(payload);
            await expect(page.locator('.review-comment img')).toHaveCount(0);
            assert.equal(await page.evaluate(() => window.__pbl517_xss_probe), undefined);
          }
        } finally { await context.close(); }
      }
      // Real checkout through the browser and actual API, with no fabricated
      // auth/order responses. The same host cookie is valid across local ports.
      const context = await browser.newContext();
      try {
        const cookie = sessions.secure.owner.session.cookie;
        const separator = cookie.indexOf('=');
        await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), domain: '127.0.0.1', path: '/api' }]);
        const page = await context.newPage();
        await page.goto(previews.secure.url + '/products/' + productId);
        await page.getByRole('button', { name: /Thêm vào giỏ hàng/ }).click();
        await page.goto(previews.secure.url + '/cart');
        await page.getByLabel('Địa chỉ giao hàng').fill('Real local browser checkout');
        await page.getByLabel('Số điện thoại người nhận (tùy chọn)').fill('0900000001');
        await page.getByRole('button', { name: 'Xác nhận đặt hàng' }).click();
        await expect(page.getByRole('heading', { name: 'Đặt hàng thành công!' })).toBeVisible();
        const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pbl517_last_order')));
        const row = (await database.query('SELECT "customerPhone","shippingAddress" FROM "Order" WHERE id=$1', [saved.order.id])).rows[0];
        assert.equal(row.customerPhone, '0900000001');
        assert.equal(row.shippingAddress, 'Real local browser checkout');
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Đặt hàng thành công!' })).toBeVisible();
        assert.equal((await sessions.secure.owner.session.request(`/orders/${saved.order.id}/cancel`, 'POST')).status, 200);
      } finally { await context.close(); }
    });

    await suite.test('unavailable API remains an HTTP failure, including checkout', async () => {
      const port = String(await freePort());
      const offline = await launch('node_modules/vite/bin/vite.js', ['preview', '--port', port], frontend,
        { ...process.env, PORT: port, API_PROXY_TARGET: `http://127.0.0.1:${await freePort()}` }, '/');
      processes.push(offline);
      for (const [path, method] of [['/api/products', 'GET'], ['/api/auth/me', 'GET'], ['/api/orders', 'POST']]) {
        const response = await fetch(offline.url + path, { method });
        assert.equal(response.ok, false, `${method} ${path} must not be fabricated`);
      }
    });

    await suite.test('authentication: bounded guessing reaches 429 only with rate-limit defense', async () => {
      for (const mode of ['secure', 'vulnerable']) {
        const session = new Session(endpoints[mode].url);
        const email = sessions[mode].owner.user.email;
        const statuses = [];
        for (let i = 0; i < 12; i++) statuses.push((await session.request('/auth/login', 'POST', { email, password: 'SyntheticWrong517!' })).status);
        assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
        assert.deepEqual(statuses.slice(10), Array(2).fill(mode === 'secure' ? 429 : 401));
        const correct = await session.request('/auth/login', 'POST', { email, password });
        assert.equal(correct.status, mode === 'secure' ? 429 : 200);
      }
    });
  } finally {
    if (browser) await browser.close();
    for (const process of processes.reverse()) await process.stop();
    try {
      await database.query('DELETE FROM "Order" WHERE "userId" = ANY($1::uuid[])', [users]);
      await database.query('DELETE FROM "Review" WHERE "productId"=$1', [productId]);
      await database.query('DELETE FROM "Product" WHERE id=$1', [productId]);
      await database.query('DELETE FROM "session" WHERE sess->>\'userId\' = ANY($1::text[])', [users]);
      await database.query('DELETE FROM "User" WHERE id = ANY($1::uuid[])', [users]);
    } finally { await database.end(); }
  }
});
