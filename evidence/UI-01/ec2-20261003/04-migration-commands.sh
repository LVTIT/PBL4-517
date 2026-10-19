set -Eeuo pipefail
umask 077
live=/var/www/pbl4-517
release_sha=0cfed004b92168a2fb92c9b91d3fac78f8bc31e3
release="$live/.local/releases/$release_sha"
backup=/home/ubuntu/.local/state/pbl4-517/ui51-0cfed00-20261003
test "$(cat "$live/.local/ui51-built-sha")" = "$release_sha"
test "$(git -C "$live" rev-parse HEAD)" = e0f783b619def8c7123ec417239e32866ff72ee7
test -z "$(git -C "$live" status --porcelain)"
test ! -e "$backup"
mkdir -p "$backup"
chmod 700 "$backup"
git -C "$live" rev-parse HEAD > "$backup/previous-sha"
sha256sum "$live/website/backend/.env" > "$backup/env.sha256"
tar -C "$live" -czf "$backup/app-before.tgz" website/backend/dist website/frontend/dist website/backend/.env
sudo -n -u postgres pg_dump -Fc pbl517_prod > "$backup/database-before.dump"
test -s "$backup/database-before.dump"
sudo -n -u postgres pg_restore --list < "$backup/database-before.dump" > "$backup/database-contents.txt"
test -s "$backup/database-contents.txt"
cd "$release/website/backend"
node --input-type=module <<'JS'
import 'dotenv/config';
import fs from 'node:fs';
import pg from 'pg';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const snapshot = {};
for (const table of ['User', 'Order', 'OrderItem', 'Review']) {
  snapshot[table] = Number((await db.query(`SELECT count(*) FROM "${table}"`)).rows[0].count);
}
snapshot.products = (await db.query('SELECT id, stock FROM "Product" ORDER BY id')).rows;
fs.writeFileSync('/home/ubuntu/.local/state/pbl4-517/ui51-0cfed00-20261003/data-before.json', JSON.stringify(snapshot), { mode: 0o600 });
console.log('Snapshot:', JSON.stringify(snapshot));
await db.end();
JS
npm run prisma:migrate
npm run catalog:import
printf 'BACKUP=%s\n' "$backup"
printf 'MIGRATION_AND_DRY_RUN_COMPLETE\n'
