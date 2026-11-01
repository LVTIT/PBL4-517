// Regression for #63: services used to wrap every Prisma failure as 503, so a
// malformed id or a missing record told the client the service was down.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// Run in a child process so the assertion is made against the compiled module,
// not a hand-rolled copy of its logic.
function translate(expression) {
  const script = `
    import { translatePrismaError } from './dist/lib/data-errors.js';
    import { Prisma } from './dist/generated/prisma/client.js';
    const error = ${expression};
    const mapped = translatePrismaError(error);
    console.log(JSON.stringify({ status: mapped.status, code: mapped.code }));
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    windowsHide: true, encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgresql://test@127.0.0.1/lab',
      SESSION_SECRET: 'synthetic_error_map_test_517_only', DOTENV_CONFIG_PATH: '__no_config_test_env__' },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const known = (code) => `new Prisma.PrismaClientKnownRequestError('probe', { code: '${code}', clientVersion: 'test' })`;

test('known Prisma failures map to the status the caller deserves', () => {
  // Malformed UUID in a where clause.
  assert.deepEqual(translate(known('P2007')), { status: 400, code: 'INVALID_ID' });
  assert.deepEqual(translate(known('P2023')), { status: 400, code: 'INVALID_ID' });
  // Record required by the statement does not exist.
  for (const code of ['P2001', 'P2015', 'P2018', 'P2025']) {
    assert.deepEqual(translate(known(code)), { status: 404, code: 'NOT_FOUND' });
  }
  // Referenced by another row, or duplicate key.
  assert.deepEqual(translate(known('P2003')), { status: 409, code: 'CONFLICT' });
  assert.deepEqual(translate(known('P2002')), { status: 409, code: 'CONFLICT' });
  // Rejected by a database CHECK or length constraint.
  assert.deepEqual(translate(known('P2000')), { status: 400, code: 'INVALID_INPUT' });
  assert.deepEqual(translate(known('P2004')), { status: 400, code: 'INVALID_INPUT' });
});

test('genuine infrastructure failures still report 503', () => {
  assert.deepEqual(translate("new Error('connect ECONNREFUSED')"), { status: 503, code: 'DATABASE_UNAVAILABLE' });
  // An unmapped Prisma code must not be guessed into a 4xx.
  assert.deepEqual(translate(known('P2034')), { status: 503, code: 'DATABASE_UNAVAILABLE' });
});

test('an AppError passes through unchanged', () => {
  assert.deepEqual(
    translate("new (await import('./dist/lib/errors.js')).AppError(403, 'FORBIDDEN', 'probe')"),
    { status: 403, code: 'FORBIDDEN' },
  );
});
