#!/usr/bin/env bash
# Run from website/backend, on an isolated Linux CI runner only.
set -Eeuo pipefail
test "${VULN_IDOR_ENABLED:?}" = false
test "${NODE_ENV:?}" = development
log_dir="$(mktemp -d)"
backend_pid=''
cleanup() {
  result=$?
  trap - EXIT
  if [[ -n "$backend_pid" ]]; then
    kill -- -"$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
  if (( result != 0 )); then
    echo 'Backend failed: sanitized startup/runtime log follows.'
    python ../../scripts/ci/sanitize_log.py "$log_dir/backend.log"
  fi
  if [[ -f "$log_dir/tests.log" ]]; then
    python ../../scripts/ci/sanitize_log.py "$log_dir/tests.log"
  fi
  rm -rf -- "$log_dir"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Separate process group lets cleanup stop npm and its Node child.
setsid npm start >"$log_dir/backend.log" 2>&1 &
backend_pid=$!
healthy=false
for ((attempt=1; attempt<=30; attempt++)); do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    echo 'Backend exited before becoming healthy.'
    exit 1
  fi
  if curl --fail --silent --max-time 2 http://127.0.0.1:3000/api/health > /dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
if [[ "$healthy" != true ]]; then
  echo 'Backend health deadline exceeded.'
  exit 1
fi
echo 'Backend /api/health PASS; running real PostgreSQL integration tests.'
timeout 180s npm run test:integration >"$log_dir/tests.log" 2>&1
