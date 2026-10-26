# PR #57 integration with current main

Verified **2026-10-26 (Asia/Saigon)**. Refs #43. Related to #35, #36, #44, #45 and
#51. [PR #57](https://github.com/LVTIT/PBL4-517/pull/57).

## Resolution and review scope

Merged main `5a7abb7684bd62bd03bf32593f99b208326fff22` into
`feature/43-monitoring-safety`, previously at
`f30f01e02eefef10b55b272930e08fd6084a2edf`. This updates the feature branch; it
does not merge the PR into main. Shared history was not rewritten.

PR #56 was squash-merged. Its runtime source on main is identical to the #57
parent `00e02df`; main's later differences are six documentation/evidence files.
Nine files conflicted due to that ancestry. The resolution preserves:

- #57's `scanner/scan.py`, `scanner/state_store.py` and reliability tests: due
  alerts selected before limiting, full-queue recovery with the old baseline,
  shared two-event budget, deep-copy isolation and validated persisted events.
- #57's scanner/runbook/MON-03 documentation and project-context clarification.
- The current main website README's four documented lab flags and baseline.
- Both progress records in CURRENT_STATUS, correcting #55/#56's merged state.
- Main's PR #56 verification/issue-audit evidence without changing its contents.

After resolution, application/scanner/alert/test/workflow source remains
identical to the original #57 head `f30f01e` (full original tree
`e54920acdeb7de6459d52f07b3790d410c35bd5f`). New changes are documentation and
integration evidence only. No dependency, database schema, runtime `.env`, lab
flag, production configuration or AWS setting changed.

The delta against current main retains #57's ChatOps authorization (chat, sender
and allowlisted IPv4, including callbacks), audit failure propagation, invalid-state
rejection, alert recovery and qualified port-security reports. Source and scenario
details remain in [the original verification](../local-20261026/README.md).

## Fresh local verification

Windows, Node **24.11.0**, npm **11.6.1**, Python **3.12.10**, Docker PostgreSQL
**16.15**. Created a new disposable `postgres:16` database container, published
only at `127.0.0.1:55457`, database `pbl517_security_test`. The compiled API used
`127.0.0.1:3057`; lifecycle APIs/proxies used fresh loopback ports and Chromium.
Only synthetic fixtures were used. Test backend/container were stopped/removed;
existing root/backend `.env` hashes were unchanged.

| Check | Result |
| --- | --- |
| Scanner/ChatOps regression | **27/27 PASS**; loopback and simulated delivery, no real chat sends |
| Backend/frontend `npm ci`, build and `npm audit --audit-level=high` | PASS; both audits zero vulnerabilities |
| Empty PostgreSQL: migration deploy and development seed | PASS; four committed migrations |
| API/session/CSRF/RBAC/order regression | **17 subtests PASS**, 18 including parent |
| Local security lifecycle and real browser checkout | **6 subtests PASS**, 7 including parent |
| Playwright UI, desktop/mobile | **54/54 PASS**; route fixtures are distinguished from the real API/browser suite |
| Policy regression | **5/5 PASS** |
| Python syntax (scanner, alerts, attacker/CI helpers) | PASS; no live attacker/scan execution |
| Project-local UI skill data / core tests | PASS / **39/39 PASS** |

[Observed check outcomes](checks.json), [scanner/ChatOps transcript](scanner-tests.txt),
[API transcript](api-integration.txt), [security lifecycle](security-lifecycle.txt),
[migration transcript](migrations.txt), [UI transcript](ui-tests.txt).
Transcripts were sanitized, normalized to UTF-8 and stripped of trailing whitespace.
Windows PowerShell classifies Prisma's successful stderr status lines as
NativeCommandError records; migration/seed processes still exited 0 and completed.
Build/audit/policy/skill outcomes were also observed, with raw logs kept outside Git.

Canonical commands: [scanner](../../../scanner/README.md),
[website](../../../website/README.md). Hosted CI must run all five required jobs
on the final revision; consult [latest PR checks](https://github.com/LVTIT/PBL4-517/pull/57/checks).
Previous green runs on `f30f01e` are historical, not verification of new ancestry.

## Remaining operational acceptance

- #35/#43: real external Ubuntu VM setup, at least two scheduled runs, reboot and
  post-reboot audit/state evidence. [Canonical VM runbook](../../../scanner/systemd/README.md).
- #36/#43: current real Telegram/Discord receipts and controlled failure/recovery.
- #33/#41/#42: actual AWS rules/listeners, bounded harmless port lab, rollback,
  external final exposure checks and Linux log correlation.
- Required human review and Owner final merge; #43's own DoD remains open after
  code review/merge until operational acceptance is complete.

ChatOps is intentionally disabled until sender IDs are configured. Its private
environment must specify allowed chat/users and authorized IPv4 targets; when
sharing a VM with the timer it must use the same `SCANNER_STATE_FILE` and a runtime
identity with access to that directory. Automatic scanner alerts keep their
existing credential configuration. No credentials were changed by this task.

No VM/AWS operation, production deployment, real chat message, human approval,
PR merge or issue closure was performed. The historical EC2 IDOR demo is not
secure-baseline acceptance; production refuses enabled lab flags. Automatic CD
remains disabled. [Project delivery plan](../../../wiki/DELIVERY_PLAN.md).
