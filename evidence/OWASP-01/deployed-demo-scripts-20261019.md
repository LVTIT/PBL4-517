# Deployed IDOR demo client verification

Date: 2026-10-19, Asia/Saigon. Refs #24 (follow-up to the completed local lab).
Current branch: `feature/51-kevilo-ui`, working directory `D:\PBL4-517`, moved here
at the user's explicit request after the initial isolated-branch verification.
Original branch: `feature/24-deployed-idor-demo`, based on main `4e5fb08`.
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

## Hosted CI and remaining blocker

[Run 39220785388](https://github.com/LVTIT/PBL4-517/actions/runs/39220785388)
checked implementation `f4a351560624cf30a503f7255941d8edc366e7cc`:

- `python-check`, `repo-policy`, `backend-integration`: PASS.
- `frontend-build`: compilation PASS; audit gate FAIL for high-severity
  `source-map-js` advisory GHSA-68fv-2mgg-jv7q.
- `backend-build`: compilation PASS; audit gate FAIL for critical-severity
  `proxy-addr` advisory GHSA-jqcg-44mw-7w3h; also reports two moderate findings.

Both web manifests and lockfiles are byte-for-byte unchanged from base main
`4e5fb08`. Updating web dependencies is outside this script-targeting change.
At that verification, PR #54 was draft, not READY FOR HUMAN REVIEW; delivery is
now moved onto the user's active #51 branch. No gate bypass, merge or deploy.
This evidence-only follow-up requires its own latest-head CI result; use the PR
checks rather than treating the implementation run as a pass for a later SHA.

## Transfer into the active UI workspace

The user requested work directly in `D:\PBL4-517` on `feature/51-kevilo-ui`.
Only attacker scripts/tests/README, scanner usage, this evidence, the offline
Python CI step and a new CURRENT_STATUS entry were transferred. Existing #51
frontend/backend/UI changes and six unrelated untracked local helper scripts
were preserved. The old branch's CI results above are historical, not checks of
the combined #51 revision. No change was made to Ninh's running Telegram process.
At the destination workspace, all 14 offline regressions were rerun and PASS;
attacker compileall, read-script help (new HTTPS default) and whitespace checks
also PASS. A separate ignored `.venv` was prepared there for immediately runnable
PowerShell commands. Full combined-branch hosted checks remain a separate gate.
