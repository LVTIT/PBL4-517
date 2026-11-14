import { createRequire } from 'node:module';
const require = createRequire(new URL('../../website/backend/package.json', import.meta.url));
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await db.connect();
  const result = await db.query('SHOW server_version_num');
  if (Math.floor(Number(result.rows[0].server_version_num) / 10000) !== 16) throw new Error();
  console.log('PostgreSQL 16 connection verified.');
} catch {
  console.error('PostgreSQL 16 unavailable. Check the database host/port in backend .env and start the configured service/container.');
  process.exitCode = 1;
} finally { await db.end(); }
