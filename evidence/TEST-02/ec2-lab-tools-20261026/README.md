# One-EC2 lab tooling verification — Refs #44

Implementation branch: `feature/44-ec2-lab-demo`, based on `559ce14`.
This report describes local verification on 2026-10-26, not an AWS deployment.
The commit containing this report identifies the delivered source; hosted CI
on the latest PR revision is a separate gate.

Environment: Windows, Node 24.22.1, Python 3.13.7, PostgreSQL 16.15 native,
fresh dedicated `kevilo_lab_test` database, Playwright Chromium. No live target
scan, chat send, AWS rule change or production database access was performed.

| Verification | Result and scope |
| --- | --- |
| npm ci/build both projects | PASS; dependency lockfiles retained |
| npm audit --audit-level=high, both projects | PASS, zero reported vulnerabilities at this check |
| Four committed Prisma migrations + development seed | PASS on fresh disposable local database only |
| npm run test:integration | PASS, 17 subtests / 18 including parent, real PostgreSQL |
| npm run test:config | PASS, 2 matrix tests; default profile rejects each flag across Node modes, explicit acknowledged lab accepts production runtime |
| npm run test:security | PASS, 8 subtests / 9 including parent; real API/database/browser |
| npm run test:e2e -- --workers=2 | PASS, 54 desktop/mobile runs; these UI tests use their existing mocked fixtures, distinct from real checkout in lifecycle suite |
| python -m unittest discover -s scripts/attacker/tests -v | PASS, 8 tests; 403/429/5xx, missing controls, failed login, redirect rejection, release mismatch/dirty/hash tampering |
| python -m unittest discover -s scanner/tests -v | PASS, 27 tests; loopback/mocked delivery, no real receipts |
| python -m unittest discover -s scripts/ci/tests -v | PASS, 5 policy tests |

Lifecycle exercises the same Python CLI and XSS Chromium script intended for
Windows-to-EC2 use. It creates private random-password owner/attacker/admin
fixtures, runs IDOR read/update/cancel, SQLi and bounded auth in vulnerable and
secure modes, resets only the fixture order/stock between phases, and retains
the exact stored XSS review for browser retest. It also checks production-runtime
lab cookies via a simulated trusted loopback HTTPS proxy, real checkout phone
persistence and API outage behavior. This does not test the EC2 certificate/Nginx.

Failures found during implementation were corrected: the initial local database
name lacked the required `lab` segment; the first SQLi probe's added search prefix
changed SQL semantics and was replaced with the existing verified tautology.
The final lifecycle passed rather than weakening its assertions. The old scripts'
false-positive behavior (503 or unrelated 403 labeled secure) is covered by tests.

Build metadata reports dirty builds honestly during development. Before deployment
build the exact clean reviewed commit, verify local artifact hashes, then use the
remote release verifier against actual FE/BE. This is provenance verification,
not attestation of an untrusted server.

Still pending: human review/merge, deployment, real TLS/Nginx/service acceptance,
current Telegram/Discord receipts, SG/NACL/A05 exposure lifecycle, Linux logs,
optional ALB evidence and team rehearsal/handoff. Do not close #44 based on this
report. [Canonical runbook](../../../scripts/attacker/README.md).
