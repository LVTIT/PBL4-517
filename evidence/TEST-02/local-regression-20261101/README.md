# Full security regression ? 2026-11-01

Refs #44. Related to #16, #17, #33, #35, #36, #41, #42, #43, #45.

Status of the **2026-11-01 run**: local scenarios verified; AWS/VM/monitoring items
were blocked or unverified in that window. This is historical evidence for the
tested revision below, not an issue closure or current deployed acceptance.

Tested revision: **`6d4f569786b8045bddde8065900148bf1741e87b`** on
`feature/44-local-regression-20261101`, created from `main` at `43bebb1`.
At that tested revision, the only source change was the test-suite time budget described in
[Finding 1](#finding-1--security-suite-budget-was-smaller-than-its-own-workload);
application, scanner and dependency source was identical to `43bebb1`.

## Integration update — 2026-11-04

`feature/44-local-regression-20261101` now integrates `main` at `359acee`, including
the newer #61/#65 order fixes, #63 error classification and #33/#14 AWS evidence.
The `wiki/CURRENT_STATUS.md` conflict was resolved by retaining both this dated
regression entry and all newer main entries. The captured `.txt` logs remain
unchanged and are **not** evidence that the integrated head was tested locally.
Latest-head hosted verification is tracked on
[PR #59](https://github.com/LVTIT/PBL4-517/pull/59).

The test delta remains only the Node parent timeout, 120 s to 300 s, plus its
comment. `scripts/ci/backend-integration.sh` still wraps the suite in
`timeout 120s`; the increased Node budget does not increase that Linux deadline.

The external observations below concern the old IP `13.251.128.130` on
2026-11-01. Later evidence records EIP `52.221.157.206`, the network control-plane
review and the authorized 2026-11-03 live window; use the
[network baseline](../../../docs/aws/network-control-plane.md),
[EIP/renewal runbook](../../../docs/aws/ec2-eip-https.md) and
[live coverage](../../AWS-04/live-test-plan.md) for that later scope. Those records
do not establish a current-main deployment or complete #44's remaining A05,
VM/reboot, real-channel receipts and human acceptance criteria.

## Environment

| Item | Value |
| --- | --- |
| OS | Windows, Asia/Saigon |
| Node / npm | 24.19.0 / 11.17.0 |
| Python | 3.13.13 |
| Database | disposable `postgres:16` container `pbl517-regression-20261101`, loopback `127.0.0.1:55437`, database `pbl517_lab_test` |
| Browsers | Playwright 1.63.0 Chromium (`chromium-1243`, `chromium_headless_shell-1243`) |
| Lab location | loopback only; all four `VULN_*` flags stayed `false` on every externally reachable request |

The container, its database and every spawned server/preview process are
disposable local test resources. No repository `.env` value, existing database or
production secret was read into evidence. The account password used by the
lifecycle suite is synthetic and already documented in the test source.

## Test matrix

| # | Issue #44 item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | A01 IDOR ? vulnerable read/update/cancel then secure retest | **PASS (local)** | `security-lifecycle.txt`, subtest 3 |
| 2 | A03 SQL Injection ? vulnerable disclosure then secure retest | **PASS (local)** + secure remote retest | `security-lifecycle.txt`, subtest 4; `external-exposure.txt` tautology returns `{"data":[]}` |
| 3 | Stored XSS ? payload persists, renders in real Chromium in lab, escaped in secure mode | **PASS (local)** | `security-lifecycle.txt`, subtests 5 and 7 |
| 4 | A07 Authentication ? bounded guessing, 401 vs 429 | **PASS (local)** | `security-lifecycle.txt`, subtest 8 |
| 5 | A05 Security Misconfiguration ? detect, fix, rescan | **BLOCKED** | needs #33/#36 first; no AWS console or lab-flag deployment authority (see #41) |
| 6 | Scanner baseline / change detection | **PASS** | `config-and-policy.txt` (27 scanner tests) + live sweep reports `NO_CHANGE` after the earlier run |
| 7 | Telegram alert | **NOT VERIFIED** | delivery success/failure in tests is simulated; no real message was sent |
| 8 | Discord alert | **NOT VERIFIED** | same as above |
| 9 | Security Group / NACL rules after the lab | **BLOCKED** | console-only; external sweep can only observe the effect, not the rules |
| 10 | Website HTTPS / functionality smoke test | **PASS with caveat** | `external-exposure.txt`: HTTPS 200, port 80 ? 308, catalog/search/guards behave; deployed revision is stale, see Finding 2 |
| 11 | Backend service / reboot check | **BLOCKED** | requires SSH/root on the host; tracked by #16 and #35 |
| 12 | External 3000 / 5432 / 8080 not public | **PASS** | `external-exposure.txt`: only 80 and 443 OPEN; 22, 3000, 5432, 8080 FILTERED |

Issue tasks:

| Task | Result |
| --- | --- |
| Agree host, account and data allowed before testing | Done: loopback container for lab data, team-owned EC2 `13.251.128.130` for secure read-only HTTP checks |
| Record version / commit SHA under test | `6d4f569`; both artifacts report `ARTIFACTS_VERIFIED` for that SHA |
| Do not run vulnerable mode publicly and uncontrolled | Respected: every `VULN_*` run bound to `127.0.0.1`; external requests hit the secure profile only |
| Collect PASS/FAIL evidence per scenario | This file plus the four captured logs |
| File a separate bug issue for each real failure | Not done; both findings below are either fixed here or already owned by #16/#17, see the finding text |
| Retest after the fix | Security suite re-run after the budget fix: 9/9 PASS |
| Store the matrix in `evidence/TEST-02/` | This directory |

## Verification runs

| Command | Result | Log |
| --- | --- | --- |
| backend `npm run build`, frontend `npm run build` | PASS, both stamped with `6d4f569` | `config-and-policy.txt` |
| `node scripts/release/verify-local.mjs <dist> 6d4f569...` (backend + frontend) | `ARTIFACTS_VERIFIED` for both | `config-and-policy.txt` |
| `npm run test:config` | 2/2 PASS | `config-and-policy.txt` |
| `LOCAL_SECURITY_LAB=1 npm run test:security` | 8 subtests PASS, 9 including parent | `security-lifecycle.txt` |
| `npm run test:integration` against compiled API + PostgreSQL | 17 subtests PASS, 18 including parent | `api-integration.txt` |
| `npm run test:e2e -- --workers=2` | 54/54 PASS, desktop and mobile projects | `frontend-e2e.txt` |
| scanner reliability (loopback sockets, simulated delivery) | 27/27 PASS | `config-and-policy.txt` |
| demo result classification | 8/8 PASS | `config-and-policy.txt` |
| CI helper tests / repository policy | 5/5 PASS; 411 index entries, 0 violations | `config-and-policy.txt` |
| Python syntax (`compileall scanner scripts`) | PASS | `config-and-policy.txt` |
| live port sweep of the team EC2 | 2 open (80, 443), 4 filtered, event `NO_CHANGE` | `external-exposure.txt` |

Captured logs are sanitized by construction: the database URL is a loopback
container credential, no session cookie, CSRF token, secret or personal data is
included. The lifecycle suite prints synthetic fixture IDs only.

## Findings

### Finding 1 ? security suite budget was smaller than its own workload

`website/backend/tests/security-lifecycle.test.mjs` kept a **120 s** parent
timeout from its creation in PR #56, while PR #58 (`43bebb1`) added a whole
subtest that launches two more servers, two Vite previews, ten Python demo
probes and two Chromium sessions.

Observed on this host before the fix:

```text
✖ deployed-demo tools: real fixtures, remote-style HTTP probes and browser retest (95285.3158ms)
✖ isolated local exploit -> defense lifecycle (122793.2268ms)
  'test timed out after 120000ms'
```

Every subtest passed in isolation; only the aggregate budget was too small. The
budget is now **300 s**, with all assertions unchanged and no test skipped. The
whole suite then passed in 136 s. The shell job in
`scripts/ci/backend-integration.sh` still caps the step at `timeout 120s`; that
cap is unchanged because Linux CI completed well inside it before this branch.

This is a test-reliability defect introduced by #58, not a security regression.

### Finding 2 ? the deployed EC2 revision is stale

The live site answers the secure-baseline checks, but it does not serve the
release metadata added in #58:

```text
GET /api/version  ->  404 {"error":{"code":"NOT_FOUND"}}
frontend index.html Last-Modified: Mon, 19 Oct 2026 09:37:29 GMT
```

`main` at `43bebb1` does expose `/api/version`, so the running deployment predates
it. Consequences:

- the "AWS/monitoring not regressed" DoD line cannot be satisfied against the
  current code while the host runs an older build;
- any window-security statement about `13.251.128.130` describes that older
  revision, not `6d4f569`.

Ownership stays with #16 (verify deployment) and #17 (document deployment), which
also need the SSH/AWS access that this task does not have. No new issue was
created because both existing issues already cover redeployment and verification.

### Finding 3 ? test prerequisites are not discoverable from the failure

A fresh `npm ci` in `website/frontend` installs `@playwright/test` but not the
browser binary, so the suite fails with `Executable doesn't exist at ...`.
`npx playwright install chromium` fixes it. The canonical commands in
`website/README.md` still work; this note only saves time for the next runner.

## Remaining acceptance (not done here)

- No AWS console, IAM, Security Group, NACL or ALB change was made or inspected.
- No SSH session, service restart, reboot or journal inspection on the EC2 host.
- No real Telegram or Discord message was sent; both channels are simulated in
  tests, so #35/#36/#43 receipts stay historical.
- No A05 lab was performed; #41 still depends on #33 and #36.
- No deployment was performed, so the stale revision in Finding 2 is unchanged.
- Required human review and issue acceptance are still outstanding.

## Reproduction

```powershell
# disposable database
docker run -d --name pbl517-regression -e POSTGRES_PASSWORD=labonly -e POSTGRES_USER=lab `
  -e POSTGRES_DB=pbl517_lab_test -p 127.0.0.1:55437:5432 postgres:16

$env:DATABASE_URL = "postgresql://lab:labonly@127.0.0.1:55437/pbl517_lab_test?schema=public"
cd website/backend; npm ci; npm run prisma:migrate; npm run prisma:seed; npm run build
cd ../frontend; npm ci; npx playwright install chromium; npm run build

cd ../backend; $env:LOCAL_SECURITY_LAB = "1"; npm run test:security
# separate shell with the compiled API on a free loopback port:
#   $env:PORT = "3057"; node dist/server.js
#   $env:TEST_API_URL = "http://127.0.0.1:3057"; npm run test:integration
```

External port checks must target only the host authorized in the task and keep
`--no-alert` so no channel is triggered by a regression run.
