import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { compare } from 'bcryptjs';

// Run against a started backend and a migrated, seeded development database.
const baseUrl = process.env.TEST_API_URL ?? 'http://127.0.0.1:3000';

class BrowserSession {
  cookie = '';

  async request(path, { method = 'GET', body, csrfToken } = {}) {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      if (cookie.startsWith('pbl517.sid=')) this.cookie = cookie.split(';')[0];
    }
    return { status: response.status, headers: response.headers, body: await response.json() };
  }

  async csrf() {
    const result = await this.request('/auth/csrf');
    assert.equal(result.status, 200);
    assert.match(result.body.data.csrfToken, /^[a-f0-9]{64}$/);
    return result.body.data.csrfToken;
  }
}

test('real PostgreSQL API and session authentication', async (suite) => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Use a development database.');
  const database = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  const browser = new BrowserSession();
  let user;
  let loggedInCookie;

  try {
    await suite.test('health and security headers', async () => {
      const result = await browser.request('/health');
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { data: { status: 'ok', database: 'connected' } });
      assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(result.headers.has('x-powered-by'), false);
    });

    await suite.test('products match database rows with exact decimal money', async () => {
      const result = await browser.request('/products');
      const rows = await database.query('SELECT id, name, price::text, stock FROM "Product" ORDER BY "createdAt", id');
      assert.equal(result.status, 200);
      assert.ok(rows.rows.length >= 6, 'Run the development seed first.');
      assert.deepEqual(result.body.data.map(({ id, name, price, stock }) => ({ id, name, price, stock })), rows.rows);
    });

    await suite.test('anonymous user and rejected missing CSRF token', async () => {
      assert.deepEqual((await browser.request('/auth/me')).body, { data: { user: null } });
      const result = await browser.request('/auth/login', {
        method: 'POST', body: { email: 'demo@example.com', password: 'DemoOnly517!' },
      });
      assert.equal(result.status, 403);
      assert.equal(result.body.error.code, 'CSRF_INVALID');
    });

    await suite.test('wrong password and unknown email have same error', async () => {
      const csrfToken = await browser.csrf();
      const wrongPassword = await browser.request('/auth/login', {
        method: 'POST', csrfToken, body: { email: 'demo@example.com', password: 'WrongPassword517!' },
      });
      const unknownAccount = await browser.request('/auth/login', {
        method: 'POST', csrfToken, body: { email: 'nonexistent@example.com', password: 'WrongPassword517!' },
      });
      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownAccount.status, 401);
      assert.deepEqual(wrongPassword.body, unknownAccount.body);
    });

    await suite.test('strict input validation, malformed JSON and body size limit', async () => {
      const csrfToken = await browser.csrf();
      const invalid = await browser.request('/auth/login', {
        method: 'POST', csrfToken, body: { email: 'invalid', password: 'short', role: 'ADMIN' },
      });
      assert.equal(invalid.status, 400);
      assert.equal(invalid.body.error.code, 'INVALID_INPUT');
      const malformed = await browser.request('/auth/login', { method: 'POST', csrfToken, body: '{' });
      assert.equal(malformed.status, 400);
      assert.equal(malformed.body.error.code, 'INVALID_JSON');
      const oversized = await browser.request('/auth/login', {
        method: 'POST', csrfToken, body: { padding: 'x'.repeat(17 * 1024) },
      });
      assert.equal(oversized.status, 413);
    });

    await suite.test('correct login rotates session and stores only password hash', async () => {
      const csrfToken = await browser.csrf();
      const oldCookie = browser.cookie;
      const result = await browser.request('/auth/login', {
        method: 'POST', csrfToken, body: { email: 'DEMO@example.com', password: 'DemoOnly517!' },
      });
      assert.equal(result.status, 200);
      user = result.body.data.user;
      assert.equal(user.email, 'demo@example.com');
      assert.equal(user.role, 'CUSTOMER');
      assert.equal('passwordHash' in user, false);
      assert.notEqual(browser.cookie, oldCookie);
      loggedInCookie = browser.cookie;
      const setCookie = result.headers.getSetCookie().join(';');
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);
      assert.match(setCookie, /Path=\/api/i);
      assert.equal(result.headers.get('cache-control'), 'no-store');

      const account = await database.query('SELECT "passwordHash" FROM "User" WHERE id = $1', [user.id]);
      assert.notEqual(account.rows[0].passwordHash, 'DemoOnly517!');
      assert.equal(await compare('DemoOnly517!', account.rows[0].passwordHash), true);
      const sessions = await database.query("SELECT sid FROM session WHERE sess->>'userId' = $1", [user.id]);
      assert.ok(sessions.rowCount >= 1, 'Authenticated session must be persisted in PostgreSQL.');

      const oldBrowser = new BrowserSession();
      oldBrowser.cookie = oldCookie;
      assert.equal((await oldBrowser.request('/auth/me')).body.data.user, null);
      const staleToken = await browser.request('/auth/logout', { method: 'POST', csrfToken });
      assert.equal(staleToken.status, 403);
      assert.equal((await browser.request('/auth/me')).body.data.user.id, user.id);
    });

    await suite.test('new client with existing cookie restores the session', async () => {
      const refreshedBrowser = new BrowserSession();
      refreshedBrowser.cookie = loggedInCookie;
      const result = await refreshedBrowser.request('/auth/me');
      assert.equal(result.status, 200);
      assert.deepEqual(result.body.data.user, user);
    });

    await suite.test('logout invalidates session including replayed cookie', async () => {
      const csrfToken = await browser.csrf();
      const result = await browser.request('/auth/logout', { method: 'POST', csrfToken });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { data: { user: null } });
      assert.equal((await browser.request('/auth/me')).body.data.user, null);
      const replayBrowser = new BrowserSession();
      replayBrowser.cookie = loggedInCookie;
      assert.equal((await replayBrowser.request('/auth/me')).body.data.user, null);
    });

    await suite.test('unknown API paths keep JSON error format', async () => {
      const result = await browser.request('/does-not-exist');
      assert.equal(result.status, 404);
      assert.equal(result.body.error.code, 'NOT_FOUND');
      assert.equal('stack' in result.body.error, false);
    });

    await suite.test('user registration and duplicate detection', async () => {
      const regBrowser = new BrowserSession();
      const csrfToken = await regBrowser.csrf();
      const testEmail = `test_${Date.now()}@example.com`;
      const regResult = await regBrowser.request('/auth/register', {
        method: 'POST',
        csrfToken,
        body: { name: 'Người Dùng Mới', email: testEmail, password: 'Password123!' },
      });
      assert.equal(regResult.status, 201);
      assert.equal(regResult.body.data.user.name, 'Người Dùng Mới');
      assert.equal(regResult.body.data.user.email, testEmail);

      // Verify immediate session login
      const meResult = await regBrowser.request('/auth/me');
      assert.equal(meResult.body.data.user.email, testEmail);

      // Duplicate registration rejected (requires post-registration CSRF token)
      const dupCsrf = await regBrowser.csrf();
      const dupResult = await regBrowser.request('/auth/register', {
        method: 'POST',
        csrfToken: dupCsrf,
        body: { name: 'Trùng Email', email: testEmail, password: 'Password123!' },
      });
      assert.equal(dupResult.status, 409);
      assert.equal(dupResult.body.error.code, 'EMAIL_EXISTS');
    });

    await suite.test('product search and detail with reviews', async () => {
      const searchRes = await browser.request('/products?search=Bàn%20phím');
      assert.equal(searchRes.status, 200);
      assert.ok(searchRes.body.data.length >= 1);
      assert.ok(searchRes.body.data.some((p) => p.name.includes('Bàn phím')));

      const firstProduct = searchRes.body.data[0];
      const detailRes = await browser.request(`/products/${firstProduct.id}`);
      assert.equal(detailRes.status, 200);
      assert.equal(detailRes.body.data.id, firstProduct.id);
      assert.ok(Array.isArray(detailRes.body.data.reviews));
    });

    await suite.test('orders, server-side pricing, and IDOR protection', async () => {
      // Login as demo user
      const userA = new BrowserSession();
      let csrfToken = await userA.csrf();
      await userA.request('/auth/login', {
        method: 'POST',
        csrfToken,
        body: { email: 'demo@example.com', password: 'DemoOnly517!' },
      });

      // Products list to get valid ID
      const productsRes = await userA.request('/products');
      const prod = productsRes.body.data.find((p) => p.stock > 0);
      assert.ok(prod, 'At least one product with stock is required.');

      // Create order as userA
      csrfToken = await userA.csrf();
      const orderRes = await userA.request('/orders', {
        method: 'POST',
        csrfToken,
        body: {
          items: [{ productId: prod.id, quantity: 1 }],
          shippingAddress: '123 Đường Kiểm Thử, Đà Nẵng',
        },
      });
      assert.equal(orderRes.status, 201);
      const createdOrderId = orderRes.body.data.id;
      assert.equal(orderRes.body.data.totalPrice, prod.price);

      // User A can view own order
      const getOwnOrder = await userA.request(`/orders/${createdOrderId}`);
      assert.equal(getOwnOrder.status, 200);
      assert.equal(getOwnOrder.body.data.id, createdOrderId);

      // Register User B
      const userB = new BrowserSession();
      const userBCsrf = await userB.csrf();
      await userB.request('/auth/register', {
        method: 'POST',
        csrfToken: userBCsrf,
        body: { name: 'User B', email: `user_b_${Date.now()}@example.com`, password: 'Password123!' },
      });

      // User B attempts to access User A's order (IDOR attack simulation)
      const idorAttempt = await userB.request(`/orders/${createdOrderId}`);
      assert.equal(idorAttempt.status, 403, 'IDOR attack must be blocked with 403 FORBIDDEN');
      assert.equal(idorAttempt.body.error.code, 'FORBIDDEN');
    });

    await suite.test('admin authorization guard', async () => {
      // Normal user cannot create products
      const userBrowser = new BrowserSession();
      const csrf = await userBrowser.csrf();
      await userBrowser.request('/auth/login', {
        method: 'POST',
        csrfToken: csrf,
        body: { email: 'demo@example.com', password: 'DemoOnly517!' },
      });

      // Login rotated session, so fetch new CSRF token for the authenticated user
      const postLoginCsrf = await userBrowser.csrf();
      const unauthorizedCreate = await userBrowser.request('/products', {
        method: 'POST',
        csrfToken: postLoginCsrf,
        body: { name: 'Hack Product', description: 'desc', price: 1000, stock: 10 },
      });
      assert.equal(unauthorizedCreate.status, 403);
      assert.equal(unauthorizedCreate.body.error.code, 'FORBIDDEN');
    });

    await suite.test('guest checkout without authentication', async () => {
      const guestBrowser = new BrowserSession();
      const csrf = await guestBrowser.csrf();
      const productsRes = await guestBrowser.request('/products');
      const prod = productsRes.body.data.find((p) => p.stock > 0);
      assert.ok(prod);

      // Guest order with contact info
      const guestOrder = await guestBrowser.request('/orders', {
        method: 'POST',
        csrfToken: csrf,
        body: {
          items: [{ productId: prod.id, quantity: 1 }],
          shippingAddress: 'Kí túc xá Đại học Bách Khoa, Đà Nẵng',
          guestInfo: {
            name: 'Nguyễn Khách Vãng Lai',
            email: 'guest.test@example.com',
            phone: '0987654321',
          },
        },
      });
      assert.equal(guestOrder.status, 201);
      assert.equal(guestOrder.body.data.userId, null);
      assert.equal(guestOrder.body.data.customerName, 'Nguyễn Khách Vãng Lai');
      assert.equal(guestOrder.body.data.customerEmail, 'guest.test@example.com');
      assert.equal(guestOrder.body.data.customerPhone, '0987654321');
    });

    await suite.test('role boundaries: admin cannot place orders or post reviews', async () => {
      const adminBrowser = new BrowserSession();
      const csrf = await adminBrowser.csrf();
      const loginRes = await adminBrowser.request('/auth/login', {
        method: 'POST',
        csrfToken: csrf,
        body: { email: 'admin@example.com', password: 'AdminOnly517!' },
      });
      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.data.user.role, 'ADMIN');

      const productsRes = await adminBrowser.request('/products');
      const prod = productsRes.body.data.find((p) => p.stock > 0);
      assert.ok(prod);

      // Admin attempts to place an order
      const adminOrderCsrf = await adminBrowser.csrf();
      const orderAttempt = await adminBrowser.request('/orders', {
        method: 'POST',
        csrfToken: adminOrderCsrf,
        body: {
          items: [{ productId: prod.id, quantity: 1 }],
          shippingAddress: 'Địa chỉ Admin',
        },
      });
      assert.equal(orderAttempt.status, 403);
      assert.equal(orderAttempt.body.error.code, 'ADMIN_CANNOT_ORDER');

      // Admin attempts to post a product review
      const adminReviewCsrf = await adminBrowser.csrf();
      const reviewAttempt = await adminBrowser.request(`/products/${prod.id}/reviews`, {
        method: 'POST',
        csrfToken: adminReviewCsrf,
        body: {
          rating: 5,
          comment: 'Admin tự đánh giá sản phẩm của mình.',
        },
      });
      assert.equal(reviewAttempt.status, 403);
      assert.equal(reviewAttempt.body.error.code, 'ADMIN_CANNOT_REVIEW');
    });
  } finally {
    await database.end();
  }
});
