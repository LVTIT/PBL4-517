# Manual demo guide audit — 2026-11-10

Refs #68, Related to #44. Branch: `feature/68-simple-local-demo`, base HEAD
`6c1167b`; working tree includes pre-existing uncommitted changes. This record
describes documentation/source verification, not a new runtime demo or release.

## Scope

- Expanded [operator guide](../../../scripts/demo/MANUAL.md) against the current
  routes/controllers/services, config/session/CSRF, React pages, Python HTTP probe,
  Chromium probe, local launcher/fixture reset and scanner source.
- Corrected CLI lesson copy: `handleUpdateOrderDetails`, scoped read then
  ID-only address update, XSS document reload and fresh auth counter before a
  separate browser demonstration. No request/authorization behavior changed.
- Added the missing local setup section/anchor in
  [website README](../../../website/README.md#local-nhanh-tren-windows) and aligned
  the [demo index](../../../scripts/demo/README.md) with manual startup/logs/shutdown.

## Verification

Executed from the repository root on Windows PowerShell with Python available:

```powershell
python -m unittest discover -s scripts/demo/tests -v
python -m unittest discover -s scripts/attacker/tests -v
.\demo --help
git diff --check -- website/README.md wiki/CURRENT_STATUS.md
```

Results: demo **5/5 PASS**, attacker **8/8 PASS**, launcher help exit **0**,
scoped whitespace check PASS. These existing offline tests use fixtures/mocks;
they do not establish live API/database/browser acceptance. A temporary read-only
Python check resolved **59 internal Markdown paths/anchors** across MANUAL,
demo README and website README and checked balanced fenced code blocks: PASS.
Documentation and source references were reviewed separately from these tests.

An initial help-check command incorrectly passed `demo.cmd` to Python and
failed with SyntaxError; the correct root launcher invocation above then passed.
No application probe was run by either help invocation.

## Limits

No backend/frontend/database was started or restarted. No `.env`, credential,
fixture, database or scanner state was read or mutated for a live demo. No
network attack, real chat send, AWS change, dependency install/build, new
integration run, commit, push, PR, CI result or human acceptance is claimed.
The guide's expected responses and sample trace are predictions from source,
clearly separated from observed test results. Existing unrelated work is retained.

## Operator feedback follow-up

The user clarified that terminal output should contain questions, requests and
observed results; detailed explanations and patches belong in MANUAL. A phase
must not be required before sending an interactive probe.

Implemented default observation mode in the short CLI and underlying Python/XSS
probes. No flag-based expectation inference is used by the short CLI. Live request
progress is written to stderr while child stdout stays a single JSON report.
API error codes/messages are included; credentials, tokens and login bodies are
not printed. Optional legacy `secure`/`vulnerable` map to `--expect` and preserve
exit-1 mismatch assertions. Normal runs use `<scenario>.json` and `completed`;
expectation runs use `<scenario>-<expect>.json` and `passed`.

Commands executed after the correction:

```powershell
python -m unittest discover -s scripts/demo/tests -v
python -m unittest discover -s scripts/attacker/tests -v
node --experimental-vm-modules --test scripts/attacker/tests/xss-observe.test.mjs
node --check scripts/attacker/xss.mjs
.\demo --help
```

Results: **7/7**, **11/11**, **4/4** PASS respectively; syntax/help PASS. The
new XSS tests execute the actual probe module with mocked browser/API dependencies;
they verify observation/expectation/report/trace contracts and precondition
failures, not real JavaScript execution in Chromium. The Python tests cover no
phase prompt, no tutorial/password output, real error trace formatting, conclusive
observations, precondition failure and optional legacy mismatches. No live probe
or service restart was used. Manual/index/setup references were aligned with this
behavior; the previous dated audit above remains historical.

## Bounded observed-evidence follow-up

The short commands now print what the vulnerability exposed or changed: IDOR read
shows the disclosed order only, IDOR update/cancel show address/status/stock
impact, SQLi shows row count and disclosed product names/IDs, XSS shows the stored
review/`labUnsafeReviewHtml`/`<img>` count/marker, and auth shows the 12-result
status chain plus first 429. Each probe still prints `controls` and `limits`.
The shared engine moved to `scripts/attacker/core.py` plus
`scripts/attacker/probes/`; `demo.py` dispatches and `scripts/demo/report.py`
renders console/Markdown. Non-loopback `observed` is redacted unless
`--show-evidence` is explicitly allowed.

Commands executed after this change:

```powershell
python -m unittest discover -s scripts/demo/tests -v
python -m unittest discover -s scripts/attacker/tests -v
node --experimental-vm-modules --test scripts/attacker/tests/xss-observe.test.mjs
node --check scripts/attacker/xss.mjs
python -m py_compile scripts/attacker/demo.py scripts/attacker/core.py scripts/attacker/probes/*.py scripts/demo/cli.py scripts/demo/report.py
git diff --check
```

Results: demo **9/9**, attacker Python **16/16**, mocked XSS **5/5** PASS;
syntax and whitespace checks PASS. A temporary local fake API harness (not
committed) ran the actual `demo.py --scenario idor --observe --trace` request
flow: exit 0, `EXPLOIT_CONFIRMED`, 12 trace lines, and `observed` contained the
synthetic order ID, owner email/recipient/phone/address/status/total/items while
stock stayed in `controls`; no fixture password, cookie or CSRF token appeared in
stdout/stderr. This validates the probe request/report path, not a real
backend/frontend/database, Chromium execution or EC2 release.
