# Local security matrix ? 2026-10-25

Refs #44, #45. Related to #37, #38, #40, #43 and #51.

Status: implemented and verified locally; hosted CI/human review are separate.
Source baseline is `8625681`; integrated source is `eb4d9fe` in [PR #56](https://github.com/LVTIT/PBL4-517/pull/56). The SQLi work is adapted
from `59b75f3` (PR #47), retaining its historical OWASP-02 evidence content (trailing whitespace normalized).
See [PR #56 checks](https://github.com/LVTIT/PBL4-517/pull/56/checks) for the latest revision, including documentation updates.

Environment: Windows, Node 24.15.0, npm 11.12.1, PostgreSQL 16.15 in a newly
created Docker container `pbl517-local-security`, loopback 127.0.0.1:55432.
Existing .env and pre-existing databases were not modified. Synthetic fixtures
only. APIs and preview servers use temporary loopback ports and are stopped by
the suite. The local DB container remains available for subsequent development.

| OWASP 2021 / scenario | Vulnerable control | Secure retest / normal control | Result |
| --- | --- | --- | --- |
| A01 IDOR | Other user reads, updates and cancels order (200); address/status/stock change | Same operations 403; DB state/stock unchanged; owner still reads/updates/cancels | PASS local |
| A03 SQLi | Same tautology/UNION inputs disclose fixture rows / synthetic user email | Inputs treated as literal search; no rows disclosed; normal search still finds fixture | PASS local |
| A03 Stored XSS | Harmless marker in review saved by real API executes in Chromium through actual Vite proxy | Same stored review renders as text, creates no injected img and executes no marker | PASS local |
| A07 Login guessing | 12 wrong requests remain 401; correct password still authenticates after guessing | First 10 are 401; attempts 11/12 and following login are 429 | PASS local |
| Production config | Enable each of four lab flags individually | Startup validation fails before serving requests | PASS local |
| Real browser checkout | Authenticated browser uses actual API/database, no mocked responses | Address/phone stored in PostgreSQL; confirmation survives reload; owner cancels order | PASS local |
| Backend outage | Actual proxy target is offline | Products/auth/order requests remain HTTP errors, never mock success | PASS local |
| Scanner / A05 preparation | Real loopback listener + simulated uncertainty/delivery failures | No-change suppression, confirmed refusal, uncertainty/recovery, durable failed-channel retry, state corruption, atomic-write failure, queue cap and single writer | 12 checks PASS |

SQLi and XSS are two scenarios in one OWASP group. The port exercise is not yet a
completed EC2 Security Misconfiguration lab. Port-based risk scores are heuristics,
not validated CVSS scores or proof of an application vulnerability.

## Verification

[Captured sanitized output](verification.txt), [command outcomes](checks.json).
Both clean installs/builds/audits pass; audits report zero vulnerabilities.
Four migrations and development seed pass. API integration has 17 subtests PASS
(18 including parent); Playwright 54/54 PASS; security lifecycle has six subtests
PASS (7 including parent); scanner reliability 12/12 PASS. Policy/skill data/tests
and Python syntax also pass. Subsequent narrow reruns cover final test-cleanup
and notifier metadata changes. Hosted CI reruns all gates on the final revision.

Reproduce with canonical instructions in website/README.md and scanner/README.md.
`npm run test:security` requires LOCAL_SECURITY_LAB=1 and a dedicated loopback
lab/test/security database. It creates synthetic fixtures, checks vulnerable and
secure APIs and cleans up its own rows/processes. Never use a production DB.

## Remaining acceptance

- No EC2/IAM/SG/NACL/ALB changes or live AWS probing in this task.
- No actual Ubuntu VM scheduler install/reboot. Reviewed templates/runbook are in
  scanner/systemd; owner must carry out #35/#43 acceptance on that VM.
- Alert delivery failures/successes in new tests are simulated; no new real
  Telegram/Discord messages were sent. Historical SCAN-01 receipts remain historical.
- Real EC2 exposed-port -> alert -> hardening -> rescan and log correlation remain
  #33/#36/#41/#42 work once AWS is available.
- Production config now refuses all enabled lab flags. The previous deployed IDOR
  demo configuration must not be carried into a new production deployment.
- Full UI/catalog acceptance, required human review and issue closure are pending.
  Passing these scenarios does not establish that all website vulnerabilities are fixed.
