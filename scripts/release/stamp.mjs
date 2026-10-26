// Build-time provenance, never taken from mutable runtime environment variables.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const component = process.argv[2];
if (!['backend', 'frontend'].includes(component)) throw new Error('Expected backend or frontend');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const dist = path.join(root, 'website', component, 'dist');
const files = {};
function walk(dir, prefix = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) walk(path.join(dir, entry.name), relative + '/');
    else if (relative !== 'release.json') files[relative] = createHash('sha256').update(readFileSync(path.join(dir, entry.name))).digest('hex');
  }
}
walk(dist);
const release = { component, revision: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain').length > 0, files };
writeFileSync(path.join(dist, 'release.json'), JSON.stringify(release, null, 2) + '\n');
console.log(`${component}: ${release.revision}${release.dirty ? ' (dirty: not deployable)' : ''}`);
