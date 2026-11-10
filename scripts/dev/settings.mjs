import { createRequire } from 'node:module';
import { readFile, writeFile, access, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const backend = path.join(root, 'website/backend');
export const privateDir = path.join(root, '.local/private');
export const appFile = path.join(backend, '.env');
export const fixture = path.join(privateDir, 'lab-fixtures.json');
export const databaseName = 'kevilo_local_lab';
export const roleName = 'kevilo_local_lab_app';
const require = createRequire(path.join(backend, 'package.json'));
export const { Client } = require('pg');
export const { parse } = require('dotenv');
export const exists = file => access(file).then(() => true, () => false);
export const random = () => randomBytes(32).toString('hex');
export const readSettings = async file => parse(await readFile(file));

export function assertLocal(url, expectedName) {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
    || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)
    || (expectedName && parsed.pathname !== '/' + expectedName)) throw new Error('LOCAL_DATABASE_REQUIRED');
  return parsed;
}

export function appEnvironment(settings, mode = 'secure') {
  assertLocal(settings.DATABASE_URL, databaseName);
  const env = { ...process.env, ...settings, NODE_ENV: 'development', APP_PROFILE: 'lab',
    LAB_DATA_ACK: 'synthetic-only', TRUST_PROXY: '0' };
  for (const flag of ['IDOR', 'SQLI', 'XSS', 'AUTH']) env[`VULN_${flag}_ENABLED`] = 'false';
  if (mode !== 'secure') {
    if (!['idor', 'sqli', 'xss', 'auth'].includes(mode)) throw new Error('INVALID_MODE');
    env[`VULN_${mode.toUpperCase()}_ENABLED`] = 'true';
  }
  return env;
}

export async function backupFile(file, directory) {
  if (await exists(file)) {
    await mkdir(directory, { recursive: true });
    await copyFile(file, path.join(directory, path.basename(file)));
  }
}

export async function writeSettings(file, updates) {
  let text = await exists(file) ? await readFile(file, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    text = pattern.test(text) ? text.replace(pattern, () => line) : text.trimEnd() + '\n' + line + '\n';
  }
  await writeFile(file, text, { mode: 0o600 });
}
