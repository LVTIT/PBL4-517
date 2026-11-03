# Issue #61 — inventory concurrency audit of PR #62

Refs #61. Branch `feature/61-inventory-race`. No merge, issue closure or deployment.

## Provenance and environment

Audit date: 2026-11-03. Read issue, PR/discussion (no comments), service, API tests,
all four original evidence files, error handling, controller validation, schema,
migrations and IDOR lifecycle. Fix `d8c3fa3` is retained **unchanged**. Missing work
was independent regression coverage and accurate claims. Test commit: `cda5a62`.
Exact full SHA, commands, exit codes and environment are in
[results.json](audit-20261103/results.json) and every new log. Later evidence/docs
commits do not change tested application/tests. Final hosted CI is tracked on
[PR #62](https://github.com/LVTIT/PBL4-517/pull/62).

Windows, Node v24.11.0, npm 11.6.1, Python 3.12; PostgreSQL **16.15** Docker,
default isolation **read committed**; container `pbl517-bug61-20261103`, dedicated
DB `pbl517_lab_test`, published only at `127.0.0.1:55461`, compiled API port 3061.
[DB observation](audit-20261103/database-version.txt). Random ephemeral secrets
were supplied through process environment, never copied to evidence or `.env`.
Baseline: APP_PROFILE=production, NODE_ENV=development, TRUST_PROXY=0, all four
VULN flags=false. Lifecycle separately starts acknowledged synthetic lab children
on loopback. Setup follows [website README](../../website/README.md).

## BEFORE — timelines

Checkout: A reads stock=1; B reads stock=1; both pass pre-check. A decrements to 0
and commits. B unconditionally decrements to -1; CHECK aborts B. Service wraps the
non-AppError as `503 DATABASE_UNAVAILABLE`, instead of `400 OUT_OF_STOCK`.

Cancel: A reads PENDING; B reads PENDING. A increments 8→10; B increments 10→12;
both unconditionally write CANCELLED. One logical order restores twice. Separate
transactions around writes do not make earlier reads authoritative.

Historical 2026-11-01 results remain in [reproduction.txt](reproduction.txt),
[API 19/19](api-integration.txt) and [lifecycle 9/9](security-lifecycle.txt). The old
combined negative-control failure was at checkout, so it did **not** establish
that sequential cancel assertions caught the race. CP437/UTF-8 mojibake in the
two historical test logs was reversed mechanically and BOM removed; new logs also normalize CRLF to LF. No counts,
timings or results were edited. New independent controls below supersede the
unsupported test claims.

## Existing PR audit

| Claim | Finding |
| --- | --- |
| Guard and decrement share one SQL write | Correct: captured UPDATE includes both `stock = stock - $1` and `stock >= $4`. |
| Loser gets count=0 / OUT_OF_STOCK | Correct under observed read committed. PostgreSQL waits, rechecks WHERE against updated row, and no longer matches. Service preserves AppError on rollback. |
| Claim before restore | Correct. Only count=1 may increment stock. SQL observed in cancel includes id, status and userId. |
| Secure ownership and lab/admin exceptions | Baseline non-admin scopes both read and authoritative write by userId. Existing admin/IDOR exceptions retained. `updateOrderStatus` unchanged. |
| Old test proves concurrent cancellation | Incorrect: its two awaited cancels were sequential. Replaced with an independent synchronized test. |
| Old negative control proves both bugs | Unsupported: combined test could fail before cancel. Now each function is reverted/tested separately. |
| Duplicate lines bypassed old main | Inaccurate: `products.length !== productIds.length` rejected duplicate IDs early as INVALID_PRODUCT. PR enables valid duplicates and guards aggregated quantity; the hypothetical per-line bypass was not reachable in old main. |
| Deduplication changes OrderItems | No: Map aggregates stock/price quantities, nested create retains original lines and server unitPrice. Verified via HTTP and SQL. |
| Error message stock is permanently current | No: follow-up SELECT reports a snapshot; later requests may change it. |

SQL reasoning follows [PostgreSQL 16 Read Committed rules](https://www.postgresql.org/docs/16/transaction-iso.html#XACT-READ-COMMITTED).
CHECK is defense in depth, not the primary fix. AppError carries 400/code through
service catch and error middleware; unrelated database failures retain existing
503 mapping. No changes for #63 or #65.

## Actual overlap and fixture isolation

Four independent top-level tests in
[api.integration.test.mjs](../../website/backend/tests/api.integration.test.mjs)
can be selected individually. Each uses private UUID products and exact cleanup
in finally, including failed controls. No seed-stock resets or broad email delete.
CSRF sessions are prepared before bursts; registration already signs cancel owner
in, so no redundant login is used.

A separate SQL connection holds a product row lock. Requests start concurrently;
test polls the recursive `pg_blocking_pids` graph and releases only after all
expected API UPDATEs are observed waiting. Fixed cancel winner waits at Product;
loser waits at Order. Old cancel has both waiting at Product. This proves overlap
before either request can complete. Observation is bounded to 3 seconds (below
Prisma's 5-second transaction timeout); 10ms polling yields do not determine
correctness. No application hook or production sleep.

## NEGATIVE CONTROL A — old createOrder only

Temporarily replace exactly `createOrder` with its function text from `43bebb1`,
keep fixed cancel text identical, rebuild and launch fresh compiled server.

```text
node --test --test-reporter=tap --test-name-pattern="inventory #61 checkout race" tests/api.integration.test.mjs
Expected FAIL observed: 0/1 pass, exit 1; assertion 503 !== 400
HTTP [201,201,503,201,503]
errors [OK,OK,DATABASE_UNAVAILABLE,OK,DATABASE_UNAVAILABLE]
stock=0; Orders=3; OrderItems=3; overlapping writes=5
```

[Raw A](audit-20261103/negative-control-a.txt),
[build](audit-20261103/negative-control-a-build.txt),
[fixed cancel independently PASS 1/1, three rounds](audit-20261103/negative-control-a-other-fix.txt).

## NEGATIVE CONTROL B — old cancelOrder only

Restore create fix, replace exactly `cancelOrder` from `43bebb1`, rebuild and start
fresh server. This test fails on cancellation itself, independently of checkout.

```text
node --test --test-reporter=tap --test-name-pattern="inventory #61 concurrent cancel" tests/api.integration.test.mjs
Expected FAIL observed: 0/1 pass, exit 1; assertion 2 successful cancels !== 1
round 1: HTTP [200,200]; errors [OK,OK]; status CANCELLED
stock 10 -> order quantity 2 -> 8 -> concurrent cancel -> 12
overlapping writes=2; phantom units=2
```

[Raw B](audit-20261103/negative-control-b.txt),
[build](audit-20261103/negative-control-b-build.txt),
[fixed checkout independently PASS 1/1](audit-20261103/negative-control-b-other-fix.txt).

Control harness asserted old-function equality and untouched-other-function
equality before each build. Source restored byte-for-byte in finally, then fixed
backend rebuilt; `source_restored: true` in results.json. No commits removed or
history rewritten. To reproduce, extract function ranges using
`git show 43bebb1:website/backend/src/services/order-service.ts`; swap only the
named function, preserving other functions; use commands above against an isolated
DB/server; stop each variant, restore original file and rebuild before final tests.

## AFTER / FINAL REGRESSION

[Final API](audit-20261103/final-regression.txt): **22/22 PASS**, no skips (17 existing
subtests plus their parent, and 4 independent inventory tests).

| Test | Observed |
| --- | --- |
| Checkout 3 units / 5 buyers | 3×201, 2×400 OUT_OF_STOCK; stock=0; 3 Orders, 3 OrderItems. SQL includes stock guard. |
| Cancel, 3 fresh orders / 2 concurrent requests each | Each round exactly 1×200, 1×400 CANNOT_CANCEL, status CANCELLED, stock=10. |
| Duplicate 2+2, stock=3 | 400 OUT_OF_STOCK; stock stays 3; no Order/OrderItem. |
| Duplicate 2+2, stock=5 | 201; remaining=1; total=5002.00; two original quantity-2 OrderItems with unitPrice=1250.50, verified in SQL. |
| Multi-product rollback | A=10/B=1 at pre-read; separate transaction spends B's last unit. A's write lock confirmed by NOWAIT SQLSTATE 55P03 before B fails. Result 400 OUT_OF_STOCK, A=10/B=0, no Order/OrderItem. Proves earlier claim of A rolled back. |
| Ownership/lab | Baseline attacker cancel=403; lifecycle checks vulnerable=200 vs secure=403 and stock/status effects, plus SQLi/XSS/auth/profile/cookie controls. |

## Verification commands

Every linked log contains actual output, exact command/cwd/SHA/environment and
exit code. Commands are from backend unless indicated; install/build test count
is N/A. Canonical setup stays in website README.

| Command | Result/evidence |
| --- | --- |
| `npm ci`, backend and frontend | PASS; [backend](audit-20261103/backend-install.txt), [frontend](audit-20261103/frontend-install.txt) |
| `npm run prisma:migrate`; `npm run prisma:seed` | PASS; four committed migrations present; [migrate](audit-20261103/migrate.txt), [seed](audit-20261103/seed.txt) |
| `npm run build`, both projects | PASS; [backend](audit-20261103/backend-build.txt), [frontend](audit-20261103/frontend-build.txt) |
| `npm run test:config` | 2/2 PASS; [log](audit-20261103/config.txt) |
| `npm audit --audit-level=high`, both | PASS, zero vulnerabilities; [backend](audit-20261103/backend-audit.txt), [frontend](audit-20261103/frontend-audit.txt) |
| `npm run test:integration` | 22/22 PASS; [log](audit-20261103/final-regression.txt) |
| `npm run test:e2e`, frontend | 54/54 PASS; [log](audit-20261103/e2e.txt) |
| `LOCAL_SECURITY_LAB=1 npm run test:security` | 9/9 PASS; [log](audit-20261103/security-lifecycle.txt) |
| Policy/Python checks | Policy tests 5/5, scanner 27/27, demo classification 8/8, skill core 39/39, skill data validation and compileall PASS; [exact commands/results](audit-20261103/results.json). [Index policy](audit-20261103/repo-policy.txt) checked after staging evidence. |

## Limits / human handoff

Bounded real-PostgreSQL regressions are not a production load/availability
certification. Restore relies on existing immutable order items. Global error
mapping (#63) and admin transition policy (#65) remain outside scope;
`updateOrderStatus` is not changed into a stock-restoration path. No schema,
migration, `.env`, dependency, lab architecture, UI or AWS change. No deployment.

[Teach-back](teach-back.md) prepares eight answers and a team demo. Tests/CI do not
confirm human understanding, review or issue completion. Team Leader retains final
merge authority after human review and latest-revision CI; Issue #61 stays open.
