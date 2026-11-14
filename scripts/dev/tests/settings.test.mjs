import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLocal, appEnvironment } from '../settings.mjs';

test('launcher rejects remote/ordinary databases before enabling a lab', () => {
  for (const url of ['postgresql://user:pass@example.com/kevilo_local_lab', 'postgresql://user:pass@127.0.0.1/production', 'https://127.0.0.1/kevilo_local_lab']) {
    assert.throws(() => assertLocal(url, 'kevilo_local_lab'));
  }
});

test('one selected scenario overrides inherited flags; secure clears every flag', () => {
  const settings = { DATABASE_URL: 'postgresql://user:pass@127.0.0.1:55432/kevilo_local_lab', VULN_XSS_ENABLED: 'true' };
  for (const mode of ['idor','sqli','xss','auth','secure']) {
    const result = appEnvironment(settings, mode);
    const enabled = ['IDOR','SQLI','XSS','AUTH'].filter(flag => result[`VULN_${flag}_ENABLED`] === 'true');
    assert.deepEqual(enabled, mode === 'secure' ? [] : [mode.toUpperCase()]);
    assert.equal(result.NODE_ENV, 'development');
  }
});
