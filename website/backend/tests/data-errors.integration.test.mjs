// Issue #63: real PostgreSQL, compiled services and HTTP serialization. Fault
// injection is confined to disposable child processes, never production hooks.
import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { Prisma } from '../dist/generated/prisma/client.js';
import { prisma, closeDatabase } from '../dist/lib/database.js';
import { translatePrismaError } from '../dist/lib/data-errors.js';

const unavailable = 'Dịch vụ dữ liệu tạm thời không khả dụng. Vui lòng thử lại.';
function expectError(response, status, code, message) {
  assert.equal(response.status, status);
  assert.deepEqual(response.body, { error: { code, message } });
  assert.doesNotMatch(JSON.stringify(response.body), /Prisma|SELECT |constraint|postgres(?:ql)?:|passwordHash|db\.internal|\/private\/|[A-Z]:\\/);
}
class Session {
  cookie = '';
  constructor(url) { this.url = url; }
  async request(path, method = 'GET', body) {
    const csrf = method === 'GET' ? undefined : (await this.request('/auth/csrf')).body.data.csrfToken;
    const response = await fetch(this.url + '/api' + path, { method,
      headers: { ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    for (const value of response.headers.getSetCookie()) {
      if (value.startsWith('pbl517.sid=')) this.cookie = value.split(';')[0];
    }
    return { status: response.status, body: await response.json() };
  }
}

async function launch(mode = 'normal', env = {}, productId) {
  const script = `
    import { app } from './dist/app.js';
    import { prisma } from './dist/lib/database.js';
    import { Prisma } from './dist/generated/prisma/client.js';
    const mode = ${JSON.stringify(mode)};
    if (mode === 'unknown') prisma.product.findMany = async () => { throw new Error('PRIVATE postgres://secret@db.internal /private/probe'); };
    if (mode === 'unmapped') prisma.product.findMany = async () => { throw new Prisma.PrismaClientKnownRequestError('PRIVATE SELECT constraint', {code:'P2034', clientVersion:'7.10.0'}); };
    if (mode === 'unique') prisma.product.findMany = () => prisma.product.create({data:{id:${JSON.stringify(productId)},name:'duplicate',description:'test',price:'1',stock:1}});
    const server = app.listen(0, '127.0.0.1', () => console.log('READY:' + server.address().port));
  `;
  const child = spawn(process.execPath, ['-e', script], { windowsHide: true,
    env: { ...process.env, NODE_ENV: 'development', APP_PROFILE: 'production',
      VULN_IDOR_ENABLED: 'false', VULN_SQLI_ENABLED: 'false', VULN_XSS_ENABLED: 'false', VULN_AUTH_ENABLED: 'false', ...env },
    stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  // Do not emit potentially private Prisma/driver diagnostics.
  child.stderr.resume();
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  };
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      const match = output.match(/READY:(\d+)/);
      if (match) return { session: () => new Session(`http://127.0.0.1:${match[1]}`), stop };
      assert.equal(child.exitCode, null, 'isolated API must start');
      await delay(50);
    }
    throw new Error('isolated API startup deadline');
  } catch (error) { await stop(); throw error; }
}

test('data errors #63 PostgreSQL HTTP regression', { timeout: 60000 }, async suite => {
  const connection = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname));
  assert.match(connection.pathname, /(?:test|lab|security)/i);
  const database = new Pool({ connectionString: process.env.DATABASE_URL });
  const productId = randomUUID(), orderId = randomUUID(), itemId = randomUUID();
  const email = `mapping-${randomUUID()}@example.com`, raceEmail = `race-${randomUUID()}@example.com`;
  const children = [];
  try {
    const api = await launch(); children.push(api);
    const owner = api.session(), admin = api.session(), outsider = api.session();
    const registered = await owner.request('/auth/register', 'POST', { name: 'Mapping owner', email, password: 'LocalLabOnly517!' });
    assert.equal(registered.status, 201);
    const ownerId = registered.body.data.user.id;
    assert.equal((await admin.request('/auth/login', 'POST', { email: 'admin@example.com', password: 'AdminOnly517!' })).status, 200);
    assert.equal((await outsider.request('/auth/login', 'POST', { email: 'demo@example.com', password: 'DemoOnly517!' })).status, 200);
    await database.query('INSERT INTO "Product" (id,name,description,price,stock,"updatedAt") VALUES ($1,\'Mapping fixture\',\'synthetic\',1,0,NOW())', [productId]);
    await database.query('INSERT INTO "Order" (id,"userId","totalPrice","shippingAddress","updatedAt") VALUES ($1,$2,1,\'Mapping fixture address\',NOW())', [orderId, ownerId]);
    await database.query('INSERT INTO "OrderItem" (id,"orderId","productId",quantity,"unitPrice") VALUES ($1,$2,$3,1,1)', [itemId, orderId, productId]);

    await suite.test('malformed product/order IDs reject before DB with safe 400', async () => {
      for (const [client, path, method, body] of [
        [owner, '/products/not-a-uuid', 'GET'], [owner, '/products/not-a-uuid/reviews', 'GET'],
        [admin, '/products/not-a-uuid', 'PUT', { name: 'valid' }], [admin, '/products/not-a-uuid', 'DELETE'],
        [owner, '/orders/not-a-uuid', 'GET'], [owner, '/orders/not-a-uuid', 'PATCH', { shippingAddress: 'valid address' }],
        [owner, '/orders/not-a-uuid/cancel', 'POST'], [admin, '/admin/orders/not-a-uuid/status', 'PATCH', { status: 'CANCELLED' }],
      ]) expectError(await client.request(path, method, body), 400, 'INVALID_ID', 'Mã không hợp lệ.');
    });

    await suite.test('missing product update/delete and resource reads retain safe 404', async () => {
      const missing = randomUUID();
      expectError(await owner.request(`/products/${missing}`), 404, 'NOT_FOUND', 'Sản phẩm không tồn tại.');
      for (const method of ['PUT', 'DELETE']) {
        expectError(await admin.request(`/products/${missing}`, method, method === 'PUT' ? { name: 'valid' } : undefined),
          404, 'NOT_FOUND', 'Không tìm thấy dữ liệu yêu cầu.');
      }
      expectError(await owner.request(`/orders/${missing}`), 404, 'NOT_FOUND', 'Đơn hàng không tồn tại.');
    });

    const snapshot = async () => (await database.query(`SELECT
      (SELECT row_to_json(p) FROM "Product" p WHERE id=$1) AS product,
      (SELECT row_to_json(o) FROM "Order" o WHERE id=$2) AS "order",
      (SELECT row_to_json(i) FROM "OrderItem" i WHERE id=$3) AS item`, [productId, orderId, itemId])).rows[0];
    await suite.test('real FK delete returns safe 409 and preserves all rows', async () => {
      const before = await snapshot();
      expectError(await admin.request(`/products/${productId}`, 'DELETE'), 409, 'CONFLICT',
        'Dữ liệu đang được tham chiếu ở nơi khác nên không thể thay đổi hoặc xoá.');
      assert.deepEqual(await snapshot(), before);
    });

    await suite.test('current Prisma 7.10/PostgreSQL codes and structured context are measured', async context => {
      const probe = async (name, operation, code, modelName, target) => {
        await assert.rejects(operation, error => {
          assert.ok(error instanceof Prisma.PrismaClientKnownRequestError);
          assert.equal(error.code, code);
          assert.equal(error.meta?.modelName, modelName);
          if (target) {
            // The pinned pg adapter reports structured constraint.index rather
            // than meta.target; verify its identity here, never send it to HTTP.
            assert.equal(error.meta?.driverAdapterError?.cause?.constraint?.index, `${modelName}_${target[0]}_key`);
          }
          context.diagnostic(`${name}: ${code}; model=${modelName}${target ? '; target=' + target.join(',') : ''}`);
          return true;
        });
      };
      await probe('malformed UUID (not globally mapped)', () => prisma.product.findUnique({ where: { id: 'not-a-uuid' } }), 'P2007', 'Product');
      await probe('missing update', () => prisma.product.update({ where: { id: randomUUID() }, data: { name: 'valid' } }), 'P2025', 'Product');
      await probe('missing delete', () => prisma.product.delete({ where: { id: randomUUID() } }), 'P2025', 'Product');
      await probe('referenced delete', () => prisma.product.delete({ where: { id: productId } }), 'P2003', 'Product');
      await probe('duplicate email', () => prisma.user.create({ data: { email, name: 'duplicate', passwordHash: 'unused' } }), 'P2002', 'User', ['email']);
      try {
        await prisma.product.create({ data: { id: productId, name: 'duplicate', description: 'test', price: '1', stock: 1 } });
        assert.fail('unique violation required');
      } catch (error) {
        assert.equal(error.code, 'P2002');
        assert.equal(error.meta?.modelName, 'Product');
        const mapped = translatePrismaError(error);
        assert.equal(mapped.status, 409); assert.equal(mapped.code, 'CONFLICT'); assert.equal(mapped.message, 'Dữ liệu đã tồn tại.');
        context.diagnostic('generic Product.id unique: P2002 -> 409 CONFLICT');
      }
    });

    await suite.test('registration DB uniqueness race returns EMAIL_EXISTS after a stale pre-check', async context => {
      const blocker = await database.connect();
      let pending;
      try {
        await blocker.query('BEGIN');
        await blocker.query('INSERT INTO "User" (id,email,name,"passwordHash","updatedAt") VALUES ($1,$2,\'Race winner\',\'unused\',NOW())', [randomUUID(), raceEmail]);
        const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        pending = api.session().request('/auth/register', 'POST', { name: 'Race loser', email: raceEmail, password: 'LocalLabOnly517!' });
        const settled = Promise.allSettled([pending]);
        let blocked = false;
        for (let attempt = 0; attempt < 150; attempt++) {
          const result = await database.query(`SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid)) AND query LIKE 'INSERT INTO %User%'`, [pid]);
          if (result.rowCount > 0) { blocked = true; break; }
          await delay(20);
        }
        assert.ok(blocked, 'HTTP register must pass pre-check and reach blocked DB INSERT');
        await blocker.query('COMMIT');
        const [outcome] = await settled;
        if (outcome.status === 'rejected') throw outcome.reason;
        expectError(outcome.value, 409, 'EMAIL_EXISTS', 'Email này đã được sử dụng. Vui lòng chọn email khác.');
        assert.equal((await database.query('SELECT count(*)::int AS n FROM "User" WHERE email=$1', [raceEmail])).rows[0].n, 1);
        expectError(await api.session().request('/auth/register', 'POST', { name: 'Repeat', email: raceEmail, password: 'LocalLabOnly517!' }),
          409, 'EMAIL_EXISTS', 'Email này đã được sử dụng. Vui lòng chọn email khác.');
        context.diagnostic('uncommitted winner -> stale pre-check -> observed blocked INSERT -> COMMIT -> HTTP 409 EMAIL_EXISTS; one row');
      } finally {
        await blocker.query('ROLLBACK');
        if (pending) await Promise.allSettled([pending]);
        blocker.release();
      }
    });

    await suite.test('AppError HTTP contracts survive service catches (#61/#65/IDOR)', async () => {
      expectError(await owner.request('/orders', 'POST', { items: [{ productId, quantity: 1 }], shippingAddress: 'Mapping fixture address' }),
        400, 'OUT_OF_STOCK', 'Sản phẩm "Mapping fixture" đã hết hàng.');
      expectError(await outsider.request(`/orders/${orderId}`), 403, 'FORBIDDEN', 'Bạn không có quyền xem thông tin đơn hàng này.');
      assert.equal((await owner.request(`/orders/${orderId}/cancel`, 'POST')).status, 200);
      expectError(await owner.request(`/orders/${orderId}/cancel`, 'POST'), 400, 'CANNOT_CANCEL', 'Chỉ có thể hủy đơn hàng ở trạng thái Chờ xử lý (PENDING).');
      expectError(await admin.request(`/admin/orders/${orderId}/status`, 'PATCH', { status: 'PENDING' }),
        409, 'INVALID_STATUS_TRANSITION', 'Không thể chuyển đơn hàng từ "CANCELLED" sang "PENDING".');
    });

    for (const [mode, status, code, message] of [
      ['unique', 409, 'CONFLICT', 'Dữ liệu đã tồn tại.'],
      ['unknown', 503, 'DATABASE_UNAVAILABLE', unavailable], ['unmapped', 503, 'DATABASE_UNAVAILABLE', unavailable],
    ]) await suite.test(`${mode} service failure has safe HTTP envelope`, async () => {
      const isolated = await launch(mode, {}, productId);
      try { expectError(await isolated.session().request('/products'), status, code, message); }
      finally { await isolated.stop(); }
    });

    await suite.test('isolated unreachable DB preserves products/health 503', async () => {
      // Select a closed loopback port. The canonical DB is never stopped.
      const { createServer } = await import('node:net');
      const reserved = createServer();
      await new Promise(resolve => reserved.listen(0, '127.0.0.1', resolve));
      const port = reserved.address().port;
      await new Promise(resolve => reserved.close(resolve));
      const url = new URL(process.env.DATABASE_URL); url.port = String(port);
      const isolated = await launch('normal', { DATABASE_URL: url.toString() });
      try {
        expectError(await isolated.session().request('/products'), 503, 'DATABASE_UNAVAILABLE', unavailable);
        const health = await isolated.session().request('/health');
        expectError(health, 503, 'DATABASE_UNAVAILABLE', unavailable);
        assert.equal((await api.session().request('/health')).status, 200, 'canonical test DB stays healthy');
      } finally { await isolated.stop(); }
    });
  } finally {
    await Promise.all(children.map(child => child.stop()));
    await database.query('DELETE FROM "Order" WHERE id=$1', [orderId]);
    await database.query('DELETE FROM "Product" WHERE id=$1', [productId]);
    await database.query('DELETE FROM "User" WHERE email=ANY($1::text[])', [[email, raceEmail]]);
    await database.end();
    await closeDatabase();
  }
});
