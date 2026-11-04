// Run only against the disposable loopback DB configured per website/README.md.
// Mutates compiled JS only; always restores exact bytes, even when tests fail.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const backend = fileURLToPath(new URL('../../website/backend/', import.meta.url));
const evidence = new URL('./audit-20261103/', import.meta.url);
const files = ['lib/data-errors.js', 'controllers/product-controller.js', 'controllers/order-controller.js'];
const originals = new Map(await Promise.all(files.map(async file => [file, await readFile(new URL(`../../website/backend/dist/${file}`, import.meta.url))])));
const env = { ...process.env, NODE_ENV: 'development', APP_PROFILE: 'production',
  VULN_IDOR_ENABLED: 'false', VULN_SQLI_ENABLED: 'false', VULN_XSS_ENABLED: 'false', VULN_AUTH_ENABLED: 'false' };
const db = new URL(env.DATABASE_URL);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(db.hostname));
assert.match(db.pathname, /test|lab|security/);
const path = file => new URL(`../../website/backend/dist/${file}`, import.meta.url);
async function run(args, log) {
  const child = spawn(process.execPath, args, { cwd: backend, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  const [code] = await once(child, 'exit');
  await writeFile(new URL(log, evidence), output);
  return { code, output };
}
async function restore() {
  for (const [file, bytes] of originals) await writeFile(path(file), bytes);
}
const summary = [];
try {
  // A: old translator plus old controller ID checks, so malformed IDs also
  // reach the old blanket catch. Domain preconditions are unchanged.
  await writeFile(path(files[0]), `import { databaseUnavailable } from './errors.js';\nexport function translatePrismaError() { return databaseUnavailable(); }\nexport function rethrowDataError() { throw databaseUnavailable(); }\n`);
  const product = originals.get(files[1]).toString().replace('if (!UUID_PATTERN.test(id))', 'if (false)');
  const order = originals.get(files[2]).toString().replace("!z.uuid().safeParse(param).success", '!param');
  assert.notEqual(product, originals.get(files[1]).toString()); assert.notEqual(order, originals.get(files[2]).toString());
  await writeFile(path(files[1]), product); await writeFile(path(files[2]), order);
  const a = await run(['--test', 'tests/data-errors.integration.test.mjs'], 'negative-control-a.txt');
  assert.notEqual(a.code, 0, 'old blanket handling must fail HTTP regression');
  for (const name of ['malformed product/order', 'missing product update/delete', 'real FK delete', 'registration DB uniqueness']) assert.match(a.output, new RegExp(name));
  assert.match(a.output, /503 !== (400|404|409)/);
  summary.push('A: nonzero exit; malformed/missing/FK/registration HTTP contracts fail with 503. Controller validation deliberately restored to old shape checks for malformed-ID control.');
  await restore();

  // B: remove only passthrough. Use a fresh compiled API for the unchanged
  // main inventory suites, plus unit identity tests for every domain code.
  const bSource = originals.get(files[0]).toString().replace(/if \(error instanceof AppError\)\s*return error;/, '');
  assert.notEqual(bSource, originals.get(files[0]).toString());
  await writeFile(path(files[0]), bSource);
  const server = spawn(process.execPath, ['dist/server.js'], { cwd: backend, env, windowsHide: true, stdio: 'ignore' });
  try {
    let healthy = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(`${env.TEST_API_URL}/api/health`)).ok) { healthy = true; break; } } catch {}
      await delay(50);
    }
    assert.ok(healthy);
    const b = await run(['--test', '--test-name-pattern=inventory #', 'tests/api.integration.test.mjs'], 'negative-control-b.txt');
    assert.notEqual(b.code, 0);
    assert.match(b.output, /503 !== 400/); assert.match(b.output, /503 !== 409/);
    const unit = await run(['--test', '--test-name-pattern=AppError', 'tests/data-errors.test.mjs'], 'negative-control-b-unit.txt');
    assert.notEqual(unit.code, 0);
    for (const code of ['OUT_OF_STOCK', 'CANNOT_CANCEL', 'FORBIDDEN', 'INVALID_STATUS_TRANSITION']) assert.match(unit.output, new RegExp(code));
    summary.push('B: passthrough-only removal fails #61 HTTP 400 contracts and #65 HTTP 409 contracts; all five AppError identity tests fail.');
  } finally {
    if (server.exitCode === null && server.signalCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
  }
  await restore();

  const cSource = originals.get(files[0]).toString().replace('return databaseUnavailable();', "return new AppError(400, 'INVALID_INPUT', 'unsafe control');");
  assert.notEqual(cSource, originals.get(files[0]).toString());
  await writeFile(path(files[0]), cSource);
  const c = await run(['--test', 'tests/data-errors.integration.test.mjs'], 'negative-control-c.txt');
  assert.notEqual(c.code, 0);
  assert.match(c.output, /400 !== 503/);
  const unit = await run(['--test', 'tests/data-errors.test.mjs'], 'negative-control-c-unit.txt');
  assert.notEqual(unit.code, 0);
  summary.push('C: unsafe fallback to 400 fails unknown non-Prisma, unmapped Prisma and unreachable DB HTTP tests; unit fallback tests fail.');
} finally {
  await restore();
  for (const [file, bytes] of originals) assert.deepEqual(await readFile(path(file)), bytes, `${file} restored byte-for-byte`);
  summary.push('All compiled modules restored byte-for-byte. No source mutation.');
  await writeFile(new URL('negative-controls.txt', evidence), summary.join('\n') + '\n');
  console.log(summary.join('\n'));
}
