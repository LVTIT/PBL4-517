# Monitoring safety and project regression — 2026-10-26

Refs #43. Related to #35, #36, #44, #45, #51.

Tested source: **`82abdff`**, `feature/43-monitoring-safety`, based on `00e02df`.
The evidence/documentation commit after it does not change runtime source.
This task fixes the local review findings and records the project delivery plan;
it does not complete the Ubuntu VM/AWS acceptance criteria for Issue #43.

## Changes verified

| Review finding / scenario | Change | Evidence |
| --- | --- | --- |
| Two backoff entries block later due alerts | Select due entries before the two-event limit | Scanner tests |
| Full outbox cannot recover after channel recovery | Retry pending delivery against the old baseline; only accept new state if enough capacity remains; same two-event budget | Full-queue failure/recovery tests, including new change retained in the queue |
| Audit write failure can appear successful | Propagate write/rotation failures; scanner returns exit 2 | Stream write failure and full scan exit-status tests |
| Malformed pending state can advance baseline | Validate pending channel/retry/payload fields before processing; support legacy state without an outbox | Invalid state remains byte-for-byte unchanged |
| ChatOps accepts arbitrary sender/target | Require matching chat and numeric sender allowlist, including callbacks; only allowlisted IPv4 targets; cap remote scans at 32 ports | Authorized positive control, unauthorized chat/sender/callback, invalid target/hostname/port tests |
| DNS outage during watch mode | Keep baseline and write failure audit; next valid observation recovers | DNS failure → INITIAL_SCAN, audit statuses 2 → 0 |
| Port-only result overstates security | Remove absolute-safe/fully-fixed claims; unknown ports retain LOW severity instead of being described as web-only | Unknown-port posture and remaining-database alert tests |

ChatOps is disabled until `TELEGRAM_ALLOWED_USER_IDS` is configured. This does not
disable automatic scanner alerts. Configure `SCANNER_TARGET`,
`SCANNER_ALLOWED_TARGETS` and (when sharing the scheduler state)
`SCANNER_STATE_FILE` as documented in the [scanner README](../../../scanner/README.md).

## Results and environment

Windows, Node **24.22.1**, npm **11.19.1**, Python **3.13.7**, PostgreSQL **16.15**.
Docker Desktop's daemon was unavailable and the current Windows account could
not start its service. Used official EDB portable PostgreSQL 16.15 binaries in
ignored `.local/monitoring-20261026/pg16`, a newly initialized cluster, random
loopback port and database `pbl517_security43_test`. No existing `.env`, database
or installed PostgreSQL 18 service was changed. Temporary APIs and DB were stopped.
An initially selected fixed port could not bind; OS-selected free ports succeeded.

| Check | Result |
| --- | --- |
| Fresh npm install, frontend/backend build and audit | PASS; both audits report zero vulnerabilities |
| Fresh PostgreSQL migration / seed | PASS; four committed migrations |
| API/session/RBAC/checkout regression | 17 subtests PASS (18 including parent); includes cookie replay after logout |
| Local IDOR / SQLi / stored XSS / auth lifecycle | 6 subtests PASS (7 including parent); real API/DB/browser; owner and normal-operation controls retained |
| Playwright UI | 54/54 PASS; UI fixture tests are distinct from the real API/browser security suite |
| Scanner / ChatOps | 27/27 PASS; delivery simulated; real loopback listener check |
| Python syntax / repository policy unit tests | PASS / 5/5 PASS |
| UI skill data / core tests | PASS / 39/39 PASS |
| Staged repository policy and whitespace | 385 index entries, zero violations / PASS |

[Machine-readable results and full source SHA](checks.json),
[scanner output](scanner-tests.txt), [API output](api-integration.txt),
[security lifecycle output](security-lifecycle.txt), [migration output](migrations.txt).
Build/audit/UI outcomes were observed in the task console; their full console
transcripts are not retained here. The first attempt to display sanitized Unicode
logs used a Windows cp1252 console and failed to print; UTF-8 re-display succeeded.
The underlying tests had already exited 0 and their captured files were intact.

Canonical reproduction commands: [website](../../../website/README.md),
[scanner](../../../scanner/README.md). `test:security` requires explicit
`LOCAL_SECURITY_LAB=1`, a dedicated loopback test/security/lab DB and Playwright
Chromium. Use environment overrides rather than changing a working `.env`.

## Remaining acceptance

- External Ubuntu VM install, two scheduled runs and reboot/autostart: #35/#43.
- New actual Telegram/Discord receipts and delivery recovery evidence: #36/#43.
- Current VPC/route/SG/NACL, harmless port exposure/hardening, Linux log correlation:
  #33/#41/#42. Historical EC2 evidence is not current verification.
- ALB design/cost review and any separately approved live lab: #34.
- Hosted CI on the latest PR revision, required human review and learning/demo
  acceptance remain distinct from these local results. No issue was closed and
  no PR was approved/merged by this task.

The [delivery plan](../../../wiki/DELIVERY_PLAN.md) maps the teacher's requirements
and the user's seven-step plan to the existing implementation and these gates.
