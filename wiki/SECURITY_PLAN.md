# Security plan

## Secure baseline

**Status: Accepted.** Keep `main` and deployment configuration secure by default.
The existing website uses bcrypt, runtime validation/body limits, session rotation,
PostgreSQL sessions, HttpOnly/SameSite cookies, Secure cookies in production,
CSRF tokens, role guards, parameterized Prisma queries and HTTP security headers.
These controls are not a claim that all vulnerabilities have been eliminated.
[Canonical configuration/commands](../website/README.md).

## Controlled local labs

**Status: Partially implemented / locally verified; human review pending.**
The user authorized the local-first plan on 2026-10-25. Reuse existing work;
SQLi was adapted from `59b75f3` (PR #47), preserving KEVILO fields and filters in
secure mode. Current local results and pending AWS/VM work are recorded in the
[security matrix](../evidence/TEST-02/local-20261025/README.md).

All flags default false: `VULN_IDOR_ENABLED`, `VULN_SQLI_ENABLED`,
`VULN_XSS_ENABLED`, `VULN_AUTH_ENABLED`. Any enabled flag is rejected by config
when `NODE_ENV=production`, before binding an HTTP port. APIs bind loopback.
Only use an isolated lab branch/environment, synthetic data and an authorized
target. A non-production label alone does not make a publicly proxied lab safe.
Historical EC2 IDOR demo evidence is not approval to deploy these new lab modes.

Each lab must demonstrate vulnerable behavior, the defense, the same attack after
fix, and normal functionality. Record source revision, environment, date, request,
result and limitations. Evidence belongs in `evidence/`, with secrets/cookies/tokens
redacted. Do not close an issue or infer human acceptance from tests or a PR merge.

| OWASP Top 10:2021 | Scenario | Current scope |
| --- | --- | --- |
| A01 Broken Access Control | IDOR read/update/cancel | Historical evidence + new local API/DB retest; owner remains allowed, attacker blocked in secure mode |
| A03 Injection | SQL Injection | Existing search lab adapted; identical tautology/UNION payloads verified in vulnerable/secure modes |
| A03 Injection | Stored XSS | Review persisted in PostgreSQL; harmless marker executes in local lab, same review is escaped by secure React rendering |
| A07 Authentication | Login guessing | 12 bounded wrong-password requests; secure returns 429 from attempt 11, lab remains 401; bcrypt/session/CSRF retained |
| A05 Misconfiguration | Unnecessary service exposure | Scanner implemented; local listener/reliability checks; real EC2 SG hardening lifecycle still pending #33/#36/#41 |

SQLi and XSS are two scenarios in one OWASP group. CSRF and admin authorization
have baseline tests but are not separately completed exploit/fix labs.
A port scan observes TCP reachability; it does not read AWS rules, prove an
application vulnerability, or establish a CVSS score. Timeout/filtered observations
remain uncertain. Port-based scores are local heuristics.

## Automated local regression

`npm run test:security` from backend requires explicit `LOCAL_SECURITY_LAB=1`,
a dedicated loopback test/security/lab database (or a disposable CI database),
both project builds and Playwright Chromium. It creates synthetic fixtures and
fresh API processes, performs the lifecycle checks and cleans up its own fixtures.
[Commands and prerequisites](../website/README.md#local-security-lifecycle-regression--refs-37-38-40-44).

Scanner regression uses loopback sockets and mocked channel outcomes, never real
chat messages. [Scanner behavior and scheduling template](../scanner/README.md).
Actual Ubuntu VM scheduling/reboot, real current dual-channel receipts, AWS
network verification, deployed acceptance and human review remain pending.
