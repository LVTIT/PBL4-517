# PR #56 integration and issue closure audit

Verified on **2026-10-26 (Asia/Saigon)**. Refs #44; related to #37, #38, #40,
#43, #45 and #51. PR: [#56](https://github.com/LVTIT/PBL4-517/pull/56).

## Conflict resolution

Merged `main` at `3af7f9f70293d179c0ef58306a5e565ecf944bcb` into
`feature/44-local-security-regression`, whose previous head was `00e02df`.
This merges the base into the feature branch; it does not merge the PR into main.
The PR #55 pre-squash baseline `8625681` and current main have identical trees
(`git diff 8625681 3af7f9f` is empty). All eight conflicting files therefore retain
the #56 additions alongside the already merged KEVILO fixes:

- `scripts/ci/backend-integration.sh`: security suite and sanitized diagnostics.
- `website/backend/package.json`: `test:security` script, existing dependencies.
- `website/backend/src/services/product-service.ts`: SQLi lab helper, secure
  catalog filtering/image fields and conditional XSS marker.
- `website/frontend/src/pages/ProductDetailPage.tsx`: explicit lab warning and
  lab-only unsafe review path; secure mode still uses escaped React text.
- `website/frontend/vite.config.ts`: loopback-only test proxy override, with no
  fabricated API/catalog/order success.
- `website/README.md`, `wiki/CURRENT_STATUS.md`, `wiki/DECISIONS.md`: preserve the
  lab documentation/decision; reconcile the parent PR's actual merged state.

Application/scanner/test/workflow source after resolution is identical to
`00e02df` (tree `072575a70ab365eccce825198ae04acea6b3abb9`). Additional edits are
documentation/evidence only, including documentation of all four lab flags.
No dependency, schema or runtime configuration was changed by the resolution.

## Fresh local verification

Windows, Node **24.11.0**, npm **11.6.1**, Python **3.12.10**, PostgreSQL
**16.15** in a new disposable `postgres:16` container. Its sole published port
was `127.0.0.1:55456`; database `pbl517_security_test`. The compiled API ran on
`127.0.0.1:3056`; lifecycle APIs/proxies used temporary loopback ports. Synthetic
fixtures only. The backend and disposable database container were stopped and
removed; hashes of existing repository/backend `.env` files were unchanged.

| Verification | Result |
| --- | --- |
| `npm ci`, `npm run build`, `npm audit --audit-level=high`, both projects | PASS; zero reported vulnerabilities |
| Four committed migrations and development seed on empty PostgreSQL | PASS |
| `npm run test:integration` against compiled API/PostgreSQL | 17 subtests PASS, 18 including parent |
| Frontend `npm run test:e2e -- --workers=2` | 54/54 PASS, desktop/mobile; UI fixtures are distinct from the real API/browser checks below |
| `LOCAL_SECURITY_LAB=1 npm run test:security` | 6 subtests PASS, 7 including parent |
| Scanner reliability, loopback sockets and simulated delivery | 12/12 PASS |
| Repository policy regression | 5/5 PASS |
| Python syntax: scanner, alerts, attacker and CI helpers | PASS; no live exploit/scan executed |
| UI skill data validator and core tests | PASS, 39/39 core tests |

Captured API/security output is in [api-integration.txt](api-integration.txt) and
[security-lifecycle.txt](security-lifecycle.txt). Migration/seed summaries are in
[database-setup.txt](database-setup.txt). Windows transcript encoding was normalized
to UTF-8 and output was sanitized before inclusion; the tests themselves exited 0.
Canonical reproduction commands remain in [website README](../../../website/README.md)
and [scanner README](../../../scanner/README.md). Hosted CI must PASS all five
required jobs on the latest pushed revision; see [PR checks](https://github.com/LVTIT/PBL4-517/pull/56/checks).

The lifecycle rerun verifies identical vulnerable/secure IDOR, SQLi and persisted
XSS payloads; order/database/stock effects; bounded login guessing; refusal of
each production lab flag; real browser checkout/phone persistence; and real API
outage failures. Existing API checks separately cover session/auth/CSRF/RBAC.
The [original matrix](../local-20261025/README.md) retains its original date/scope.

## Issue-by-issue disposition

GitHub issue bodies, PR reviews, review threads and comments were inspected.
At audit time PR #56 had no submitted review, inline thread or conversation
comment. No human approval or learning/demo criterion was inferred.

| Issue | Verified contribution | Remaining closure condition | Disposition |
| --- | --- | --- | --- |
| #37 SQLi | Existing OWASP-02 script/evidence, adapted search lab, same tautology/UNION payloads in both modes, safe defaults/production refusal, current build/API/lifecycle rerun | Latest revision CI and required human review/delivery | Keep open pending those gates |
| #38 Stored XSS | Real review persisted in PostgreSQL, harmless marker executes in lab Chromium, same stored payload escaped in secure mode, current regression/build | Latest revision CI and required human review/delivery | Keep open pending those gates |
| #40 Authentication | Synthetic bounded guessing, vulnerable 401 vs secure 429, retained bcrypt/session/CSRF and production refusal; current API/lifecycle regression | Latest revision CI and required human review/delivery | Keep open pending those gates |
| #43 Monitoring | Atomic state, single writer, per-channel retry, rotation and 12 simulated/loopback checks | Further recovery/ChatOps fixes in PR #57, real Ubuntu scheduler/reboot and failure/recovery acceptance; human review | Keep open |
| #44 Full regression | Current local IDOR/SQLi/XSS/auth/checkout matrix | AWS SG/NACL/exposure/A05 checks, current real dual-channel receipts, external VM/service acceptance and human review | Keep open |
| #45 Evidence pack | Local matrix, canonical evidence links and this closure audit | Complete AWS/Linux/monitoring evidence mapping and carry-over pack after #44 acceptance; human review | Keep open |
| #51 KEVILO | Parent #55 merged; UI 54/54 and real local browser checkout verified | Full issue-scope visual/catalog/accessibility/deployed acceptance and human review not established by this regression | Keep open |

The verified local tasks for #37/#38/#40 can be recorded without marking review
complete. No related issue presently satisfies every repository closure gate.
PR #47's overlapping SQLi work still needs a separate supersession decision after
the integrated #56 implementation has been reviewed and delivered.

## Scope limits and handoff

No deployment, AWS/SG/NACL/ALB changes, live external probes, real chat messages,
VM scheduling/reboot, review approval, PR merge or issue closure was performed.
The historical EC2 IDOR demo is not secure-baseline acceptance. This source
refuses production startup with any enabled lab flag; do not deploy it with the
old demo flag retained. Automatic CD remains disabled.

Repository policy requires a different member's human review and Team Leader /
Owner final merge after latest CI passes. Once delivered, recheck each issue's
own DoD and unresolved blockers before closing it. A PR merge alone does not
complete AWS/VM tests or human acceptance.
