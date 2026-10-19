# KEVILO checkout recipient phone deployment — 2026-10-19

Refs #51. Related to #14 and #24. The owner requested deployment of the reviewed
release and explicitly required preserving `VULN_IDOR_ENABLED=true` for the IDOR
demonstration. This was a manual SSH deployment; automatic CD remains disabled.

## Release and verification

- Activated application SHA: `601c2374d3b2ca4b88e00cd33fcd925ee3fde5da`.
- Previous live SHA: `524c878c00570df76a1765f0d774361f18de021f`.
- Activated at 2026-10-19 16:37:29 Asia/Saigon (09:37:29 UTC).
- Target: `https://13.251.128.130/`; Node 24.21.0, npm 11.19.0.
- All five [application CI checks](https://github.com/LVTIT/PBL4-517/actions/runs/39229881323)
  pass on the exact application revision. Local UI 48/48 and all 16 real
  PostgreSQL API subtests pass (17 tests including the parent).
- The optional recipient phone field is separate from the shipping address for
  customers and guests. The API stores customer phone input in the existing
  `Order.customerPhone` column; the guest payload remains compatible.
- Only four transitive dependencies were patched: `proxy-addr` 2.0.8,
  `ip-address` 10.7.4, `fast-uri` 3.1.8, `source-map-js` 1.2.2. Main dependency
  versions and the database schema are unchanged.
- Staged Linux backend/frontend installs, explicit builds and full audits pass;
  both audits report zero vulnerabilities. Install used Node heap 128 MB,
  `npm ci --include=dev --ignore-scripts --maxsockets=1 --no-fund`; explicit
  builds used heap 256 MB. No swap or other host configuration was added.
- Build-manifest SHA256:
  `f3eedff0da4caaae54c367c75395af8af7c71f98c2d35d2a98ad872e24a5a2f3`.
  All served frontend/backend build files match this manifest. The public HTML
  matches the activated entry point; its main asset is `index-Bz4bs9lI.js`.
- `pbl4-backend` active/enabled; normal-TLS HTTPS frontend and health return 200,
  health reports database connected. Existing `.env` bytes and permissions are
  unchanged, including the requested IDOR demo flag. No migration, seed,
  catalog import, production account/order mutation or bot change was made.

## Public UI evidence and limits

[Read-only reproduction](verify-public.cjs),
[machine-readable results](public-verification.json).

The browser fetched the real public HTML, JavaScript and product API over normal
TLS. A cart was populated only in the fresh test browser's local storage. The
phone input is visible once, supports telephone input, and has no horizontal
overflow at 1440px and 390px for guest and customer views. No checkout was
submitted. The customer-view checks mock only `/api/auth/me` to exercise the
signed-in UI; they do not establish real production authentication or persisted
production checkout. Actual browser/API/PostgreSQL persistence was verified
locally. Public real-account acceptance remains a human demo check.

- [Customer UI, desktop](public-customer-view-1440.png)
- [Customer UI, mobile](public-customer-view-390.png)
- [Guest, desktop](public-guest-1440.png)
- [Guest, mobile](public-guest-390.png)

The live lab flag is intentionally true under the owner's explicit demo
instruction. This deployment is not a claim of secure-baseline ownership checks
on the public instance; the default flag in source remains false. The three
original attacker scripts are unchanged from `e08111f`. Commit `156e353`
restored that exact full source tree before the new checkout change was made.

## Activation, rollback and governance

[Activation commands](activate.sh), [successful output](activation-result.txt).
These scripts record this exact release and are not instructions to rerun.

Two activation attempts rolled back automatically after checks found frontend
read-permission failures. The restrictive upload/build umask had left static
files inaccessible to Nginx. The final activation preserved tar permissions and
explicitly set public frontend directories/files to 0755/0644. The private build
parent and backups remain 0700. Existing hashed frontend assets were retained
for already-open tabs. No application change or dependency change was needed
after the tested build.

Private rollback backup on EC2:
`/home/ubuntu/.local/state/pbl4-517/checkout-phone-601c237.eXz9Wb`.
It retains the previous SHA, private environment, frontend output and old backend
dependencies/output; do not download or commit its contents. Failed-attempt
backups were also retained. The rollback restores the previous source/backend
output/dependencies and frontend entry point without resetting the database.

The reviewed `production` environment was created with human reviewer `LVTIT`,
administrative bypass disabled, and a branch policy for `feature/51-kevilo-ui`.
Manual [deployment record](https://github.com/LVTIT/PBL4-517/deployments/activity_log?environments_filter=production)
ID `7170372890` identifies the exact application SHA and successful activation.
Approval was the owner's instruction in this task session; this was not a
GitHub Actions environment-review run. No automatic deployment workflow,
environment secrets, PR approval or PR merge was added. PR #55 remains a draft
awaiting human review; remaining Issue #51 acceptance is not inferred complete.
