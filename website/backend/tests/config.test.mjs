import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const flags = ['VULN_IDOR_ENABLED', 'VULN_SQLI_ENABLED', 'VULN_XSS_ENABLED', 'VULN_AUTH_ENABLED'];
function check(overrides) {
  return spawnSync(process.execPath, ['-e', "import('./dist/lib/config.js')"], {
    windowsHide: true, encoding: 'utf8', env: { ...process.env,
      DATABASE_URL: 'postgresql://test@127.0.0.1/lab', SESSION_SECRET: 'synthetic_config_test_secret_517_only',
      DOTENV_CONFIG_PATH: '__no_config_test_env__', APP_PROFILE: 'production', LAB_DATA_ACK: '',
      ...Object.fromEntries(flags.map(flag => [flag, 'false'])), ...overrides },
  });
}
test('secure profile is default and refuses every flag in every Node runtime', () => {
  for (const NODE_ENV of ['production', 'development', 'test']) {
    assert.equal(check({ NODE_ENV, APP_PROFILE: undefined }).status, 0);
    for (const flag of flags) assert.notEqual(check({ NODE_ENV, APP_PROFILE: undefined, [flag]: 'true' }).status, 0);
  }
});
test('explicit lab acknowledgment permits flags with production runtime', () => {
  for (const flag of flags) {
    assert.equal(check({ NODE_ENV: 'production', APP_PROFILE: 'lab', LAB_DATA_ACK: 'synthetic-only', [flag]: 'true' }).status, 0);
    assert.notEqual(check({ APP_PROFILE: 'lab', [flag]: 'true' }).status, 0);
  }
  assert.notEqual(check({ APP_PROFILE: 'typo' }).status, 0);
  assert.notEqual(check({ VULN_IDOR_ENABLED: 'TRUE' }).status, 0);
});
