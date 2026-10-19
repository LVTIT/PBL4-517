#!/usr/bin/env bash
set -Eeuo pipefail
ulimit -c 0
umask 077
app=/var/www/pbl4-517
stage=/home/ubuntu/kevilo-phone-build.cIOlYy
release=601c2374d3b2ca4b88e00cd33fcd925ee3fde5da
previous=524c878c00570df76a1765f0d774361f18de021f
manifest=f3eedff0da4caaae54c367c75395af8af7c71f98c2d35d2a98ad872e24a5a2f3
test "$(id -un)" = ubuntu
test "$(realpath "$app")" = "$app"
test "$(realpath "$stage")" = "$stage"
test "$(git -C "$app" rev-parse HEAD)" = "$previous"
git -C "$app" diff --quiet HEAD -- website
test "$(cat "$stage/release-sha.txt")" = "$release"
test "$(sha256sum "$stage/build-checksums.sha256" | cut -d ' ' -f1)" = "$manifest"
(cd "$stage" && sha256sum --check --quiet build-checksums.sha256)
git -C "$app" diff --exit-code "$previous" "$release" -- website/backend/prisma/schema.prisma website/backend/prisma/migrations website/backend/package.json website/frontend/package.json
test -d "$stage/website/backend/node_modules"
test -f "$stage/website/backend/dist/server.js"
test -f "$stage/website/frontend/dist/index.html"
test "$(stat -c %a "$stage/website/frontend/dist")" = 755
test "$(stat -c %d "$app")" = "$(stat -c %d "$stage")"
env_before=$(sha256sum "$app/website/backend/.env" | cut -d ' ' -f1)
env_permissions=$(stat -c '%a:%U:%G' "$app/website/backend/.env")
python3 - "$app/website/backend/.env" <<'PY'
import pathlib, re, sys
text = pathlib.Path(sys.argv[1]).read_text()
values = re.findall(r'^\s*VULN_IDOR_ENABLED\s*=\s*([^\r\n#]*)', text, re.M)
assert len(values) == 1 and values[0].strip().strip('"\x27') == 'true', 'Expected existing IDOR demo flag true; no environment changes permitted.'
print('Confirmed existing IDOR demo flag true; environment will be preserved.')
PY
install -d -m 700 /home/ubuntu/.local/state/pbl4-517
backup=$(mktemp -d /home/ubuntu/.local/state/pbl4-517/checkout-phone-601c237.XXXXXX)
printf '%s\n' "$previous" > "$backup/previous-sha.txt"
printf '%s\n' "$release" > "$backup/release-sha.txt"
cp -a "$app/website/backend/.env" "$backup/backend.env"
cp -a "$app/website/frontend/dist" "$backup/frontend-dist"
cp "$stage/build-checksums.sha256" "$backup/release-build-checksums.sha256"
printf 'Backup: %s\n' "$backup"
mutating=0
rollback() {
  local failure=${1:-1}
  trap - ERR HUP INT TERM
  set +e
  if test "$mutating" = 1; then
    sudo systemctl stop pbl4-backend
    if test -d "$backup/backend-node_modules"; then
      if test -d "$app/website/backend/node_modules"; then
        mv "$app/website/backend/node_modules" "$backup/failed-new-node_modules"
      fi
      mv "$backup/backend-node_modules" "$app/website/backend/node_modules"
    fi
    if test -d "$backup/backend-dist"; then
      if test -d "$app/website/backend/dist"; then
        mv "$app/website/backend/dist" "$backup/failed-new-backend-dist"
      fi
      mv "$backup/backend-dist" "$app/website/backend/dist"
    fi
    git -C "$app" checkout --detach "$previous"
    cp -a "$backup/frontend-dist/." "$app/website/frontend/dist/"
    sudo systemctl start pbl4-backend
    printf 'ROLLBACK attempted to %s; backup: %s\n' "$previous" "$backup" >&2
    systemctl is-active pbl4-backend
  fi
  exit "$failure"
}
trap 'rollback $?' ERR
trap 'rollback 129' HUP
trap 'rollback 130' INT
trap 'rollback 143' TERM
mutating=1
sudo systemctl stop pbl4-backend
git -C "$app" checkout --detach "$release"
mv "$app/website/backend/node_modules" "$backup/backend-node_modules"
mv "$stage/website/backend/node_modules" "$app/website/backend/node_modules"
mv "$app/website/backend/dist" "$backup/backend-dist"
mv "$stage/website/backend/dist" "$app/website/backend/dist"
# Copy assets first and retain previous hashed assets for already-open tabs.
tar -C "$stage/website/frontend/dist" --exclude=./index.html -cf - . | tar -C "$app/website/frontend/dist" -xpf -
find "$app/website/frontend/dist" -type d -exec chmod 755 {} +
find "$app/website/frontend/dist" -type f -exec chmod 644 {} +
sudo -u www-data test -x "$app/website/frontend/dist"
sudo -u www-data test -r "$app/website/frontend/dist/assets/index-Bz4bs9lI.js"
sudo systemctl start pbl4-backend
ready=0
for attempt in $(seq 1 20); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3000/api/health > "$backup/postflight-health.json"; then
    ready=1
    break
  fi
  sleep 1
done
test "$ready" = 1
install -m 644 "$stage/website/frontend/dist/index.html" "$app/website/frontend/dist/index.html.checkout-phone-next"
mv -T "$app/website/frontend/dist/index.html.checkout-phone-next" "$app/website/frontend/dist/index.html"
(cd "$app" && sha256sum --check --quiet "$backup/release-build-checksums.sha256")
test "$(sha256sum "$app/website/backend/.env" | cut -d ' ' -f1)" = "$env_before"
test "$(stat -c '%a:%U:%G' "$app/website/backend/.env")" = "$env_permissions"
systemctl is-active pbl4-backend
systemctl is-enabled pbl4-backend
curl --fail --silent --show-error --max-time 15 https://13.251.128.130/api/health
printf '\n'
curl --fail --silent --show-error --max-time 15 https://13.251.128.130/ > "$backup/public-index.html"
cmp "$app/website/frontend/dist/index.html" "$backup/public-index.html"
git -C "$app" diff --quiet HEAD -- website
test "$(git -C "$app" rev-parse HEAD)" = "$release"
trap - ERR HUP INT TERM
printf 'ACTIVATED: %s\n' "$release"
printf 'ENV_UNCHANGED: yes; VULN_IDOR_ENABLED=true retained\n'
printf 'BUILD_MANIFEST: %s\n' "$manifest"
printf 'BACKUP: %s\n' "$backup"
date --iso-8601=seconds
