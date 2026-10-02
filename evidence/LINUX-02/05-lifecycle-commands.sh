#!/usr/bin/env bash
# Executed over SSH for Issue #15 on 2026-10-02; causes brief API downtime.
# No reboot, crash injection, configuration, application or database changes.
set -euo pipefail
started=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
date -u +%FT%TZ
cd /var/www/pbl4-517
test "$(git rev-parse HEAD)" = e0f783b619def8c7123ec417239e32866ff72ee7
test -z "$(git status --porcelain)"
test "$(sha256sum /etc/systemd/system/pbl4-backend.service | cut -d ' ' -f 1)" = a9f81fdbb5cf3d01a41e8e00a44a86c86c5e3f4103d6ee353ba15118b26af24b
test "$(stat -c '%a:%U:%G' /etc/systemd/system/pbl4-backend.service)" = 644:root:root
test "$(stat -c '%a:%U:%G' website/backend/.env)" = 600:ubuntu:ubuntu
sudo -n systemd-analyze verify /etc/systemd/system/pbl4-backend.service
systemctl is-active pbl4-backend
systemctl is-enabled pbl4-backend
echo 'Preflight: clean deployed SHA, exact unit, permissions and unit syntax PASS'
boot_before=$(cat /proc/sys/kernel/random/boot_id)
pid_before=$(systemctl show pbl4-backend -p MainPID --value)
printf 'Initial PID=%s\n' "$pid_before"
health() {
  local attempt
  for attempt in $(seq 1 20); do
    if curl --max-time 2 -fsS http://127.0.0.1:3000/api/health 2>/dev/null; then
      printf '\n'
      return 0
    fi
    sleep 1
  done
  return 1
}
https_code() {
  local path=$1 expected=$2 actual
  actual=$(curl --max-time 10 -sS -o /dev/null -w '%{http_code}' "https://47.129.214.70$path")
  printf 'EC2 trusted HTTPS %s: %s (expected %s)\n' "$path" "$actual" "$expected"
  test "$actual" = "$expected"
}
health
# Restore the initially running service if any lifecycle assertion fails.
trap 'rc=$?; trap - EXIT; if [ "$rc" -ne 0 ]; then echo "Verification failed; restoring backend"; sudo -n systemctl start pbl4-backend; fi; exit "$rc"' EXIT
sudo -n systemctl stop pbl4-backend
test "$(systemctl show pbl4-backend -p ActiveState --value)" = inactive
test "$(systemctl show pbl4-backend -p MainPID --value)" = 0
test -z "$(ss -H -lnt 'sport = :3000')"
test "$(systemctl show pbl4-backend -p ExecMainStatus --value)" = 0
test "$(systemctl show pbl4-backend -p Result --value)" = success
echo 'STOP: inactive, PID=0, port 3000 absent, exit status=0, result=success PASS'
https_code / 200
https_code /api/health 502
sudo -n systemctl start pbl4-backend
health
pid_started=$(systemctl show pbl4-backend -p MainPID --value)
test "$pid_started" -gt 0
test "$pid_started" != "$pid_before"
printf 'START: new PID=%s PASS\n' "$pid_started"
https_code /api/health 200
sudo -n systemctl restart pbl4-backend
health
pid_restarted=$(systemctl show pbl4-backend -p MainPID --value)
test "$pid_restarted" -gt 0
test "$pid_restarted" != "$pid_started"
printf 'RESTART: new PID=%s PASS\n' "$pid_restarted"
systemctl status pbl4-backend --no-pager --lines=0
systemctl is-enabled pbl4-backend
systemctl show pbl4-backend -p User -p Group -p Result -p NRestarts -p Restart -p ActiveState -p SubState
ss -lnt 'sport = :3000 or sport = :5432'
test "$(ss -H -lnt 'sport = :3000' | awk '{print $4}')" = 127.0.0.1:3000
test "$(ss -H -lnt 'sport = :5432' | awk '{print $4}')" = 127.0.0.1:5432
systemctl is-active nginx postgresql@16-main
https_code / 200
https_code /api/health 200
https_code /api/products 200
echo 'Journal: allowlisted lifecycle messages only; not a full log export'
sudo -n journalctl -u pbl4-backend --since "$started" --utc --no-pager -o short-iso \
  --grep='Backend listening on http://127\.0\.0\.1:3000|Started pbl4-backend\.service|Stopping pbl4-backend\.service|Stopped pbl4-backend\.service|pbl4-backend\.service: Deactivated successfully\.'
error_count=$(sudo -n journalctl -u pbl4-backend --since "$started" -p err --no-pager -o json | wc -l)
printf 'Journal priority err or higher entries in test window: %s\n' "$error_count"
test "$error_count" = 0
test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot_before"
test -z "$(git status --porcelain)"
echo 'LIFECYCLE PASS; boot unchanged; deployed source remains clean'
date -u +%FT%TZ
