# Issue #65 / PR #66 — latest-main integration audit

Refs #65. Verified locally on 2026-11-03 (Asia/Bangkok); not deployed or merged.
Human review and issue acceptance remain human gates.

## Revisions and integration

- Latest fetched main base: `96ece578a898088f5f5aad3670f89f979222ea5a`.
- Historical PR head: `5bbecb09af4e3df96913aeed231ca5b8d263bd34`, based on `43bebb1`.
- Merge-main commit: `e241cb49c4e8d128cdf8c349c6b58764845b85f7`.
- Final PR head / hosted CI run: exact full SHA and run URL are recorded in the
  [PR #66 verification body](https://github.com/LVTIT/PBL4-517/pull/66).
  This avoids embedding a commit's own SHA inside that commit. Confirm the five
  checks belong to that head and main is its ancestor before review/merge.

Repository convention forbids history rewriting/force push, so main was merged.
Only `wiki/CURRENT_STATUS.md` conflicted; both progress entries were retained,
then #65's historical summary was replaced with current verified results.
Service/test auto-merges were audited rather than accepted blindly. All service
source before `updateOrderStatus` equals latest main after newline normalization:
atomic checkout, duplicate aggregation, ownership-scoped customer cancellation,
claim-before-restock, AppError preservation and transaction rollback are retained.
No #69 runtime tooling was used.

## Environment and commands

Windows; Node **v24.11.0**, npm **11.6.1**, Python **3.12**.
Canonical website README Docker option: disposable `postgres:16`, PostgreSQL
**16.15**, read committed, container `pbl517-issue65-audit`, loopback port 55465,
database `pbl517_lab_test`; compiled secure API loopback port 3065.
Random local credentials/session secret were supplied privately through environment
variables. No repository `.env` was edited. Database version output is in
[`database-version.txt`](database-version.txt).

Commands actually executed (environment values intentionally omitted):

```text
git status --short
git branch --show-current
git fetch origin
git log --oneline --decorate -n 10 origin/main
git switch --track origin/feature/65-admin-status-inventory
git merge --no-commit origin/main
# resolve status document, inspect source, commit merge

# website/backend
npm ci
npm run build
npm run prisma:migrate
npm run prisma:seed
node dist/server.js
npm run test:integration
npm run test:config
npm audit --audit-level=high
# LOCAL_SECURITY_LAB=1 in current PowerShell environment
npm run test:security

# repository root, with the same private local test DB environment
node evidence/BUG-65/run-negative-controls.mjs
# repeat integration after restoring compiled output

# website/frontend
npm ci
npm run build
npm run test:e2e -- --workers=2
npm audit --audit-level=high

# repository root
python scripts/ci/repo_policy.py
python -m unittest discover -s scripts/ci/tests -v
git diff --check
```

PowerShell redirection logs were converted from UTF-16 to UTF-8 for review; test
results were not edited. Logs are evidence, not executable setup instructions.

## Implementation and state machine

| Current | Allowed next |
| --- | --- |
| PENDING | CONFIRMED, CANCELLED |
| CONFIRMED | SHIPPED, CANCELLED |
| SHIPPED | DELIVERED |
| DELIVERED | none |
| CANCELLED | none |

The backend rejects the other 20 edges, including every self-transition, with
409 INVALID_STATUS_TRANSITION. Tests compare complete Order, OrderItem and Product
snapshots (including timestamps) before/after every rejected edge. Missing valid
UUID returns 404 NOT_FOUND through the #65 domain pre-read; global Prisma mapping
is unchanged. Cancellation claims `id + source status` with `updateMany`, requires
count=1, then increments aggregated quantities inside the same transaction.
OrderItems retain their original rows. Only successful CANCELLED transitions
restore inventory; all three shipment edges retain the deducted stock.

Frontend lists reachable next states, disables the current placeholder and terminal
selects, and displays server conflict messages through the existing status notice.
Backend enforcement is independent. UI Pro Max's targeted disabled-control result
was applied within React/TypeScript/Vite/plain CSS; no redesign or dependency added.
The two new browser tests run on desktop and mobile; API responses are mocked in
those UI tests. Actual state/inventory enforcement is tested over HTTP/PostgreSQL.

## True concurrency and inventory proof

Requests start together and are collected with Promise.allSettled. Holding the
fixture Product row prevents either cancellation from committing before the
other reaches its database write. Recursive `pg_blocking_pids` observes both
overlapping writes, including the second request blocked on the first Order
claim. The barrier must observe both waiters before release; no timing assumption,
production sleep or application test hook is used. Every fresh round must pass.

| Scenario | Observed result |
| --- | --- |
| Admin PENDING cancel, duplicates 2+3 and second product qty 1 | A: 10 -> 5 -> 10; B: 10 -> 9 -> 10; CANCELLED |
| Admin CONFIRMED cancel, same duplicate lines | A: 10 -> 5 -> 10; B: 10 -> 9 -> 10; CANCELLED |
| Admin/admin, three fresh rounds | Each 1x200, 1x409 INVALID_STATUS_TRANSITION; stock 10 -> 8 -> 10; CANCELLED |
| Customer/admin, three fresh rounds | Exactly one 200; admin loser 409 or customer loser 400 CANNOT_CANCEL; stock 10 -> 8 -> 10; CANCELLED |
| Customer/admin winner direction | Initial fixed run observed admin winning rounds 1/2 and customer round 3; either direction is valid |
| Forward CONFIRMED/SHIPPED/DELIVERED | Stock 8 at every step, final DELIVERED |
| Customer cancel, denied reopen, denied replay | 200 / 409 / 400; final stock=original=10 |
| Restoration failure (real PostgreSQL integer overflow) | Existing 503 mapping; full Order/OrderItems/Products rollback, order remains PENDING |

Full SQL wait diagnostics and stock/state output:
[`integration.txt`](integration.txt), [`final-integration.txt`](final-integration.txt).

## Independent negative controls actually run

[`run-negative-controls.mjs`](../run-negative-controls.mjs) changes only the admin
part of the built service and starts fresh compiled APIs on 3066–3068. It asserts
the complete #61 prefix is unchanged, verifies expected failure and restores the
original compiled file in finally. It does not commit defective source.
[`negative-controls.txt`](negative-controls.txt) records restoration SHA-256.

| Control | Temporary change | Actual test result |
| --- | --- | --- |
| A | Skip only admin inventory restore | 0 pass / 1 fail: expected stock 10, actual 5; cancellation restore assertion fails |
| B | Skip self-transition and allowed-edge guards; retain atomic claim and restore | 0 pass / 2 fail: matrix accepts forbidden self-edge; CANCELLED reopen=200 and customer replay=200 create stock=12 rather than 10 |
| C | Remove conditional claim/count check; restore first, unconditional order update second | 0 pass / 1 fail: overlapping admin writes give [200,200], winners=2, stock=12, CANCELLED |

Raw outputs: [A](negative-control-a.txt), [B](negative-control-b.txt),
[C](negative-control-c.txt). Final compiled service restored byte-for-byte:
`6a01759445578d34c9076589257105eca1b15d00f8e308ea63c9ba28cd1a11a1`.
Final API regression ran after restoration and passed 29/29. No negative-control
result is inferred from source alone.

## Final local results

| Check | Actual result / evidence |
| --- | --- |
| Backend npm ci / build / migrate / seed | PASS, [install](backend-install.txt), [build](backend-build.txt), [migrate](migrate.txt), [seed](seed.txt) |
| Frontend npm ci / build | PASS, [install](frontend-install.txt), [build](frontend-build.txt) |
| API integration, after controls restored | **29/29 PASS**, [final log](final-integration.txt) |
| #61 checkout / duplicate / rollback / customer race | All four independent tests PASS; checkout 3x201 + 2x400 OUT_OF_STOCK; stock=0; customer cancel three rounds one winner and stock=10 |
| Security lifecycle | **9/9 PASS**, [log](security.txt); all four flags, secure IDOR and controlled lab behavior retained |
| Config | **2/2 PASS**, [log](config.txt) |
| E2E desktop/mobile | **58/58 PASS**, [log](e2e.txt) |
| Initial new E2E selector | 54 PASS / 4 FAIL; test used button role/name instead of existing tab; corrected test before final full run, [initial log](e2e-initial-selector-failure.txt) |
| Backend/frontend audit | Zero vulnerabilities, [backend](backend-audit.txt), [frontend](frontend-audit.txt) |
| Repository policy + unit tests | PASS, zero violations and **5/5**, [log](repo-policy.txt) |
| git diff --check | PASS |

The historical `19/19` result in the parent README belongs to the old branch/base.
The current 29 total includes the parent API test node, four #61 tests, seven
independent #65 tests and 17 API/auth subtests. Build metadata during local edits
is dirty and is not a deployable release artifact.

## Review gates and limits

The final remote head, latest main ancestry and five hosted checks (`repo-policy`,
`backend-build`, `frontend-build`, `backend-integration`, `python-check`) must be
verified together; their exact run/head result is maintained in the PR body.
No CI result from `5bbecb0` or another older head substitutes for that check.
No AI approval, merge, issue closure, team understanding/demo acceptance or AWS
operation is performed. Bounded database concurrency regression is not load testing.
Error mapping for forced overflow remains the existing behavior, outside #63.
No schema/migration, dependency, .env, lab behavior, CI design or unrelated refactor.

[Teach-back answers](../teach-back.md).
