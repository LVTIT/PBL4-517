set -Eeuo pipefail
umask 077
live=/var/www/pbl4-517
sha=524c878c00570df76a1765f0d774361f18de021f
release="$live/.local/releases/$sha"
state="$live/.local/ui51-update-$sha"
cd "$live"
test -z "$(git status --porcelain)"
test ! -e "$state"
test ! -e "$release"
test "$(stat -c '%a %U %G' website/backend/.env)" = '600 ubuntu ubuntu'
systemctl is-active pbl4-backend nginx postgresql
sudo -n nginx -t
node --input-type=module <<'JS'
import fs from 'node:fs';
import dotenv from './website/backend/node_modules/dotenv/lib/main.js';
const env = dotenv.parse(fs.readFileSync('website/backend/.env'));
if (env.NODE_ENV !== 'production' || env.VULN_IDOR_ENABLED !== 'false' || env.TRUST_PROXY !== 'loopback') throw Error('Unexpected security configuration');
console.log('Production secure baseline: PASS');
JS
previous=$(git rev-parse HEAD)
git fetch origin feature/51-kevilo-ui
git merge-base --is-ancestor "$sha" FETCH_HEAD
# This release does not change the database schema; abort if that assumption fails.
git diff --exit-code "$previous" "$sha" -- website/backend/prisma/schema.prisma website/backend/prisma/migrations
mkdir -p "$state" "$live/.local/releases"
printf '%s\n' "$previous" > "$state/previous-sha"
sha256sum website/backend/.env > "$state/env.sha256"
git worktree add --detach "$release" "$sha"
install -m 600 website/backend/.env "$release/website/backend/.env"
cd "$release/website/backend"
npm ci --include=dev
npm run build
npm audit --audit-level=high
test -s dist/server.js
cd "$release/website/frontend"
npm ci --include=dev
npm run build
npm audit --audit-level=high
test -s dist/index.html
test -s dist/favicon.png
find dist -type d -exec chmod 755 {} +
find dist -type f -exec chmod 644 {} +
cd "$release"
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$sha"
find website/backend/dist website/frontend/dist -type f -print0 | sort -z | xargs -0 sha256sum > "$state/build-manifest.txt"
cd "$live"
sha256sum -c "$state/env.sha256"
systemctl is-active pbl4-backend
curl --fail --silent --show-error --max-time 15 https://47.129.214.70/api/health
printf '%s\n' "$sha" > "$state/built-sha"
printf '\nRELEASE_BUILT=%s\n' "$sha"
