set -Eeuo pipefail
cd /var/www/pbl4-517
sha=524c878c00570df76a1765f0d774361f18de021f
test "$(git rev-parse HEAD)" = "$sha"
date -u +%Y-%m-%dT%H:%M:%SZ
git status --short --branch
systemctl show pbl4-backend -p ActiveState -p SubState -p MainPID -p NRestarts -p ExecMainStartTimestamp
systemctl is-enabled pbl4-backend
sudo -n nginx -t
sudo -n ss -lntp 'sport = :3000 or sport = :5432'
sudo -n journalctl -u pbl4-backend --since '5 minutes ago' -p err --no-pager --quiet
sha256sum -c ".local/ui51-update-$sha/env.sha256"
sha256sum -c ".local/ui51-update-$sha/build-manifest.txt" > /dev/null
stat -c '%a %U %G' website/backend/.env website/frontend/dist website/frontend/dist/index.html
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
const origin = 'https://47.129.214.70';
const health = await fetch(origin + '/api/health');
assert.equal(health.status, 200);
assert.equal((await health.json()).data.database, 'connected');
const response = await fetch(origin + '/api/products');
assert.equal(response.status, 200);
const products = (await response.json()).data;
assert.ok(products.length > 0);
assert.equal(products.some(p => p.category === 'Deployment verification' || /NOT FOR SALE|DO NOT BUY/i.test(p.name)), false);
console.log(JSON.stringify({ health: 'PASS', publicProducts: products.length, verificationItemsHidden: true }));
JS
printf 'BUILD_HASHES_AND_ENV=PASS\n'
