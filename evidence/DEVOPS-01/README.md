# DEVOPS-01 — CI verification evidence

Task [#28](https://github.com/LVTIT/PBL4-517/issues/28), branch `feature/28-strict-ci-governance`, base `6e8c5325b88364cab2a34c7309c2f220e4de691b` (includes IDOR PR #27).

## Local verification

Local on Windows, Node 24.21.0 / npm 11.19.0 / Python 3.12.10:

- `npm ci` and `npm run build` PASS for backend and frontend (Prisma generate, backend TypeScript, frontend TypeScript + Vite).
- `npm audit --audit-level=high`: 0 vulnerabilities in each project.
- Policy regression tests 5/5 PASS, staged Git index policy PASS (127 entries, 0 violations).
- Python compileall PASS; actionlint 1.7.12 workflow syntax/schema PASS (local shellcheck unavailable, disabled explicitly); `bash -n` PASS; staged diff whitespace PASS.
- No local PostgreSQL integration was run during this task; hosted integration results are below.

## Hosted GitHub Actions — verified 2026-09-22

[PR #29](https://github.com/LVTIT/PBL4-517/pull/29), [PBL4 CI run 35713164678](https://github.com/LVTIT/PBL4-517/actions/runs/35713164678): **SUCCESS**, event `pull_request`.

- PR head: `adcde1c7a3bd5ba51a08597502ffb46ee94c8ce0`.
- Base: `6e8c5325b88364cab2a34c7309c2f220e4de691b`.
- Tested GitHub merge SHA (confirmed in checkout log): `5f383a5b595d0c76528eda47b65ac64d3d50f196`.

| Check | Result | Evidence |
| --- | --- | --- |
| repo-policy | PASS | [Job](https://github.com/LVTIT/PBL4-517/actions/runs/35713164678/job/106698344199): 5 regression tests, 127 index entries, zero violations |
| backend-build | PASS | [Job](https://github.com/LVTIT/PBL4-517/actions/runs/35713164678/job/106698344983): clean install, Prisma generate/TypeScript build, audit 0 vulnerabilities |
| frontend-build | PASS | [Job](https://github.com/LVTIT/PBL4-517/actions/runs/35713164678/job/106698343943): clean install, TypeScript/Vite build, audit 0 vulnerabilities |
| backend-integration | PASS | [Job](https://github.com/LVTIT/PBL4-517/actions/runs/35713164678/job/106698344309): PostgreSQL service, migration, seed, health, tests |
| python-check | PASS | [Job](https://github.com/LVTIT/PBL4-517/actions/runs/35713164678/job/106698344269): compileall without running scanner/exploits |

Integration job log confirms PostgreSQL **16.15** on Linux; all three committed migrations applied (`20260914000000_initial`, `20260918000000_expand_ecommerce`, `20260918140000_guest_checkout`). Seed completed for two demo accounts, six products and reviews. Backend health PASS at `2026-09-22T09:56:37Z`; Node test runner reported **tests 16, pass 16, fail 0** at `09:56:41Z` (15 nested cases plus parent test). Existing cases include SQL row/session checks and read/update/cancel IDOR denial on the Secure Baseline. The job ran `npm start` from compiled output, with `VULN_IDOR_ENABLED=false`.

Hosted runtimes: backend build Node 24.21.0, frontend build Node 24.20.0; npm 11.19.0. Workflow selects supported Node major 24, so runner cache/patch may differ. No high/critical or other audit findings at this run. Action runtime deprecation and npm install-script notices did not cause failures; build and integration actually executed.

This record names the implementation run precisely. The evidence/documentation commit itself triggers another run; use the **latest head checks on PR #29** before review/merge, not an older success. The final PR description records the latest verified head/run without requiring a self-referential evidence commit. Human review and branch protection application remain separate pending work.

## Limits

No application/schema/scanner algorithm changes, no production deployment and no browser/EC2 verification in this task. Policy covers known paths/signatures, not all possible secret encodings/history or screenshots. Failure-log redaction is regression tested; the hosted happy path passed, but no deliberate database outage or failing PR was injected. CI checks alone do not enforce merge restrictions until owner-approved repository settings are applied.

## Repository inspection

2026-09-22: main protection API returned `404 Branch not protected`, rulesets empty, Actions enabled. Account has admin permissions; no rules/settings modified. Production environment absent, only existing `copilot` environment. No deployment, AWS/EC2 access or secret creation performed.

## Pending human work

- Review implementation and CI evidence on latest PR revision.
- Review/apply proposed protection separately; verify UI/API afterward.
- Team Leader final merge; verify issue DoD independently before closure.
- CD remains Planned until #14 manual deployment is verified.
