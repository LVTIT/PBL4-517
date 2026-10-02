# Issue #15 — systemd service verification

**2026-10-02: installed by human; lifecycle, reboot/autostart, journal and HTTPS verified.**
The exact approved unit is active/enabled; backend and PostgreSQL remain loopback-only.
See [lifecycle results](../../evidence/LINUX-02/05-lifecycle-results.txt) and
[external HTTPS](../../evidence/LINUX-02/06-external-https.txt).
[Approved checkpoint B reboot/autostart](../../evidence/LINUX-02/07-reboot.txt) and
[post-reboot external HTTPS](../../evidence/LINUX-02/08-post-reboot-https.txt) also passed.

Historical checkpoint A: approved by human on 2026-09-27. The execution tool rejected the install/start command before execution with
`blocked by policy` and provided no more specific reason. Read-only SSH afterward
confirmed `LoadState=not-found`, no port 3000 listener and clean EC2 source.
That restriction preceded the successful human installation on 2026-10-02.
Refs #15. [Evidence](../../evidence/LINUX-02/README.md).
Application setup/production command remains canonical in
[website README](../../website/README.md#production-start-ec2-linux).

## Verified inputs, 2026-09-27

| Input | Actual value |
| --- | --- |
| Branch | `feature/15-linux-service` |
| BASELINE_MAIN_SHA | `70253f958c6d76a65ac579133fa68b59a75a45fc` |
| EC2_SOURCE_SHA | `e0f783b619def8c7123ec417239e32866ff72ee7` |
| EC2 host / SSH user | `47.129.214.70` / `ubuntu` |
| Node executable | `/usr/bin/node`, v24.21.0 |
| Service user/group | `ubuntu:ubuntu`, verified deployment owner |
| WorkingDirectory | `/var/www/pbl4-517/website/backend` |
| EnvironmentFile | `/var/www/pbl4-517/website/backend/.env`, `0600 ubuntu:ubuntu` |
| ExecStart | `/usr/bin/node /var/www/pbl4-517/website/backend/dist/server.js` |
| Service | `pbl4-backend.service`, absent at preflight; active/enabled verified 2026-10-02 |

Both main and deployed SHA have successful push CI. Keep the clean, already
deployed SHA: the difference to latest main is documentation/evidence only,
with no backend/frontend application or CI changes. No checkout, dependency
update, rebuild, migration or seed is needed for this service task.

The exact proposed unit is [pbl4-backend.service](pbl4-backend.service).
`systemd-analyze verify` passed on EC2 using a temporary copy of this exact
file; the temporary copy was removed and no unit installed.
The controlled foreground command passed loopback and Nginx HTTPS health
(database connected), plus external Windows HTTPS root/health. It was stopped
gracefully with SIGINT; port 3000 disappeared. This is preflight evidence,
not a claim that systemd or reboot verification has passed.

## Proposed actions and security impact

After checkpoint A approval, install that exact unit as root-owned `0644` at
`/etc/systemd/system/pbl4-backend.service`, reload systemd, start and verify
health/listeners. Enable only after successful start. Test stop/start/restart,
status and sanitized journal output. `Restart=on-failure` waits five seconds;
SIGTERM uses the application's existing graceful shutdown (10-second deadline),
with systemd allowing 15 seconds. No deliberate crash test is proposed.

The Node process runs as the existing `ubuntu` deployment user, not root.
This account also owns source and has administrative group membership; it is
not a dedicated isolated service account. No additional untested hardening
directives are included. The unit contains paths only, not credentials.
Existing `.env` stays private; do not print `systemctl show -p Environment`,
process environments, cookies or raw sensitive logs into evidence.

Backend remains `127.0.0.1:3000`, PostgreSQL `127.0.0.1:5432`; no SG, Nginx,
TLS, DB, application source or environment changes. Enabling the service makes
the existing API available persistently through Nginx. Stop/restart tests cause
brief API downtime (502 while stopped). Frontend static files remain served.

System paths/state that change:

- `/etc/systemd/system/pbl4-backend.service`: new unit, root:root 0644.
- `/etc/systemd/system/multi-user.target.wants/pbl4-backend.service`: enable symlink.
- systemd runtime state and its existing journal storage: service lifecycle/logs.

Reboot requires separate checkpoint B after active/enabled/health verification,
with current public IP, downtime and SSH reconnect plan presented to human.
No Elastic IP assumption; do not use EC2 stop/start. If the public IP changes,
stop and review certificate/Nginx implications with human.

## Rollback

Run on EC2 only if rollback is needed:

```sh
sudo systemctl stop pbl4-backend
sudo systemctl disable pbl4-backend
# Remove only the new unit after confirming this exact path:
sudo rm -- /etc/systemd/system/pbl4-backend.service
sudo systemctl daemon-reload
sudo systemctl reset-failed pbl4-backend 2>/dev/null || true
```

This returns to the previous stopped-backend state (API 502, static HTTPS
available). Preserve production DB, `.env`, source/build, certificates and
Nginx configuration. A temporary foreground fallback requires human approval.

## Manual installation after the execution restriction

The human completed this installation on 2026-10-02. These commands are retained
for the original absent-service state; do not rerun them against the installed service.
From PowerShell at the repository root, first confirm the upload destination is
absent. Stop if the first command fails; do not overwrite an existing file.

```powershell
ssh -i C:\Users\admin\pbl4-517-key.pem -o StrictHostKeyChecking=yes ubuntu@47.129.214.70 'test ! -e /home/ubuntu/pbl4-backend.service'
scp -i C:\Users\admin\pbl4-517-key.pem -o StrictHostKeyChecking=yes .\docs\aws\pbl4-backend.service ubuntu@47.129.214.70:/home/ubuntu/pbl4-backend.service
ssh -i C:\Users\admin\pbl4-517-key.pem -o StrictHostKeyChecking=yes ubuntu@47.129.214.70
```

In that EC2 SSH session, run the following guarded block. It preserves the
approved deployed SHA and stops the new service if startup health does not pass.
It enables only after direct and trusted HTTPS health pass. It does not reboot.

```bash
(
set -eu
cd /var/www/pbl4-517
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = e0f783b619def8c7123ec417239e32866ff72ee7
test "$(command -v node)" = /usr/bin/node
test "$(stat -c '%a %U %G' website/backend/.env)" = '600 ubuntu ubuntu'
test "$(systemctl show pbl4-backend -p LoadState --value)" = not-found
test ! -e /etc/systemd/system/pbl4-backend.service
test -z "$(ss -H -lnt 'sport = :3000')"
systemd-analyze verify /home/ubuntu/pbl4-backend.service
sudo install -o root -g root -m 0644 /home/ubuntu/pbl4-backend.service /etc/systemd/system/pbl4-backend.service
cmp /home/ubuntu/pbl4-backend.service /etc/systemd/system/pbl4-backend.service
sudo systemctl daemon-reload
sudo systemctl cat pbl4-backend --no-pager
trap 'sudo systemctl stop pbl4-backend' ERR
sudo systemctl start pbl4-backend
ready=0
for attempt in $(seq 1 20); do
  if curl --max-time 2 -fsS http://127.0.0.1:3000/api/health 2>/dev/null; then ready=1; break; fi
  sleep 1
done
test "$ready" = 1
curl --max-time 10 -fsS https://47.129.214.70/api/health
sudo systemctl enable pbl4-backend
trap - ERR
systemctl status pbl4-backend --no-pager --lines=0
systemctl is-enabled pbl4-backend
sudo ss -lntp 'sport = :3000'
)
```

If any check fails, stop and inspect the result. Do not rerun blindly or print
`.env`/process environments. Report completion so live verification, lifecycle
and journal evidence can continue; checkpoint B remains required before reboot.

## Lifecycle verification, 2026-10-02

The user authorized the agent to perform the lifecycle checks after installing
the service. [Executed commands](../../evidence/LINUX-02/05-lifecycle-commands.sh)
and [output](../../evidence/LINUX-02/05-lifecycle-results.txt) cover stop/start/restart,
status, enable state, journal, exact unit hash/permissions and loopback listeners.
Stopping exited successfully and removed port 3000; static HTTPS stayed 200 and
health became 502 as expected. Start/restart produced new PIDs and restored health
with database connected. Journal has lifecycle messages and zero priority err-or-higher
entries during this test window. External Windows HTTPS root/health/products all
returned 200 after the tests. Service was left active/enabled; source SHA unchanged.
Crash recovery was not deliberately tested; Restart=on-failure is configuration only.

## Checkpoint B — approved and verified 2026-10-02

The human explicitly approved checkpoint B in chat. The executed plan was to
recheck active/enabled services and health, record boot ID and
current public IP (`47.129.214.70` at this verification), then run
`sudo systemctl reboot` once. Expect temporary loss of SSH, frontend and API;
allow up to five minutes for reconnect before investigating. Reconnect with the
existing key and strict known-host verification; do not bypass host-key checks.
Verify changed boot ID, automatic backend startup without a manual start,
Nginx/PostgreSQL/backend active, enabled state, loopback listeners, boot journal
and external trusted HTTPS root/health/products. If SSH does not return, inspect
EC2 status through the human operator; do not substitute EC2 stop/start. If IP
changes, stop and review Nginx/certificate implications before configuration changes.

One `sudo -n systemctl reboot` was issued after preflight at 08:15:44 UTC
(15:15:44 Asia/Bangkok). SSH returned with strict host-key verification at
08:16:42 UTC. Boot ID changed; backend automatically started at 08:16:10 UTC
and logged listening at 08:16:13 UTC, without a manual start/restart. Backend,
Nginx and PostgreSQL were active/enabled; IP remained `47.129.214.70`, listeners
remained loopback, source/unit unchanged, backend boot journal error count zero.
External Windows HTTPS root/health/products all returned 200 at 08:17:55 UTC.
This verifies one reboot; it is not a long-term availability or crash-recovery test.

## Remaining acceptance

Runtime acceptance for #15 is verified, including the human-approved reboot.
Feature PR CI and required human review remain delivery gates. #16/#17 stay separate.
All five required CI checks
must pass on the latest revision before READY FOR HUMAN REVIEW.
Agent does not merge or close #15.
