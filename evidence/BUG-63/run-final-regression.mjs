// Requires the canonical migrated/seeded disposable DB and both built projects.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const backend = fileURLToPath(new URL('../../website/backend/', import.meta.url));
const evidence = new URL('./audit-20261103/', import.meta.url);
const connection = new URL(process.env.DATABASE_URL);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(connection.hostname));
assert.match(connection.pathname, /test|lab|security/);
const env = { ...process.env, LOCAL_SECURITY_LAB: '1' };
const server = spawn(process.execPath, ['dist/server.js'], { cwd: backend, env, windowsHide: true, stdio: 'ignore' });
try {
  let healthy = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${env.TEST_API_URL}/api/health`)).ok) { healthy = true; break; } } catch {}
    await delay(50);
  }
  assert.ok(healthy, 'compiled API healthy before regression');
  for (const [name, files] of [
    ['data-errors', ['data-errors.test.mjs']],
    ['integration', ['api.integration.test.mjs', 'data-errors.integration.test.mjs']],
    ['security', ['security-lifecycle.test.mjs']],
    ['config', ['config.test.mjs']],
  ]) {
    const child = spawn(process.execPath, ['--test', ...files.map(file => `tests/${file}`)],
      { cwd: backend, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    const [code] = await once(child, 'exit');
    await writeFile(new URL(`${name}.txt`, evidence), output);
    console.log(`${name}: exit=${code}; ${output.split('\n').filter(line => /(?:tests |pass |fail |skipped )\d/.test(line)).join('; ')}`);
    assert.equal(code, 0, `${name} must pass; inspect sanitized fixture-only evidence`);
  }
} finally {
  if (server.exitCode === null && server.signalCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
}
