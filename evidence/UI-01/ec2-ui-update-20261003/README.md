# KEVILO UI update on EC2 — 2026-10-03

Refs #51. User explicitly requested deployment of the tested revision, with an isolated worktree build and backup of the running release. PR #52/#53 remain closed and unmerged; this was a manual branch deployment, not CD.

## Release and activation

- Deployed SHA: `524c878c00570df76a1765f0d774361f18de021f`; previous EC2 SHA: `9f758792aa13c7b402dd3699cd96aaf518e7bffa`.
- [CI run 37121814826](https://github.com/LVTIT/PBL4-517/actions/runs/37121814826): all five jobs PASS on the exact deployed revision. API 17/17 and UI 40/40; see [fixture verification](../ci-fix-20261003.md).
- Target: `https://47.129.214.70/`, Ubuntu EC2, Node 24.21.0, npm 11.19.0. SSH used strict known-host checking. The user separately demonstrated a working Session Manager terminal; local execution used SSH after connectivity returned.
- Worktree: `/var/www/pbl4-517/.local/releases/524c878c00570df76a1765f0d774361f18de021f`. Frontend/backend `npm ci --include=dev`, build and audit HIGH/CRITICAL threshold PASS on Linux while the old release stayed online.
- Frontend audit 0 vulnerabilities; backend 2 moderate, 0 high/critical. Lockfiles unchanged.
- Schema and migration directories were identical between old/new revisions. No migration, catalog import, seed, account or order creation was performed.
- Activated at **22:58:31 Asia/Bangkok** (15:58:31 UTC). Updated live source, frontend `dist`, backend `dist` and backend `node_modules`; restarted `pbl4-backend`.
- Live paths: `/var/www/pbl4-517/website/frontend/dist`, `/var/www/pbl4-517/website/backend/dist`, `/var/www/pbl4-517/website/backend/node_modules`.
- Backend active/enabled, NRestarts=0; Nginx/PostgreSQL active; nginx configuration validation PASS. Backend 3000 and PostgreSQL 5432 remain loopback-only. No backend error-priority journal entries in the postflight window.
- Full new-build hash manifest verification PASS. Served HTML matches the build. `.env` checksum unchanged and permissions remain 0600. Main assets: `index-CPUNMCjP.js`, `index-CAi3WJtA.css`. Old hashed assets retained for already-open tabs.

## Public browser verification

Headless Chromium, normal TLS validation, real public API responses without interception. [Machine-readable results](public-verification.json) and [reproduction script](verify-public.mjs).

- Home and Catalog: no horizontal overflow at 320/375/390/414/768/1440px; exactly two cards per row at all four tested phone widths, four columns at 1440px.
- Public catalog returns 10 products and excludes deployment-verification items by default. This remains a display filter with a public API override, not an admin authorization boundary.
- All three replaced product images match repository bytes over HTTPS.
- Real category filter, search/reset, client-only add-to-cart, cart persistence, empty shipping address, mobile drawer Escape/focus restoration, product detail and login/register page rendering PASS.
- Populated cart has no overflow at 320/390px. No order, registration or login was submitted.
- Four axe scans (Home/Catalog, 390/1440px): zero automatic violations; `aria-prohibited-attr` and `color-contrast` incomplete results remain for manual review. No uncaught page errors.
- Screenshots: [Catalog 390px](catalog-390.png), [Home 390px](home-390.png), [Cart 390px](cart-390.png).

This verifies the deployed public UI, not completion of all audit DoD or F14. Reviewed product content, real authenticated checkout acceptance, cross-account confirmation isolation and performance measurements remain pending.

## Execution evidence and recovery

- Build: [commands](build.sh), [output](build-result.txt).
- Backup/activation: [commands](activate.sh), [output](activate-result.txt).
- Postflight: [commands](postflight.sh), [output](postflight-result.txt).

These scripts record this exact deployment; do not rerun blindly. Canonical application commands are in [website README](../../../website/README.md).

Private backup on EC2: `/home/ubuntu/.local/state/pbl4-517/ui51-update-524c878c00570df76a1765f0d774361f18de021f` (0700). It contains the old build/env archive, previous SHA, checksum manifest, and old frontend/backend build trees plus backend dependencies under `previous/`. No private backup was downloaded or committed. Activation had an automatic rollback handler; it was not needed. Recovery uses those saved trees, previous source SHA and a backend restart; no database restore is needed for this release.
