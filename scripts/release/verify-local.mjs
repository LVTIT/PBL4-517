// Verify artifacts at the actual service/static directory after copying a release.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const [dist, revision] = process.argv.slice(2);
try {
  assert.ok(dist && /^[a-f0-9]{40}$/.test(revision));
  const manifest = JSON.parse(readFileSync(path.join(dist, 'release.json'), 'utf8'));
  assert.equal(manifest.revision, revision);
  assert.equal(manifest.dirty, false);
  assert.ok(Object.keys(manifest.files).length > 0);
  for (const [name, hash] of Object.entries(manifest.files)) {
    assert.ok(!path.isAbsolute(name) && !name.includes('\\') && name.split('/').every(part => part && part !== '.' && part !== '..'));
    assert.equal(createHash('sha256').update(readFileSync(path.join(dist, name))).digest('hex'), hash, `Artifact mismatch: ${name}`);
  }
  console.log(JSON.stringify({ result: 'ARTIFACTS_VERIFIED', component: manifest.component, revision }));
} catch { console.error('Artifact verification failed. Usage: node scripts/release/verify-local.mjs DIST_DIRECTORY EXPECTED_40_CHAR_SHA'); process.exitCode = 1; }
