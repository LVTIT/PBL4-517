// Run after the canonical backend build/migrate/seed, with the dedicated local
// DATABASE_URL and SESSION_SECRET in the environment. Mutates compiled output
// only; source and the #61 functions stay byte-for-byte intact. Always restores
// the compiled service, including when a control unexpectedly passes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const backend = fileURLToPath(new URL('../../website/backend/', import.meta.url));
const output = new URL('./audit-20261103/', import.meta.url);
const service = new URL('../../website/backend/dist/services/order-service.js', import.meta.url);
const original = await readFile(service, 'utf8');
const boundary = original.indexOf('// Allowed forward transitions.');
assert.ok(boundary > 0);
const preserved = original.slice(0, boundary);
const admin = original.slice(boundary);
const digest = value => createHash('sha256').update(value).digest('hex');
const db = new URL(process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(db.hostname));
assert.match(db.pathname, /(?:test|lab)/i);
assert.notEqual(process.env.NODE_ENV, 'production');

function run(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: backend, env });
    let text = '';
    child.stdout.on('data', chunk => { text += chunk; });
    child.stderr.on('data', chunk => { text += chunk; });
    child.on('error', reject);
    child.on('exit', code => resolve({ code, text }));
  });
}

const variants = [
  { name: 'a', pattern: 'inventory #65 admin cancellation',
    mutate: code => code.replace("if (status === 'CANCELLED')", 'if (false)'),
    failure: /admin cancel restores duplicate quantities/ },
  { name: 'b', pattern: 'inventory #65 (invalid transition matrix|phantom inventory loop)',
    mutate: code => code.replace('if (current.status === status)', 'if (false)')
      .replace('if (!ALLOWED_TRANSITIONS[current.status].includes(status))', 'if (false)'),
    failure: /CANCELLED cannot reopen/ },
  { name: 'c', pattern: 'inventory #65 admin vs admin concurrent cancel',
    mutate: code => {
      const start = code.indexOf('const claim = await tx.order.updateMany(');
      const end = code.indexOf("if (status === 'CANCELLED')", start);
      assert.ok(start > 0 && end > start);
      return (code.slice(0, start) + code.slice(end)).replace(
        'return tx.order.findUniqueOrThrow({',
        "await tx.order.update({ where: { id: orderId }, data: { status } });\n            return tx.order.findUniqueOrThrow({");
    }, failure: /exactly one cancellation path wins/ },
];

try {
  for (const [index, variant] of variants.entries()) {
    const changed = preserved + variant.mutate(admin);
    assert.notEqual(changed, original);
    assert.equal(changed.slice(0, boundary), preserved, '#61 functions remain identical');
    await writeFile(service, changed);
    const port = 3066 + index;
    const env = { ...process.env, PORT: String(port), TEST_API_URL: `http://127.0.0.1:${port}`,
      APP_PROFILE: 'production', TRUST_PROXY: '0',
      VULN_IDOR_ENABLED: 'false', VULN_SQLI_ENABLED: 'false', VULN_XSS_ENABLED: 'false', VULN_AUTH_ENABLED: 'false' };
    const server = spawn(process.execPath, ['dist/server.js'], { cwd: backend, env, stdio: 'ignore' });
    const closed = new Promise(resolve => server.once('exit', resolve));
    try {
      let healthy = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        healthy = await fetch(`${env.TEST_API_URL}/api/health`).then(r => r.ok).catch(() => false);
        if (healthy) break;
        await delay(100);
      }
      assert.equal(healthy, true);
      const result = await run(['--test', '--test-reporter=tap', '--test-name-pattern', variant.pattern, 'tests/api.integration.test.mjs'], env);
      await writeFile(new URL(`negative-control-${variant.name}.txt`, output),
        `Compiled-service control ${variant.name.toUpperCase()}; #61 prefix sha256=${digest(preserved)}\n${result.text}\nexit=${result.code}\n`);
      assert.equal(result.code, 1, `negative control ${variant.name} must fail`);
      assert.match(result.text, variant.failure, 'failure must have the intended reason');
      if (variant.name === 'b') {
        assert.match(result.text, /PENDING -> PENDING must conflict/);
        assert.match(result.text, /"finalStock":12/);
      }
      if (variant.name === 'c') assert.match(result.text, /"winners":2/);
      console.log(`Control ${variant.name.toUpperCase()}: expected regression failure observed; exit=${result.code}`);
    } finally {
      server.kill();
      await closed;
    }
  }
} finally {
  await writeFile(service, original);
  assert.equal(await readFile(service, 'utf8'), original);
  console.log(`Compiled service restored byte-for-byte; sha256=${digest(original)}`);
}
