set -Eeuo pipefail
umask 077
live=/var/www/pbl4-517
release_sha=0cfed004b92168a2fb92c9b91d3fac78f8bc31e3
release="$live/.local/releases/$release_sha"
backup=/home/ubuntu/.local/state/pbl4-517/ui51-0cfed00-20261003
previous_sha=e0f783b619def8c7123ec417239e32866ff72ee7
test "$(cat "$live/.local/ui51-built-sha")" = "$release_sha"
test "$(cat "$backup/previous-sha")" = "$previous_sha"
test "$(git -C "$live" rev-parse HEAD)" = "$previous_sha"
test -z "$(git -C "$live" status --porcelain)"
test -s "$backup/database-before.dump"
cd "$release"
sha256sum -c "$live/.local/ui51-build-manifest.txt" > "$backup/build-integrity.txt"
cd website/backend
npm run catalog:import -- --apply
node --input-type=module <<'JS'
import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import { DEMO_CATALOG } from './dist/data/catalog.js';
const before = JSON.parse(fs.readFileSync('/home/ubuntu/.local/state/pbl4-517/ui51-0cfed00-20261003/data-before.json', 'utf8'));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  for (const table of ['User', 'Order', 'OrderItem', 'Review']) {
    assert.equal(Number((await db.query(`SELECT count(*) FROM "${table}"`)).rows[0].count), before[table], `${table} count changed`);
  }
  const products = (await db.query('SELECT id, stock, "imageKey" FROM "Product" ORDER BY id')).rows;
  for (const original of before.products) {
    assert.equal(products.find(p => p.id === original.id)?.stock, original.stock, 'Existing stock changed');
  }
  for (const item of DEMO_CATALOG) {
    const actual = products.find(p => p.id === item.id);
    assert.equal(actual?.imageKey, item.imageKey);
    if (!before.products.some(p => p.id === item.id)) assert.equal(actual.stock, item.defaultStock);
  }
  assert.equal(products.length, new Set([...before.products.map(p => p.id), ...DEMO_CATALOG.map(p => p.id)]).size);
  console.log(`CATALOG_VERIFIED: ${DEMO_CATALOG.length} catalog items, ${products.length} total; existing stock and account/order counts preserved`);
} finally { await db.end(); }
JS
# Keep old hashed assets available for browsers with an already-open page.
cp -an "$live/website/frontend/dist/assets/." "$release/website/frontend/dist/assets/"
rollback() {
  result=$?
  trap - ERR
  set +e
  echo 'Activation failed; restoring previous code/build/dependencies. Additive migration and catalog are retained.'
  sudo -n systemctl stop pbl4-backend
  for part in backend/dist backend/node_modules frontend/dist; do
    saved="$backup/previous/$part"
    if test -d "$saved"; then
      failed="$backup/failed/$part"
      mkdir -p "$(dirname "$failed")"
      test ! -e "$live/website/$part" || mv "$live/website/$part" "$failed"
      mv "$saved" "$live/website/$part"
    fi
  done
  git -C "$live" checkout --detach "$previous_sha"
  sudo -n systemctl restart pbl4-backend
  exit "$result"
}
trap rollback ERR
sudo -n systemctl stop pbl4-backend
git -C "$live" checkout --detach "$release_sha"
for part in backend/dist backend/node_modules frontend/dist; do
  saved="$backup/previous/$part"
  test ! -e "$saved"
  mkdir -p "$(dirname "$saved")"
  mv "$live/website/$part" "$saved"
  mv "$release/website/$part" "$live/website/$part"
done
sha256sum -c "$backup/env.sha256"
sudo -n systemctl restart pbl4-backend
healthy=false
for attempt in $(seq 1 20); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3000/api/health; then healthy=true; break; fi
  sleep 1
done
test "$healthy" = true
curl --fail --silent --show-error --max-time 15 https://47.129.214.70/api/health
curl --fail --silent --show-error --max-time 15 https://47.129.214.70/ | grep -q KEVILO
systemctl is-active pbl4-backend
systemctl is-enabled pbl4-backend
test "$(git -C "$live" rev-parse HEAD)" = "$release_sha"
test -z "$(git -C "$live" status --porcelain)"
trap - ERR
printf 'DEPLOYED_SHA=%s\nBACKUP=%s\n' "$release_sha" "$backup"
