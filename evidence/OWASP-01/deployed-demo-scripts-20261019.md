# Deployed IDOR demo client verification

Date: 2026-10-19, Asia/Saigon. Refs #24 (follow-up to the completed local lab).
Branch: `feature/24-deployed-idor-demo`, based on main `4e5fb08`.
The implementation revision is the commit containing this report; hosted checks
must be matched to the latest PR head rather than inferred from this local run.

## Change

User requested the existing scripts target `https://13.251.128.130` and confirmed
the Telegram listener already runs on Ninh's machine. Read/update/cancel entrypoints
now use that HTTPS origin by default, require an explicit prepared order UUID and
prompt for an existing customer's credentials. No public seed login, registration
fallback, production flag change or bot restart was performed. Local lab origin
remains available through `--url`.

## Local verification

Windows, Python 3.12.10, isolated ignored `.venv`, requests 2.34.2.

| Command | Result |
| --- | --- |
| `python -m unittest discover -s scripts/attacker/tests -v` | 14/14 PASS with fake HTTP sessions; no production accounts used |
| `python -m unittest discover -s scripts/ci/tests -v` | 5/5 policy regression tests PASS |
| `python -m compileall -q scanner alerts scripts/attacker scripts/ci` | PASS |
| Each of the three script entrypoints with `--help` | PASS; deployed HTTPS default and required `--id` displayed |
| `git diff --check` | PASS |

Regression coverage includes 401/403/429/503 during login (no registration or
test operation), admin rejection, own-order rejection, CSRF refresh after login,
correct read/PATCH/cancel routes, 403 FORBIDDEN versus CSRF_INVALID, malformed JSON,
missing orders/invalid states, redirect refusal, request timeouts and sanitized
output on successful unauthorized reads or TLS errors. The CI Python job runs
these offline regressions; it does not execute a live scanner or attacker session.

## Live read-only check

Using the same Python/requests environment, a GET to
`https://13.251.128.130/api/health` with `timeout=10`, redirects disabled and normal
TLS verification returned HTTP 200:

```json
{"data":{"status":"ok","database":"connected"}}
```

This verifies HTTPS/API reachability only. No login, registration, order read,
update/cancel, scan or Telegram/Discord message was sent during verification.
Authenticated EC2 IDOR results are **pending** the user's private test accounts
and synthetic order. Existing historical OWASP-01 logs remain local lab evidence.
Human review/merge remain required; the agent does not merge or close the issue.
