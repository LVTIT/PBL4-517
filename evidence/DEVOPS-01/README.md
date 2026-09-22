# DEVOPS-01 — CI verification evidence

Task [#28](https://github.com/LVTIT/PBL4-517/issues/28), branch `feature/28-strict-ci-governance`, base `6e8c5325b88364cab2a34c7309c2f220e4de691b` (includes IDOR PR #27).

## Verification in progress

Local on Windows, Node 24.21.0 / npm 11.19.0 / Python 3.12.10:

- `npm ci` and `npm run build` PASS for backend and frontend (Prisma generate, backend TypeScript, frontend TypeScript + Vite).
- `npm audit --audit-level=high`: 0 vulnerabilities in each project.
- Policy regression tests 5/5 PASS, staged Git index policy PASS (127 entries, 0 violations).
- Python compileall PASS; actionlint 1.7.12 workflow syntax/schema PASS (local shellcheck unavailable, disabled explicitly); `bash -n` PASS; staged diff whitespace PASS.
- Real PR CI and PostgreSQL integration are pending; no hosted CI PASS claimed yet. No local PostgreSQL integration was run during this task.

## Repository inspection

2026-09-22: main protection API returned `404 Branch not protected`, rulesets empty, Actions enabled. Account has admin permissions; no rules/settings modified. Production environment absent, only existing `copilot` environment. No deployment, AWS/EC2 access or secret creation performed.

## Pending human work

- Review implementation and CI evidence on latest PR revision.
- Review/apply proposed protection separately; verify UI/API afterward.
- Team Leader final merge; verify issue DoD independently before closure.
- CD remains Planned until #14 manual deployment is verified.
