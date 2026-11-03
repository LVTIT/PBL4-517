# Existing EIP HTTPS repair — 2026-11-03

Refs #14. Related to #16 / #17. Owner-authorized certificate/Nginx operation on
the existing instance; no application release or AWS resource changes.

**READY TO STOP EC2: server HTTPS/renewal and browser acceptance verified;
EC2 left running for the owner.**
The owner's incognito screenshot shows the KEVILO homepage without the previous
red security warning; the owner subsequently confirmed that the products list
displayed normally in that session. The agent independently verified the served
certificate's IP SAN and trust chain. Normal Chrome initially retained a warning;
the agent inspected DevTools and the owner subsequently explicitly confirmed
normal Chrome was safe too. The diagnostic sequence is recorded below. Do not
infer broader deployment/security acceptance or human PR review from these
checks.

## Environment and method

- AWS Console identified `i-0ccfb2772f854e78b`, region `ap-southeast-1`, Running,
  private IP `172.31.11.224`, EIP `52.221.157.206`.
- Direct SSH to port 22 timed out. The existing SSM role/agent was Online and
  Connected; the operation used its browser terminal through Computer Use.
- Inside EC2: hostname `ip-172-31-11-224`; checkip.amazonaws.com returned the EIP.
- Certbot `5.9.0`, Snap revision `5911`, `latest/stable`, official publisher;
  `/snap/bin/certbot`. No upgrade/reinstallation.
- Statements below are transcribed from actual terminal observations and
  external Windows probes. Private ACME logs/accounts/keys were not downloaded.
- Local documentation branch: `feature/14-eip-https`, based on main `b1b0d12`.
  PR #62 had already been merged by a human; its old branch was removed at the
  owner's request after confirming identical trees. No source was deployed.

## Before / after

| Check | Observed result |
| --- | --- |
| Original public SAN | `IP Address:13.251.128.130` — mismatch with EIP |
| Original validity | 2026-11-02 06:55:16 → 2026-11-08 22:55:15 UTC |
| Original active fullchain | `/etc/letsencrypt/live/pbl4-517-ip-new/fullchain.pem` |
| Original HTTP response | 308 to `https://13.251.128.130/` |
| Config discovered using nginx -T | enabled site resolves to `/etc/nginx/sites-available/pbl4-517` |
| Backup before Nginx modification | `/var/backups/pbl4-eip-https-20261103-090922/nginx-pbl4-517` |
| Public HTTP-01 | Initial 404: challenge directory absent. Created it root:root 0755. At 09:10:40 UTC, HTTP 200 and exact body `pbl4-acme-test`; no redirect/frontend fallback. Test file later absent. |
| Staging issuance | `certonly --dry-run`, successful; `STAGING_EXIT=0`. No staging certificate saved or installed. |
| Production issuance | One request; `PRODUCTION_EXIT=0`, lineage `pbl4-517-eip` |
| New fullchain | `/etc/letsencrypt/live/pbl4-517-eip/fullchain.pem` |
| New private key path only | `/etc/letsencrypt/live/pbl4-517-eip/privkey.pem` |
| New SAN / issuer | `IP Address:52.221.157.206` / Let's Encrypt YE2 |
| New validity | 2026-11-03 08:12:41 → 2026-11-10 00:12:40 UTC |
| Nginx diff | Two server_name values, one redirect IP and two certificate paths; other directives unchanged |
| Nginx syntax / reload | PASS before reload; `NGINX_RELOAD_EXIT=0`; final syntax PASS |
| External HTTP after reload | 308 to `https://52.221.157.206/` |
| External HTTPS after reload | HEAD `/` 200; GET health 200, `{"data":{"status":"ok","database":"connected"}}`; normal Schannel validation, no `-k` |
| External IP/chain validation | Python Windows trust store PASS; OpenSSL with existing Git CA bundle: Verification OK, verify return code 0 |
| Normal browser session | Initially warned despite a valid certificate. DevTools diagnosis and final owner confirmation of safe normal Chrome are recorded below. |
| Fresh incognito session | Owner screenshot loaded KEVILO homepage at the EIP without that warning; owner explicitly confirmed products list displayed normally |

For exact issuance, verification and rollback commands, use the
[canonical EIP runbook](../../../docs/aws/ec2-eip-https.md).

[Machine-readable external checks](public-checks.json), captured again at
09:18:52 UTC, verify the redirect, trusted TLS/IP identity, homepage and products
SPA responses, JavaScript/CSS assets, health/database status and 10 API products.
These HTTP probes do not themselves prove browser rendering of the products page.
Final external Schannel recheck at 09:40:49 UTC, after the owner's normal-Chrome
confirmation: HTTPS `/` returned 200 and `/api/health` still reported
`status: ok`, `database: connected`, with certificate validation enabled.

## Normal Chrome diagnosis and final acceptance

The owner's page-info screenshot showed a valid certificate while the page was
still marked unsafe. The agent inspected that ordinary Chrome window on
`https://52.221.157.206/` through Computer Use. DevTools Security reported:

- Certificate valid/trusted, issued by YE2.
- Connection encrypted/authenticated with TLS 1.3, X25519 and AES_256_GCM.
- Resources marked as active content with certificate errors; the explanation
  referred to content previously allowed to run despite certificate errors.

The Network panel showed same-origin HTTPS requests for fonts, products, auth/me,
favicon and product images with 200/304 responses in the visible rows. This is
not a claim that every request was exhaustively exported/audited. The homepage
rendered with four suggested products. An attempted certificate-viewer inspection
was stopped by the Computer Use URL guard; no guard or certificate warning was
bypassed and no browser security settings were changed.

This distinguishes the browser's recorded unsafe-content state from the current
trusted server certificate. It does not identify the exact earlier resource
that first created that state. The owner was asked to close all Chrome windows
and reopen the ordinary HTTPS session. The owner then explicitly confirmed
ordinary Chrome was safe: **"ĐÃ AN TOÀN RỒI"**. Browser restart itself was not
automated. Combined with the prior incognito homepage screenshot, explicit
products confirmation, matching public SAN and successful trusted TLS probes,
the task's browser acceptance is now verified. A separate certificate-dialog SAN
inspection was not completed; the SAN was verified from the actual served
certificate externally and from the server's certificate file.

## Renewal and preservation

The generated new renewal configuration contains:

```text
preferred_profile = shortlived
authenticator = webroot
webroot_path = /var/www/html,
server = https://acme-v02.api.letsencrypt.org/directory
52.221.157.206 = /var/www/html
```

The existing root:root 0755 deploy hook validates Nginx and reloads it. It was
retained. Nginx writes its successful `-t` diagnostics to stderr; Certbot labels
this "Hook 'deploy-hook' ran with error output" even when the commands succeed.
The observed overall issuance/renewal exit codes were zero and the hook's output
explicitly reported successful syntax testing; no hook failure was inferred from
the color/wording alone.

After trusted HTTPS passed, both obsolete renewal configurations targeting
`47.129.214.70` and `13.251.128.130` were backed up and moved to
`/var/backups/pbl4-eip-https-20261103-090922/inactive-renewal/`.
Their certificate/key files were retained; `OLD_CERTIFICATES_RETAINED` passed.
No renewal `.conf` contents were edited manually and no certificate was deleted.

```text
sudo certbot renew --dry-run --run-deploy-hooks
Processing /etc/letsencrypt/renewal/pbl4-517-eip.conf
Simulating renewal of an existing certificate for 52.221.157.206
Congratulations, all simulated renewals succeeded:
  /etc/letsencrypt/live/pbl4-517-eip/fullchain.pem (success)
RENEWAL_EXIT=0
```

Timer `snap.certbot.renew.timer` was active/enabled. Observed next scheduled run:
2026-11-03 20:30:00 UTC (2026-11-04 03:30:00 Asia/Bangkok). The check proves
configuration and staging renewal/hook behavior, not a future production renewal
that has not yet occurred. No forced production renewal was used.

## Final server checks

| Check | Result |
| --- | --- |
| Nginx | active/enabled, master PID 88517 unchanged, NRestarts 0 |
| Backend pbl4-backend | active/enabled, PID 4129 unchanged, NRestarts 0; no restart |
| PostgreSQL 16/main | active, cluster unit enabled-runtime; PID 52637 |
| HTTP/HTTPS listeners | `0.0.0.0:80`, `[::]:80`, `0.0.0.0:443`, `[::]:443` — Nginx |
| Backend listener | `127.0.0.1:3000` only |
| PostgreSQL listener | `127.0.0.1:5432` only |
| External 3000/5432 | Timed out; loopback-only conclusion comes from ss, not the timeout alone |
| Application .env | Server-local pre/post checksum comparison OK; contents/hash not copied here |
| ACME test file | `TEST_FILE_REMOVED` passed |
| Application/database | No deploy, source/Git operation, schema/data mutation, environment edit or app restart |
| AWS | No new resources, EIP/SG/IAM changes, release, reboot, stop or terminate |

## Handoff limits

Browser acceptance is complete with the evidence/owner confirmations above.
Documentation [PR #70](https://github.com/LVTIT/PBL4-517/pull/70) still requires
human review and the Team Leader's final merge. The initial documentation commit
`956da30` passed all five checks in
[run 41611136512](https://github.com/LVTIT/PBL4-517/actions/runs/41611136512);
latest-revision CI is tracked on the PR and must be checked separately after this
acceptance update. No human review/issue closure is inferred from CI.
Runtime state is separate from hosted CI/review for this documentation.
Historical deployment was not upgraded to current source, lab
flags were not altered/audited, and this is not full secure-baseline acceptance.
No account, order or production fixture was created.

EC2 has not been stopped. Its timer cannot renew while stopped; after a later
start, verify the EIP/services/timer and certificate dates, renew normally if
due, and check trusted HTTPS. The current observed expiry is 2026-11-10
07:12:40 Asia/Bangkok. The owner performs any final stop.
