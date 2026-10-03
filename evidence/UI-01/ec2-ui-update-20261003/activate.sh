set -Eeuo pipefail
umask 077
live=/var/www/pbl4-517
sha=524c878c00570df76a1765f0d774361f18de021f
release="$live/.local/releases/$sha"
state="$live/.local/ui51-update-$sha"
backup="/home/ubuntu/.local/state/pbl4-517/ui51-update-$sha"
test "$(cat "$state/built-sha")" = "$sha"
previous=$(cat "$state/previous-sha")
test "$(git -C "$live" rev-parse HEAD)" = "$previous"
test -z "$(git -C "$live" status --porcelain)"
test ! -e "$backup"
cd "$release"
sha256sum -c "$state/build-manifest.txt" > /dev/null
cd "$live"
sha256sum -c "$state/env.sha256"
mkdir -p "$backup"
chmod 700 "$backup"
cp "$state/previous-sha" "$state/env.sha256" "$state/build-manifest.txt" "$backup/"
tar -czf "$backup/app-before.tgz" website/backend/dist website/frontend/dist website/backend/.env website/backend/package.json website/backend/package-lock.json
tar -tzf "$backup/app-before.tgz" > /dev/null
# Retain old hashed assets so already-open browser tabs can load their chunks.
cp -an website/frontend/dist/assets/. "$release/website/frontend/dist/assets/"
rollback() {
  result=$?
  trap - ERR
  set +e
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
  git -C "$live" checkout --detach "$previous"
  sudo -n systemctl restart pbl4-backend
  printf 'ROLLBACK_ATTEMPTED previous=%s backup=%s\n' "$previous" "$backup"
  exit "$result"
}
trap rollback ERR
sudo -n systemctl stop pbl4-backend
git -C "$live" checkout --detach "$sha"
for part in backend/dist backend/node_modules frontend/dist; do
  saved="$backup/previous/$part"
  mkdir -p "$(dirname "$saved")"
  mv "$live/website/$part" "$saved"
  mv "$release/website/$part" "$live/website/$part"
done
sha256sum -c "$state/env.sha256"
sha256sum -c "$state/build-manifest.txt" > "$backup/live-build-integrity.txt"
sudo -n systemctl restart pbl4-backend
healthy=false
for attempt in $(seq 1 25); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3000/api/health; then healthy=true; break; fi
  sleep 1
done
test "$healthy" = true
curl --fail --silent --show-error --max-time 15 https://47.129.214.70/api/health
curl --fail --silent --show-error --max-time 15 https://47.129.214.70/ > "$backup/live-index.html"
cmp website/frontend/dist/index.html "$backup/live-index.html"
systemctl is-active pbl4-backend nginx postgresql
systemctl is-enabled pbl4-backend
test -z "$(git status --porcelain)"
trap - ERR
printf '\nDEPLOYED_SHA=%s\nBACKUP=%s\n' "$sha" "$backup"
