// Provision one synthetic local database; compare a legacy copy before switching.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, copyFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root, backend, privateDir, appFile, fixture, databaseName, roleName,
  Client, exists, random, readSettings, assertLocal, appEnvironment, backupFile, writeSettings } from './settings.mjs';

const databaseFile = path.join(privateDir, 'database.env');
const bindingFile = path.join(privateDir, 'local-database.json');
const backup = path.join(privateDir, 'backup-' + new Date().toISOString().replace(/[:.]/g, '-'));
const docker = args => execFileSync('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
const run = (command, args, env) => execFileSync(command, args, { cwd: backend, env, stdio: 'inherit' });
const npm = (command, env) => process.platform === 'win32'
  ? run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${command}`], env)
  : run('npm', ['run', command], env);
const quote = name => '"' + name.replaceAll('"', '""') + '"';

async function digest(client) {
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const result = {};
  for (const { tablename } of tables.rows) {
    const rows = await client.query(`SELECT row_to_json(t)::text AS value FROM public.${quote(tablename)} t`);
    result[tablename] = createHash('sha256').update(rows.rows.map(r => r.value).sort().join('\n')).digest('hex');
  }
  return JSON.stringify(result);
}

try {
  await mkdir(privateDir, { recursive: true });
  const previous = await exists(appFile) ? await readSettings(appFile) : null;
  let source;
  if (previous) {
    source = assertLocal(previous.DATABASE_URL);
    if (!['/' + databaseName, '/kevilo_local'].includes(source.pathname)) throw new Error('UNMANAGED_DATABASE');
  }
  if (!(await exists(databaseFile))) {
    if (previous) throw new Error('EXISTING_SETTINGS_WITHOUT_ADMIN');
    await writeFile(databaseFile, `POSTGRES_USER=pbl517_admin\nPOSTGRES_PASSWORD=${random()}\nLOCAL_DB_PORT=55432\n`, { flag: 'wx', mode: 0o600 });
  }
  const database = await readSettings(databaseFile);
  const port = Number(database.LOCAL_DB_PORT || 55432);
  if (source && Number(source.port || 5432) !== port) throw new Error('DIFFERENT_DATABASE_SERVER');
  docker(['volume', 'create', database.LOCAL_DB_VOLUME || 'pbl517-local-data']);
  execFileSync('docker', ['compose', '--env-file', databaseFile, '-f', path.join(root, 'compose.yaml'), 'up', '-d', '--wait', 'db'], { stdio: 'inherit' });
  const adminOptions = { host: '127.0.0.1', port, user: database.POSTGRES_USER,
    password: database.POSTGRES_PASSWORD, database: 'postgres', connectionTimeoutMillis: 5000 };
  const admin = new Client(adminOptions);
  let settings = previous;
  try {
    await admin.connect();
    if (!source || source.pathname !== '/' + databaseName) {
      if (await exists(bindingFile)) {
        settings = JSON.parse(await readFile(bindingFile, 'utf8'));
      } else {
        const taken = await admin.query('SELECT datname FROM pg_database WHERE datname=$1 UNION ALL SELECT rolname FROM pg_roles WHERE rolname=$2', [databaseName, roleName]);
        if (taken.rowCount) throw new Error('DATABASE_NAME_TAKEN');
        settings = { DATABASE_URL: `postgresql://${roleName}:${random()}@127.0.0.1:${port}/${databaseName}?schema=public`,
          SESSION_SECRET: previous?.SESSION_SECRET || random(), PORT: previous?.PORT || '3000' };
        await writeFile(bindingFile, JSON.stringify(settings) + '\n', { flag: 'wx', mode: 0o600 });
      }
      const url = assertLocal(settings.DATABASE_URL, databaseName);
      const hasRole = await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [roleName]);
      if (!hasRole.rowCount) {
        const literal = await admin.query('SELECT quote_literal($1) AS password', [decodeURIComponent(url.password)]);
        await admin.query(`CREATE ROLE ${roleName} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${literal.rows[0].password}`);
      }
      const hasDatabase = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName]);
      if (!hasDatabase.rowCount) await admin.query(`CREATE DATABASE ${databaseName} OWNER ${roleName}`);
      await admin.query(`REVOKE ALL ON DATABASE ${databaseName} FROM PUBLIC`);
      if (source) {
        const target = new Client({ ...adminOptions, database: databaseName });
        const old = new Client({ connectionString: previous.DATABASE_URL, connectionTimeoutMillis: 5000 });
        try {
          await target.connect(); await old.connect();
          const tableCount = await target.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'");
          if (!tableCount.rows[0].n) {
            await mkdir(backup, { recursive: true });
            await backupFile(appFile, backup);
            const container = database.LOCAL_DB_CONTAINER || 'pbl517-db';
            const dump = '/tmp/pbl517-local-transfer.dump';
            docker(['exec', container, 'pg_dump', '-U', database.POSTGRES_USER, '-d', 'kevilo_local', '-Fc', '-f', dump]);
            docker(['cp', `${container}:${dump}`, path.join(backup, 'kevilo_local.dump')]);
            docker(['exec', container, 'pg_restore', '-U', database.POSTGRES_USER, '-d', databaseName, '--role=' + roleName, '--no-owner', '--no-acl', '--exit-on-error', dump]);
          }
          if (await digest(old) !== await digest(target)) throw new Error('MIGRATION_CONTENT_MISMATCH');
          console.log('Legacy website copied; every public table matches. Source and private dump retained.');
        } finally { await target.end(); await old.end(); }
      }
      await backupFile(appFile, backup);
      if (await exists(fixture)) {
        await mkdir(backup, { recursive: true });
        await rename(fixture, path.join(backup, 'legacy-lab-fixtures.json'));
      }
      await writeSettings(appFile, { ...settings, NODE_ENV: 'development', TRUST_PROXY: '0', APP_PROFILE: 'production', LAB_DATA_ACK: '',
        VULN_IDOR_ENABLED: 'false', VULN_SQLI_ENABLED: 'false', VULN_XSS_ENABLED: 'false', VULN_AUTH_ENABLED: 'false' });
    }
  } finally { await admin.end(); }
  settings = await readSettings(appFile);
  const env = appEnvironment(settings);
  npm('prisma:migrate', env);
  const app = new Client({ connectionString: settings.DATABASE_URL });
  let empty;
  try {
    await app.connect();
    const result = await app.query('SELECT (SELECT count(*) FROM "User")::int AS users, (SELECT count(*) FROM "Product")::int AS products');
    empty = result.rows[0].users === 0 && result.rows[0].products === 0;
    const role = await app.query('SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user');
    if (Object.values(role.rows[0]).some(Boolean)) throw new Error('OVERPRIVILEGED_APPLICATION_ROLE');
  } finally { await app.end(); }
  if (empty) npm('prisma:seed', env);
  else console.log('Existing accounts, catalog and orders retained; seed skipped.');
  if (!(await exists(fixture))) run(process.execPath, ['dist/scripts/lab-fixtures.js', '--output', fixture], env);
  run(process.execPath, ['dist/scripts/lab-fixtures.js', '--local-accounts', fixture], env);
  if (!(await exists(path.join(root, '.env')))) await copyFile(path.join(root, '.env.example'), path.join(root, '.env'));
  console.log('Ready: one active local database (kevilo_local_lab). Credentials stay in backend/.env; fixture in .local/private/.');
} catch (error) {
  const known = ['LOCAL_DATABASE_REQUIRED', 'UNMANAGED_DATABASE', 'EXISTING_SETTINGS_WITHOUT_ADMIN', 'DIFFERENT_DATABASE_SERVER',
    'DATABASE_NAME_TAKEN', 'MIGRATION_CONTENT_MISMATCH', 'OVERPRIVILEGED_APPLICATION_ROLE'];
  console.error(`Setup stopped (${known.includes(error.message) ? error.message : 'LOCAL_SETUP_FAILED'}). See scripts/dev/README.md; existing source data is retained.`);
  process.exitCode = 1;
}
