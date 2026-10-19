set -Eeuo pipefail
umask 077
live=/var/www/pbl4-517
release_sha=0cfed004b92168a2fb92c9b91d3fac78f8bc31e3
release="$live/.local/releases/$release_sha"
cd "$live"
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = e0f783b619def8c7123ec417239e32866ff72ee7
test ! -e "$release"
git fetch origin feature/51-kevilo-ui
git merge-base --is-ancestor "$release_sha" FETCH_HEAD
mkdir -p "$live/.local/releases"
git worktree add --detach "$release" "$release_sha"
install -m 600 "$live/website/backend/.env" "$release/website/backend/.env"
cd "$release/website/backend"
npm ci --include=dev
npm run build
test -s dist/server.js
cd "$release/website/frontend"
npm ci --include=dev
npm run build
test -s dist/index.html
# The staging directory is private; only the published static tree is public.
find dist -type d -exec chmod 755 {} +
find dist -type f -exec chmod 644 {} +
test -s dist/favicon.png
test -s dist/images/hero/hero-workspace.webp
test "$(find dist/images/products -name '*.webp' | wc -l)" -eq 10
grep -q KEVILO dist/index.html
cd "$release"
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$release_sha"
find website/backend/dist website/frontend/dist -type f -print0 | sort -z | xargs -0 sha256sum > "$live/.local/ui51-build-manifest.txt"
printf '%s\n' "$release_sha" > "$live/.local/ui51-built-sha"
printf 'RELEASE_BUILT=%s\n' "$release_sha"
systemctl is-active pbl4-backend
curl --fail --silent --show-error --max-time 15 https://47.129.214.70/api/health
