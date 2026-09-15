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
  } finally {
    await database.end();
  }
});
