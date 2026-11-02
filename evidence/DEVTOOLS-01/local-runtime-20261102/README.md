# Local workflow and database consolidation — Refs #68

Date: 2026-11-02, Asia/Bangkok. Windows, Node 24.22.1/npm 11.19.1,
Python 3.13.7, Docker Desktop/Compose, PostgreSQL 16.
Source: `feature/68-local-runtime-cleanup`, based on `43bebb1`.
Local builds were stamped dirty; this is development verification, not a clean
production release or deployed acceptance. Hosted CI is tracked on the #68 PR.

## Verified

- Shared configuration: 31 scanner/ChatOps tests PASS, including `.env`/process
  precedence, repository-relative paths from another CWD, legacy state fallback,
  code-1 uncertain results and generated HTML. Alert delivery was mocked.
- Runtime migration: 5 tests PASS, preserving baseline/pending delivery/audit,
  leaving source intact, rejecting collisions and paths outside the checkout.
- Windows process lifecycle: actual child starts, repeated start retains PID,
  mismatched start time does not kill the child, owned stop and repeated stop PASS.
- Fresh source copy without dependencies or application `.env`: `dev.ps1 setup`
  installed locked dependencies, built both apps, created application/lab roles
  and DBs, applied all four migrations, seeded empty app data, prepared synthetic
  lab fixtures and installed Chromium. Test container/volume/port were isolated
  (`pbl517-setup-test`, port 55433), then removed after verification.
- Repeated database/lab preparation found no pending migrations, skipped app
  seed and retained fixture configuration. `up` succeeded twice with the same
  managed PIDs. `down` stopped processes and DB while retaining volume; `up`
  restored health through Vite. No host psql installation needed for Docker helper.
- Both dependency audits reported zero vulnerabilities during fresh installation.
- Backend config: 2 tests PASS. Real PostgreSQL API: 17 subtests + parent PASS.
  Security lifecycle: 8 subtests + parent PASS (IDOR read/update/cancel, SQLi,
  browser stored XSS, auth, configuration boundary and outage negative controls).
- Frontend Playwright: 54 desktop/mobile runs PASS against the fresh local setup.
- Root `demo`/`probe`/`secure` commands: IDOR read, SQLi, stored XSS and bounded
  auth probing returned EXPLOIT_CONFIRMED in the vulnerable phase and
  DEFENSE_VERIFIED in the secure phase, using the same dedicated lab fixtures.
- Probe classification: 8 offline tests PASS. Repository policy regression:
  5 tests PASS; index secret/path scan has no violations.

## Existing data migration on the user's machine

`pbl517-local-security` contained website `pbl517_security` and `kevilo_demo_lab`.
The older `pbl517-postgres` had a distinct `pbl517` database, including 14 orders;
it was not treated as empty or merged into website data.

All three databases were dumped in PostgreSQL custom format. Each was restored
into the new cluster, then every public table's sorted row content and count
was compared by SHA-256; all matched (seven tables per database, including
migration history). The legacy DB was restored into a temporary check DB and
kept as a verified offline dump; the temporary check DB was then removed.

Website became `kevilo_local`; the lab retained `kevilo_demo_lab`. Both have
separate non-superuser application roles and PUBLIC database privileges revoked.
Existing website/lab environment files were privately backed up; only their DB
connection changed. App sessions/orders/catalog and lab fixture identity were retained.

After restore verification and application checks, the two old PBL4 containers
and their exact, unshared volumes were removed. No global prune was used.
PBL3 resources were untouched. Private dumps, old environment files and verification
hashes remain in `.local/private/database-consolidation-20261102/` and are not published.
Normal DB volume is `pbl517-local-data`; local operational artifact layout is in
the [root README](../../../README.md).

## Limits and remaining acceptance

No real Telegram/Discord messages, external scans, EC2 deployment, ruleset changes
or issue closure were performed. Bot auth/delivery tests are not real-channel
receipts. Existing historical evidence stays in place. Production keeps the
Nginx/systemd/manual protected-environment workflow. Required CI on the final PR
revision and human review remain separate gates; the agent does not merge.
