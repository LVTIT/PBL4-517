# Latest-main audit — Issue #63 / PR #64

Refs #63. Historical base `43bebb1bbed71f7a63617ed0a4ce45b57888a393`,
historical PR head `0a3a039588cdb5131b6eae7ffd445c7c039efc90`.
Integrated main: `b0bedc71d7a7f8dc8311e2f55c270796feda6478`.
Integration commit: `16333eb74f92a2fb700cc6c4e466b1119137eb64`.

The parent BUG-63 evidence and 19/19 result are historical. Its broad mapping
table is superseded by this audit. Exact **final delivery head**, hosted CI run
URL and five check conclusions are maintained together in the
[PR #64 body](https://github.com/LVTIT/PBL4-517/pull/64), after the final push.
Do not use an earlier source/evidence commit's run for a later head. A document
cannot embed its own Git SHA; the PR body is the final-head CI record.

## Environment and setup actually used

2026-11-03 Asia/Bangkok, Windows, Node 24.11.0, npm 11.6.1, Prisma
CLI/client/pg adapter 7.10.0, PostgreSQL 16.15 Docker, read committed
([version output](database-version.txt)). Canonical setup is
[website/README.md](../../../website/README.md). No unmerged #69 tools used.

Dedicated container `pbl517-63-audit`, loopback-only dynamic Docker port, synthetic
database `pbl517_lab_63`; generated credentials/session secret stored only in a
private temporary manifest. Existing .env never changed; regression test config
does not use it:
test processes explicitly override DATABASE_URL, SESSION_SECRET, NODE_ENV,
APP_PROFILE, TRUST_PROXY, all four false lab flags and DOTENV_CONFIG_PATH.
Initial fixed port 55446 was unavailable on Windows; switched to Docker-assigned
loopback port before setup. No canonical DB, EC2 or AWS was stopped/started.

Executed backend `npm ci`, `npm run build`, `npm run prisma:migrate`,
`npm run prisma:seed`, `npm run test:data-errors`, `npm run test:integration`,
`LOCAL_SECURITY_LAB=1 npm run test:security`, `npm run test:config`,
`npm audit --audit-level=high`. Frontend `npm ci`, `npm run build`,
`npm run test:e2e`, `npm audit --audit-level=high`.
Root `python scripts/ci/repo_policy.py`,
`python -m unittest discover -s scripts/ci/tests -v`, `git diff --check`.

Portable orchestration used after canonical install/migrate/seed/build:
`node evidence/BUG-63/run-negative-controls.mjs` then
`node evidence/BUG-63/run-final-regression.mjs`, with that private runtime env.
The latter invokes exactly the Node test files named by the npm scripts and
starts/stops the compiled baseline API. Raw command outputs are adjacent `.txt`
files; they contain synthetic fixture diagnostics, not private credentials.

## Integration/conflict audit

Merged origin/main without rewriting history/force push. Conflicts were
order-service.ts's old admin implementation against #65, and CURRENT_STATUS.
Reconstructed order service from latest main and applied only the mapper import
and catch translation. Both historical wiki records retained; old #63 record
explicitly marked historical. Audit of auto-merged API tests replaced #63's old
conditional/skippable test with a dedicated independent regression file.

[Machine comparison](code-preservation.json) proves order service equality after
normalizing only the import/catch changes, and main's entire API suite equality
after newline normalization. No stock-claim, aggregation, rollback, ownership,
customer cancellation, transition table, terminal state, admin conditional claim,
restock algorithm, schema, error middleware, lab config or frontend change.

## Final error policy and measured mapping

| Failure and sufficient context | Response | Proof |
| --- | --- | --- |
| Malformed product/order route UUID | 400 INVALID_ID, controller before DB | HTTP, every tested route variant |
| Explicit domain missing resource | existing 404 NOT_FOUND | HTTP product/order reads |
| P2025 + Product model + product update/delete operation | 404 NOT_FOUND | direct current-Prisma probe + both HTTP writes |
| P2003 + Product model + product delete operation | 409 CONFLICT | real Product/Order/OrderItem; HTTP and unchanged full snapshots |
| P2002 generic unique violation | 409 CONFLICT | real Product.id duplicate; mapper + isolated HTTP service fault |
| P2002 + User + registration insert + confirmed email exists on fresh read | 409 EMAIL_EXISTS | observed stale pre-check/blocked INSERT/COMMIT; one User row |
| AppError | same object, status/code/message | 5 identity unit tests + HTTP + #61/#65 suites |
| Other contexts/codes/non-Prisma/connection failure | 503 DATABASE_UNAVAILABLE | unit tables + HTTP Error/P2034/unreachable DB |

Current probes observed P2007 malformed UUID, P2025 missing update/delete,
P2003 referenced Product delete and P2002 email/primary-key uniqueness. P2007
is **not** globally mapped: format code alone cannot identify a request UUID.
Pinned pg adapter's P2002 supplies modelName and structured adapter constraint,
but not meta.target. Registration therefore re-reads email; it does not parse
SQL/driver message/constraint names. Pre-check retained.
Prisma's pinned [7.10.0 RequestHandler source](https://github.com/prisma/prisma/blob/7.10.0/packages/client/src/runtime/RequestHandler.ts#L243)
also shows model-name resolution and preservation of adapter metadata. Local
PostgreSQL probes, rather than newer online reference pages, establish the
actual codes/metadata for this repository.

P2000/P2001/P2004/P2007/P2015/P2018/P2023 and P2025/P2003 outside their proven
operation/model remain 503. In particular #65's intentional restoration overflow
test retains 503 and full transaction rollback.

Every #63 HTTP assertion checks status, error.code and exact safe message/full
JSON envelope, with no stack, SQL, constraint, connection or private path.
Generic unique HTTP proof injects a real duplicate-Product write into a read
method in an isolated child: this verifies fallback serialization; the production
API does not expose a client-selected Product primary-key create operation.
Unknown Error/P2034 faults likewise live only in child processes; no production
test routes/hooks. Unreachable-DB process uses a closed temporary loopback port;
products and health return safe 503, canonical test API remains healthy.

## Negative controls actually executed

| Control | Only temporary compiled changes | Observed |
| --- | --- | --- |
| A | Blanket translator -> 503; controller UUID checks restored to old shape-only checks for malformed-ID proof | 3 pass / 8 fail including parent; malformed 503≠400, missing 503≠404, FK/registration 503≠409 |
| B | Remove AppError passthrough only; fresh API, unchanged #61/#65 tests | 3 pass / 8 fail; all four #61 and #65 matrix/phantom/admin-race/customer-race fail with 503; all five identity unit tests fail |
| C | Replace only unknown fallback with unsafe 400 | HTTP 7 pass / 4 fail including parent: unknown, P2034, unreachable DB 400≠503; unit fallback tests fail |

[A](negative-control-a.txt), [B HTTP](negative-control-b.txt),
[B unit](negative-control-b-unit.txt), [C HTTP](negative-control-c.txt),
[C unit](negative-control-c-unit.txt), [harness result](negative-controls.txt).
Exact original bytes of all three compiled modules restored in finally and
asserted equal. No mutated source committed. Final regressions ran afterward.

## Final local results

| Check | Result / evidence |
| --- | --- |
| Backend install/build | PASS, backend-install.txt / backend-build.txt |
| Frontend install/build | PASS, frontend-install.txt / frontend-build.txt; existing chunk-size warning |
| Migration/seed | PASS, migrate.txt / seed.txt |
| Mapper unit | 26/26 PASS, data-errors.txt |
| API incl. #63 | 40/40 PASS, integration.txt: existing 29 plus #63 11, no skip |
| Security lifecycle | 9/9 PASS, security.txt |
| Config | 2/2 PASS, config.txt |
| Browser E2E | 58/58 PASS, e2e.txt |
| npm audits | 0 vulnerabilities both, backend-audit.txt / frontend-audit.txt |
| Root policy/unit/diff | repo-policy.txt / policy-tests.txt / diff-check.txt |

Existing #61 checkout: three 201, two 400 OUT_OF_STOCK, stock=0 and exactly
three orders/items. Concurrent customer cancel: three rounds, one 200 and one
400 CANNOT_CANCEL each, stock 10->8->10. Duplicate totals/original items/server
pricing and rollback after earlier claim PASS. #65: both cancellation source
states/all duplicate quantities, 20 invalid edges/terminal states, forward edges,
phantom replay, missing order, overflow rollback and three rounds each of
admin/admin and customer/admin concurrency PASS; losers retain 409 admin / 400
customer and exactly one restock. See integration.txt diagnostics.

## Required CI execution and remaining human gates

Minimal ci.yml addition runs `npm run test:data-errors` within the existing
required backend-integration job. That same job invokes backend-integration.sh,
which calls `npm run test:integration`; its script now includes both the unchanged
main suite and data-errors.integration.test.mjs. Hosted job logs must show both
26 and 40 test totals. Required five checks and exact final head/run are in PR #64.

No issue closed or human review/demo/understanding ticked. Team Leader performs
final merge after review and checks on the current head. Not deployed; no AWS,
EC2 start, certificate change, #59/#69 merge, schema/dependency/UI refactor.
Bounded local race cases are not production load certification. The closed-port
outage probe can theoretically race another local listener; it targets no actual
server. [15 implementer teach-back answers](../teach-back.md).
