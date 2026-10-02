# LINUX-02 — Issue #15 service evidence

**Runtime verified on 2026-10-02: service lifecycle, approved reboot/autostart and external HTTPS PASS. Delivery CI and human review remain separate gates.**

## Latest verification, 2026-10-02

- Human approved checkpoint B in chat. [Reboot commands and output](07-reboot.txt):
  preflight at 08:15:44 UTC; one `sudo -n systemctl reboot`; first reconnect attempt
  timed out during reboot, strict SSH reconnect passed at 08:16:42 UTC.
  Boot ID changed from `0a347f8c-d107-452f-8bc7-03717e984512` to
  `f2097aea-cd8b-426e-8985-633aa4b82e27`.
- Backend auto-started at 08:16:10 UTC and logged listening at 08:16:13 UTC;
  no manual start/restart after reboot. Backend/Nginx/PostgreSQL active/enabled,
  IP unchanged, loopback listeners, exact source/unit unchanged, zero backend
  journal err-or-higher entries in the new boot at verification time.
- [Post-reboot external HTTPS](08-post-reboot-https.txt) at 08:17:55 UTC
  (15:17:55 Asia/Bangkok): frontend/health/products 200 with normal TLS validation.

### Before reboot: installation and lifecycle

- Human installed/started/enabled the approved unit; agent independently verified
  its exact SHA-256, root:root 0644 ownership/mode and systemd syntax.
- [Executed lifecycle commands](05-lifecycle-commands.sh),
  [actual output](05-lifecycle-results.txt): 08:06:49–08:06:52 UTC
  (15:06:49–15:06:52 Asia/Bangkok). Stop/start/restart/status PASS, new PIDs,
  graceful stop exit 0, loopback 3000/5432, active/enabled final state.
- While stopped: EC2 trusted HTTPS frontend 200, health 502; after start/restart:
  health reports database connected. Nginx and PostgreSQL remain active.
- Sanitized journal lifecycle messages captured; zero priority err-or-higher
  journal entries during the test window. This is not a full log/security audit.
- [External Windows HTTPS](06-external-https.txt) at 08:07:15 UTC:
  frontend/health/products 200, normal TLS validation, response bodies omitted.
- First invocation failed at `set -euo pipefail` because Windows text-mode stdin
  converted LF to CRLF, before any service operation; [error retained](05a-windows-newline-error.txt).
  The successful invocation sent UTF-8 LF bytes directly to SSH stdin.
- Boot ID unchanged; no reboot, crash injection, source/env/database/config changes.
  `Restart=on-failure` is configured but crash recovery has not been exercised.
  Source remains clean at `e0f783b619def8c7123ec417239e32866ff72ee7`.

## Historical preflight and installation blocker (September)

Branch: `feature/15-linux-service`.
Baseline main: `70253f958c6d76a65ac579133fa68b59a75a45fc`.
[Preflight observations](01-preflight.txt) record the clean start, remote update,
new branch and all five passing main CI jobs.

[Issue #14](https://github.com/LVTIT/PBL4-517/issues/14) is CLOSED and
[PR #32](https://github.com/LVTIT/PBL4-517/pull/32) merged, verified live on
2026-09-27. Historical deployment results remain in [WEB-04](../WEB-04/README.md).
EC2 retains clean deployed SHA `e0f783b619def8c7123ec417239e32866ff72ee7`;
Node is `/usr/bin/node`, env is `0600 ubuntu:ubuntu`, service absent.
Controlled foreground health passed locally, through Nginx HTTPS and from
Windows with normal TLS verification. SIGINT stopped it; port 3000 disappeared.
No persistent service or reboot yet. See [exact proposal and rollback](../../docs/aws/linux-service-review.md).
The exact proposed unit passed [systemd-analyze verification on EC2](02-unit-definition.txt)
using a temporary copy, removed afterward; it was not installed.

The human approved checkpoint A, but the execution tool rejected the install/start
command before execution (`blocked by policy`). [Read-only confirmation](03-install-blocked.txt)
shows the service still absent. [Manual installation instructions](../../docs/aws/linux-service-review.md#manual-installation-after-the-execution-restriction)
are ready for the human operator; approval does not need repeating.

[Direct recheck at 10:35 UTC](04-service-presence.txt) confirms SSH authentication
works, but the service is still `not-found`, port 3000 absent and journal empty.
External trusted HTTPS: frontend 200, health/products 502. Nginx/PostgreSQL active.

## Historical SSH restoration

[Recheck on 2026-09-28 at 09:02 UTC](04b-ssh-restored.txt): SSH access restored;
service and upload file absent, no port 3000 or journal entries. Nginx/PostgreSQL
active; external HTTPS frontend 200, health/products 502. Installation remains pending.

## Pending verification and delivery

- Feature PR CI on the latest revision and required human review.
- Team Leader / Repository Owner performs final merge after review and CI.

Service lifecycle and one reboot/autostart are verified as above. No Issue checklist items changed.
#16/#17 remain separate tasks; no merge or Issue closure by the agent.
