import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const backend = path.join(root, 'website/backend');
const privateDir = path.join(root, '.local/private');
const file = path.join(privateDir, 'database.env');
const appFile = path.join(backend, '.env');
const require = createRequire(path.join(backend, 'package.json'));
const { Client } = require('pg');
const { parse } = require('dotenv');
const exists = p => access(p).then(() => true, () => false);
const random = () => randomBytes(32).toString('hex');
const npm = (command, env) => process.platform === 'win32'
  ? execFileSync(process.env.ComSpec || 'cmd.exe', ['/d','/s','/c',`npm.cmd run ${command}`], { cwd: backend, env, stdio: 'inherit' })
  : execFileSync('npm', ['run',command], { cwd: backend, env, stdio: 'inherit' });
try {
  await mkdir(privateDir, { recursive: true });
  if (!(await exists(file))) await writeFile(file, `POSTGRES_USER=pbl517_admin\nPOSTGRES_PASSWORD=${random()}\nLOCAL_DB_PORT=55432\n`, { flag: 'wx', mode: 0o600 });
  const database = parse(await readFile(file));
  execFileSync('docker', ['volume','create',database.LOCAL_DB_VOLUME || 'pbl517-local-data'], { stdio: 'inherit' });
  execFileSync('docker', ['compose','--env-file',file,'-f',path.join(root,'compose.yaml'),'up','-d','--wait','db'], { stdio: 'inherit' });
  if (!(await exists(appFile))) {
    const admin = new Client({ host: '127.0.0.1', port: Number(database.LOCAL_DB_PORT || 55432), user: database.POSTGRES_USER, password: database.POSTGRES_PASSWORD, database: 'postgres' });
    const password = random();
    try {
      await admin.connect();
      const existing = await admin.query("SELECT datname FROM pg_database WHERE datname='kevilo_local' UNION ALL SELECT rolname FROM pg_roles WHERE rolname='kevilo_local_app'");
      if (existing.rowCount) throw new Error('Database exists without settings.');
      await admin.query(`CREATE ROLE kevilo_local_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${password}'`);
      await admin.query('CREATE DATABASE kevilo_local OWNER kevilo_local_app');
      await admin.query('REVOKE ALL ON DATABASE kevilo_local FROM PUBLIC');
    } finally { await admin.end(); }
    await writeFile(appFile, `DATABASE_URL=postgresql://kevilo_local_app:${password}@127.0.0.1:${database.LOCAL_DB_PORT || 55432}/kevilo_local?schema=public\nSESSION_SECRET=${random()}\nPORT=3000\nNODE_ENV=development\nAPP_PROFILE=production\nTRUST_PROXY=0\nVULN_IDOR_ENABLED=false\nVULN_SQLI_ENABLED=false\nVULN_XSS_ENABLED=false\nVULN_AUTH_ENABLED=false\n`, { flag: 'wx', mode: 0o600 });
  }
  const settings = parse(await readFile(appFile));
  const url = new URL(settings.DATABASE_URL);
  if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) || Number(url.port || 5432) !== Number(database.LOCAL_DB_PORT || 55432)) throw new Error('Existing backend settings target a different database.');
  const env = { ...process.env, ...settings, NODE_ENV: 'development', APP_PROFILE: 'production' };
  for (const flag of ['IDOR','SQLI','XSS','AUTH']) env[`VULN_${flag}_ENABLED`] = 'false';
  npm('prisma:migrate', env);
  const app = new Client({ connectionString: settings.DATABASE_URL });
  let empty;
  try { await app.connect(); const r = await app.query('SELECT (SELECT count(*) FROM "User")::int AS users, (SELECT count(*) FROM "Product")::int AS products'); empty = r.rows[0].users === 0 && r.rows[0].products === 0; } finally { await app.end(); }
  if (empty) npm('prisma:seed', env);
  else console.log('Existing app data preserved; seed skipped.');
  if (!(await exists(path.join(root,'.env')))) await copyFile(path.join(root,'.env.example'), path.join(root,'.env'));
  console.log('Local database configured. Private settings are retained between runs.');
} catch {
  console.error('Setup stopped. Check Docker Desktop, port/volume conflicts, database settings and permissions. Existing data/config is never overwritten. See scripts/dev/README.md.');
  process.exitCode = 1;
}
