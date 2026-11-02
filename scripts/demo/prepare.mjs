// Prepare an additive, isolated local lab. No website data is reset or seeded.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const backend = path.join(root, 'website/backend');
const privateDir = path.join(root, '.local/private');
const labFile = path.join(privateDir, 'lab.env');
const fixture = path.join(privateDir, 'lab-fixtures.json');
const require = createRequire(path.join(backend, 'package.json'));
const { Client } = require('pg');
const { parse } = require('dotenv');
const exists = async p => access(p).then(() => true, () => false);
const databaseName = 'kevilo_demo_lab';
const roleName = 'kevilo_demo_lab_app';
try {
  await access(path.join(backend, 'dist/scripts/lab-fixtures.js'));
  await mkdir(privateDir, { recursive: true });
  let settings;
  if (await exists(labFile)) {
    settings = parse(await readFile(labFile));
  } else {
    const source = { ...parse(await readFile(path.join(backend, '.env'))), ...process.env };
    const sourceUrl = new URL(source.DATABASE_URL);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(sourceUrl.hostname)) throw new Error('Local database required.');
    const adminFile = path.join(privateDir, 'database.env');
    const database = await exists(adminFile) ? parse(await readFile(adminFile)) : null;
    const admin = new Client(database ? {
      host: '127.0.0.1', port: Number(database.LOCAL_DB_PORT || 55432),
      user: database.POSTGRES_USER, password: database.POSTGRES_PASSWORD,
      database: 'postgres', connectionTimeoutMillis: 5000,
    } : { connectionString: sourceUrl.toString(), connectionTimeoutMillis: 5000 });
    const password = randomBytes(32).toString('hex');
    try {
      await admin.connect();
      const taken = await admin.query('SELECT datname FROM pg_database WHERE datname=$1 UNION ALL SELECT rolname FROM pg_roles WHERE rolname=$2', [databaseName, roleName]);
      if (taken.rowCount) throw new Error('Existing lab database/role without private settings; refusing to overwrite.');
      // Identifiers are fixed constants; password is generated hexadecimal, never user input.
      await admin.query(`CREATE ROLE ${roleName} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${password}'`);
      await admin.query(`CREATE DATABASE ${databaseName} OWNER ${roleName}`);
      await admin.query(`REVOKE ALL ON DATABASE ${databaseName} FROM PUBLIC`);
    } finally { await admin.end(); }
    sourceUrl.username = roleName; sourceUrl.password = password;
    sourceUrl.pathname = '/' + databaseName;
    settings = { DATABASE_URL: sourceUrl.toString(), SESSION_SECRET: randomBytes(48).toString('hex') };
    await writeFile(labFile, Object.entries(settings).map(([k,v]) => `${k}=${v}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  }
  const labUrl = new URL(settings.DATABASE_URL);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(labUrl.hostname) || !/(?:^|[_-])lab(?:$|[_-])/i.test(labUrl.pathname.slice(1))) throw new Error('Dedicated loopback lab database required.');
  const env = { ...process.env, ...settings, NODE_ENV: 'development', APP_PROFILE: 'lab', LAB_DATA_ACK: 'synthetic-only', PORT: '3001', TRUST_PROXY: '0' };
  for (const flag of ['IDOR','SQLI','XSS','AUTH']) env[`VULN_${flag}_ENABLED`] = 'false';
  if (process.platform === 'win32') {
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d','/s','/c','npm.cmd run prisma:migrate'], { cwd: backend, env, stdio: 'inherit' });
  } else { execFileSync('npm', ['run','prisma:migrate'], { cwd: backend, env, stdio: 'inherit' }); }
  if (!(await exists(fixture))) {
    execFileSync(process.execPath, ['dist/scripts/import-catalog.js', '--apply'], { cwd: backend, env, stdio: 'inherit' });
    execFileSync(process.execPath, ['dist/scripts/lab-fixtures.js', '--output', fixture], { cwd: backend, env, stdio: 'inherit' });
  }
  console.log('Lab ready. Private accounts/order: .local/private/lab-fixtures.json. Start via scripts/demo/run.ps1.');
} catch {
  console.error('Lab preparation failed. Verify backend build and local PostgreSQL CREATE ROLE/CREATE DATABASE permissions. Existing database/role names are never overwritten; inspect partial provisioning privately. See scripts/demo/README.md.');
  process.exitCode = 1;
}
