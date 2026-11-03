import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
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

// Real database barriers, confined to this suite's disposable fixtures. Holding a
// product row lets every request finish its pre-read before any write can commit.
// Inspect the blocking graph (including indirect waiters), rather than assuming
// that Promise.all or a fixed delay guarantees overlap. No application test hook.
async function withBlockedProduct(database, productId, requestFactories, inspect = async () => {}) {
  const blocker = await database.connect();
  let pending = [];
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM "Product" WHERE id = $1 FOR UPDATE', [productId]);
    const blockerPid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    pending = requestFactories.map(request => request());
    // Attach handlers immediately, also when a barrier assertion fails.
    const settled = Promise.allSettled(pending);
    const deadline = Date.now() + 3000; // Below Prisma's default 5s transaction timeout.
    let waiters = [];
    while (Date.now() < deadline) {
      waiters = (await database.query(`
        WITH RECURSIVE waiting(pid) AS (
          SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))
          UNION
          SELECT a.pid FROM pg_stat_activity a JOIN waiting w
            ON w.pid = ANY(pg_blocking_pids(a.pid))
        )
        SELECT a.pid, a.query FROM waiting w JOIN pg_stat_activity a USING (pid)
        WHERE a.datname = current_database() AND a.wait_event_type = 'Lock'
          AND a.query LIKE 'UPDATE %'
      `, [blockerPid])).rows;
      if (waiters.length >= pending.length) break;
      await delay(10);
    }
    assert.equal(waiters.length, pending.length, 'all API writes must overlap at the database barrier');
    await inspect(waiters);
    await blocker.query('ROLLBACK');
    return (await settled).map(outcome => {
      if (outcome.status === 'rejected') throw outcome.reason;
      return outcome.value;
    });
  } finally {
    await blocker.query('ROLLBACK');
    await Promise.allSettled(pending);
    blocker.release();
  }
}

function inventoryTest(name, run) {
  test(`inventory #61 ${name}`, async context => {
    assert.notEqual(process.env.NODE_ENV, 'production');
    const connection = new URL(process.env.DATABASE_URL);
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname));
    assert.match(connection.pathname, /(?:test|lab)/i, 'Use a disposable test/lab database.');
    const database = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    const productIds = [randomUUID(), randomUUID()];
    const address = `Inventory fixture ${randomUUID()}`;
    const userIds = [];
    try {
      for (const id of productIds) {
        await database.query(
          'INSERT INTO "Product" (id,name,description,price,stock,"updatedAt") VALUES ($1,$2,$3,1250.50,10,NOW())',
          [id, 'Inventory regression fixture', 'Synthetic #61 product'],
        );
      }
      const stock = async id => (await database.query('SELECT stock FROM "Product" WHERE id=$1', [id])).rows[0].stock;
      const counts = async () => (await database.query(`
        SELECT (SELECT count(*)::int FROM "Order" WHERE "shippingAddress"=$1) AS orders,
          (SELECT count(*)::int FROM "OrderItem" WHERE "productId"=ANY($2::uuid[])) AS items
      `, [address, productIds])).rows[0];
      const guest = async () => {
        const client = new BrowserSession();
        const csrfToken = await client.csrf();
        return items => client.request('/orders', { method: 'POST', csrfToken, body: {
          items, shippingAddress: address,
          guestInfo: { name: 'Inventory guest', email: 'inventory-fixture@example.com' },
        } });
      };
      await run({ context, database, productIds, address, userIds, stock, counts, guest });
    } finally {
      // Exact fixture IDs, even on failed assertions/negative controls. Never
      // reset seed stock or delete orders using broad email patterns.
      await database.query('DELETE FROM "Order" WHERE "shippingAddress"=$1', [address]);
      await database.query('DELETE FROM "Product" WHERE id=ANY($1::uuid[])', [productIds]);
      await database.query("DELETE FROM session WHERE sess->>'userId'=ANY($1::text[])", [userIds]);
      await database.query('DELETE FROM "User" WHERE id=ANY($1::uuid[])', [userIds]);
      await database.end();
    }
  });
}

inventoryTest('checkout race', async ({ context, database, productIds: [productId], stock, counts, guest }) => {
  // Prepare CSRF sessions before the burst; session setup must not stagger writes.
  const buyers = await Promise.all(Array.from({ length: 5 }, () => guest()));
  await database.query('UPDATE "Product" SET stock=3 WHERE id=$1', [productId]);
  const outcomes = await withBlockedProduct(database, productId,
    buyers.map(buy => () => buy([{ productId, quantity: 1 }])),
    async waiters => context.diagnostic(`overlapping checkout writes=${waiters.length}; SQL=${waiters[0].query}`));
  const finalStock = await stock(productId);
  const rows = await counts();
  context.diagnostic(JSON.stringify({ http: outcomes.map(r => r.status), errors: outcomes.map(r => r.body.error?.code ?? 'OK'), finalStock, ...rows }));
  assert.equal(outcomes.filter(r => r.status === 201).length, 3, 'exactly stock units may sell');
  assert.equal(finalStock, 0, 'stock cannot be negative');
  assert.deepEqual(rows, { orders: 3, items: 3 }, 'no extra order or order item');
  for (const response of outcomes.filter(r => r.status !== 201)) {
    assert.equal(response.status, 400, 'loser must be OUT_OF_STOCK, not infrastructure 503');
    assert.equal(response.body.error.code, 'OUT_OF_STOCK');
  }
});

inventoryTest('concurrent cancel', async ({ context, database, productIds: [productId], address, userIds, stock }) => {
  const owner = new BrowserSession();
  const registered = await owner.request('/auth/register', { method: 'POST', csrfToken: await owner.csrf(),
    body: { name: 'Inventory owner', email: `inventory-${randomUUID()}@example.com`, password: 'LocalLabOnly517!' } });
  assert.equal(registered.status, 201);
  userIds.push(registered.body.data.user.id);
  const csrfToken = await owner.csrf();
  // Each fresh order has an independently synchronized pair; every round must
  // pass. Repetition is extra coverage, not a retry that masks a failing round.
  for (let round = 1; round <= 3; round++) {
    const created = await owner.request('/orders', { method: 'POST', csrfToken,
      body: { items: [{ productId, quantity: 2 }], shippingAddress: address } });
    assert.equal(created.status, 201);
    assert.equal(await stock(productId), 8);
    const id = created.body.data.id;
    const cancel = () => owner.request(`/orders/${id}/cancel`, { method: 'POST', csrfToken });
    const outcomes = await withBlockedProduct(database, productId, [cancel, cancel],
      async waiters => context.diagnostic(`round=${round}; overlapping cancel writes=${waiters.length}; SQL=${waiters.map(w => w.query).join(' | ')}`));
    const finalStock = await stock(productId);
    const status = (await database.query('SELECT status FROM "Order" WHERE id=$1', [id])).rows[0].status;
    context.diagnostic(JSON.stringify({ round, http: outcomes.map(r => r.status), errors: outcomes.map(r => r.body.error?.code ?? 'OK'), finalStock, status }));
    assert.equal(outcomes.filter(r => r.status === 200).length, 1, 'exactly one cancellation may win');
    const losers = outcomes.filter(r => r.status !== 200);
    assert.equal(losers.length, 1);
    assert.equal(losers[0].status, 400);
    assert.equal(losers[0].body.error.code, 'CANNOT_CANCEL');
    assert.equal(status, 'CANCELLED');
    assert.equal(finalStock, 10, 'restore exactly once; no phantom stock');
  }
});

inventoryTest('duplicate product lines', async ({ context, database, productIds: [productId], stock, counts, guest }) => {
  const buy = await guest();
  const items = [{ productId, quantity: 2 }, { productId, quantity: 2 }];
  await database.query('UPDATE "Product" SET stock=3 WHERE id=$1', [productId]);
  const rejected = await buy(items);
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.error.code, 'OUT_OF_STOCK');
  assert.equal(await stock(productId), 3);
  assert.deepEqual(await counts(), { orders: 0, items: 0 });

  await database.query('UPDATE "Product" SET stock=5 WHERE id=$1', [productId]);
  const accepted = await buy(items);
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.data.totalPrice, '5002.00');
  assert.deepEqual(accepted.body.data.items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
    items.map(i => ({ ...i, unitPrice: '1250.50' })));
  const saved = await database.query('SELECT quantity,"unitPrice"::text FROM "OrderItem" WHERE "orderId"=$1', [accepted.body.data.id]);
  assert.deepEqual(saved.rows, [{ quantity: 2, unitPrice: '1250.50' }, { quantity: 2, unitPrice: '1250.50' }]);
  assert.equal(await stock(productId), 1);
  assert.deepEqual(await counts(), { orders: 1, items: 2 });
  context.diagnostic('stock=3 rejects total quantity 4 without writes; stock=5 accepts two original lines, total=5002.00, remaining=1');
});

inventoryTest('multi-product rollback', async ({ context, database, productIds: [a, b], stock, counts, guest }) => {
  const buy = await guest();
  // B has one unit but needs two. Its nonzero stock ensures the UPDATE attempts
  // to lock B even with PostgreSQL's predicate recheck after a concurrent write.
  await database.query('UPDATE "Product" SET stock=1 WHERE id=$1', [b]);
  // Hold B, then let another transaction spend its last unit AFTER the service
  // pre-read. This exercises failure after A was already decremented.
  const blocker = await database.connect();
  let pending;
  try {
    await blocker.query('BEGIN');
    await blocker.query('UPDATE "Product" SET stock=0 WHERE id=$1', [b]);
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    pending = buy([{ productId: a, quantity: 2 }, { productId: b, quantity: 1 }]);
    const deadline = Date.now() + 3000;
    let waiting = false;
    while (Date.now() < deadline) {
      waiting = (await database.query('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS waiting', [pid])).rows[0].waiting;
      if (waiting) break;
      await delay(10);
    }
    assert.equal(waiting, true, 'checkout reached B after its pre-read');
    await assert.rejects(database.query('SELECT id FROM "Product" WHERE id=$1 FOR UPDATE NOWAIT', [a]),
      { code: '55P03' }, 'A is already claimed inside the in-flight transaction');
    await blocker.query('COMMIT');
    const result = await pending;
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, 'OUT_OF_STOCK');
    assert.equal(await stock(a), 10, 'earlier decrement of A must roll back');
    assert.equal(await stock(b), 0, 'failed checkout cannot change B');
    assert.deepEqual(await counts(), { orders: 0, items: 0 });
    context.diagnostic('A write lock observed (55P03); B sold out after pre-read; HTTP=400 OUT_OF_STOCK; stocks A=10 B=0; orders=0 items=0');
  } finally {
    await blocker.query('ROLLBACK');
    if (pending) await Promise.allSettled([pending]);
    blocker.release();
  }
});

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

    await suite.test('public catalog excludes deployment verification items', async () => {
      const testId = randomUUID();
      await database.query(
        'INSERT INTO "Product" (id, name, description, price, stock, category, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
        [testId, 'Deployment verification item - NOT FOR SALE', 'Verification item only', 10000, 0, 'Deployment verification']
      );
      try {
        const publicList = await browser.request('/products');
        assert.equal(publicList.status, 200);
        const foundInPublic = publicList.body.data.some(
          (p) => p.id === testId || p.category === 'Deployment verification' || p.name.includes('NOT FOR SALE')
        );
        assert.equal(foundInPublic, false, 'Public catalog must exclude verification items');

        const singlePublic = await browser.request(`/products/${testId}`);
        assert.equal(singlePublic.status, 404, 'Direct public request for verification item must 404');

        const verificationList = await browser.request('/products?includeVerification=true');
        assert.equal(verificationList.status, 200);
        const foundInVerification = verificationList.body.data.some((p) => p.id === testId);
        assert.equal(foundInVerification, true, 'Can query with includeVerification=true');

        const singleVerification = await browser.request(`/products/${testId}?includeVerification=true`);
        assert.equal(singleVerification.status, 200, 'Can get verification item with includeVerification=true');
      } finally {
        await database.query('DELETE FROM "Product" WHERE id = $1', [testId]);
      }
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

    await suite.test('product search rejects SQL injection payloads', async () => {
      // Secure Baseline: payload must be treated as a literal search value.
      const tautology = await browser.request(`/products?search=${encodeURIComponent("' OR '1'='1")}`);
      assert.equal(tautology.status, 200);
      assert.deepEqual(tautology.body.data, [], 'SQL injection must not return rows on the secure baseline.');

      // The UNION payload selects the "User" table, so leaking it would surface an
      // `email` field that the products API must never expose.
      const union = await browser.request(
        `/products?search=${encodeURIComponent(`') UNION SELECT id, name, email, NULL::text, 0, 'CUSTOMER', "createdAt", "updatedAt" FROM "User" --`)}`,
      );
      assert.equal(union.status, 200);
      assert.deepEqual(union.body.data, [], 'UNION injection must not return rows on the secure baseline.');

      // A stacked statement must not execute, and the table must survive it.
      const stacked = await browser.request(
        `/products?search=${encodeURIComponent(`'; DROP TABLE "Product"; --`)}`,
      );
      assert.ok([200, 400, 500].includes(stacked.status));
      const surviving = await database.query('SELECT count(*)::int AS count FROM "Product"');
      assert.ok(surviving.rows[0].count >= 6, 'Product table must survive injection attempts.');
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
      for (const customerPhone of ['123', '1'.repeat(21), 912345678]) {
        const invalidPhoneOrder = await userA.request('/orders', {
          method: 'POST', csrfToken,
          body: {
            items: [{ productId: prod.id, quantity: 1 }],
            shippingAddress: '123 Đường Kiểm Thử, Đà Nẵng',
            customerPhone,
          },
        });
        assert.equal(invalidPhoneOrder.status, 400);
        assert.equal(invalidPhoneOrder.body.error.code, 'INVALID_INPUT');
      }
      const orderRes = await userA.request('/orders', {
        method: 'POST',
        csrfToken,
        body: {
          items: [{ productId: prod.id, quantity: 1 }],
          shippingAddress: '123 Đường Kiểm Thử, Đà Nẵng',
          customerPhone: ' 0912345678 ',
        },
      });
      assert.equal(orderRes.status, 201);
      const createdOrderId = orderRes.body.data.id;
      assert.equal(orderRes.body.data.totalPrice, prod.price);
      assert.equal(orderRes.body.data.customerPhone, '0912345678');
      const savedPhone = await database.query('SELECT "customerPhone" FROM "Order" WHERE id = $1', [createdOrderId]);
      assert.equal(savedPhone.rows[0].customerPhone, '0912345678');

      // User A can view own order
      const getOwnOrder = await userA.request(`/orders/${createdOrderId}`);
      assert.equal(getOwnOrder.status, 200);
      assert.equal(getOwnOrder.body.data.id, createdOrderId);
      assert.equal(getOwnOrder.body.data.customerPhone, '0912345678');

      const noPhoneOrder = await userA.request('/orders', {
        method: 'POST', csrfToken,
        body: {
          items: [{ productId: prod.id, quantity: 1 }],
          shippingAddress: '123 Đường Kiểm Thử, Đà Nẵng',
        },
      });
      assert.equal(noPhoneOrder.status, 201);
      assert.equal(noPhoneOrder.body.data.customerPhone, null);
      assert.equal((await userA.request(`/orders/${noPhoneOrder.body.data.id}/cancel`, {
        method: 'POST', csrfToken,
      })).status, 200);

      // Register User B
      const userB = new BrowserSession();
      const userBCsrf = await userB.csrf();
      await userB.request('/auth/register', {
        method: 'POST',
        csrfToken: userBCsrf,
        body: { name: 'User B', email: `user_b_${Date.now()}@example.com`, password: 'Password123!' },
      });

      // User B attempts to access User A's order (IDOR Read attack simulation)
      const idorAttempt = await userB.request(`/orders/${createdOrderId}`);
      assert.equal(idorAttempt.status, 403, 'IDOR attack must be blocked with 403 FORBIDDEN');
      assert.equal(idorAttempt.body.error.code, 'FORBIDDEN');

      // User B attempts to modify User A's order (IDOR Update attack simulation)
      const userBPostCsrf = await userB.csrf();
      const idorUpdateAttempt = await userB.request(`/orders/${createdOrderId}`, {
        method: 'PATCH',
        csrfToken: userBPostCsrf,
        body: { shippingAddress: 'Dia chi gia mao cua Hacker' },
      });
      assert.equal(idorUpdateAttempt.status, 403, 'IDOR update attack must be blocked with 403 FORBIDDEN');
      assert.equal(idorUpdateAttempt.body.error.code, 'FORBIDDEN');

      // User B attempts to cancel User A's order (IDOR Cancel attack simulation)
      const idorCancelAttempt = await userB.request(`/orders/${createdOrderId}/cancel`, {
        method: 'POST',
        csrfToken: userBPostCsrf,
      });
      assert.equal(idorCancelAttempt.status, 403, 'IDOR cancel attack must be blocked with 403 FORBIDDEN');
      assert.equal(idorCancelAttempt.body.error.code, 'FORBIDDEN');

      // User A (legitimate owner) updates own order
      const userAPostCsrf = await userA.csrf();
      const updateOwnOrder = await userA.request(`/orders/${createdOrderId}`, {
        method: 'PATCH',
        csrfToken: userAPostCsrf,
        body: { shippingAddress: '456 Đường Nguyễn Văn Linh, Đà Nẵng', customerPhone: '0905123456' },
      });
      assert.equal(updateOwnOrder.status, 200);
      assert.equal(updateOwnOrder.body.data.shippingAddress, '456 Đường Nguyễn Văn Linh, Đà Nẵng');

      // User A (legitimate owner) cancels own order
      const cancelOwnOrder = await userA.request(`/orders/${createdOrderId}/cancel`, {
        method: 'POST',
        csrfToken: userAPostCsrf,
      });
      assert.equal(cancelOwnOrder.status, 200);
      assert.equal(cancelOwnOrder.body.data.status, 'CANCELLED');
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
