# WEB-04 — Issue #14 deployment evidence

**Deployment verified in a controlled temporary backend session on 2026-09-27.**
Human approved checkpoints A/B and separately approved minimal test product/order
data. Latest PR CI/human review pending; no merge or Issue closure.

**Current handoff:** backend stopped with SIGINT after verification, as approved.
Static HTTPS is 200; API is now 502, no listener on 3000. Persistent service belongs
to #15. Successful API/auth/order results below were observed while the temporary
process was running, not a claim of continuous availability.

Observed 2026-09-27, 07:39–07:44 UTC (Asia/Bangkok +07:00).
Baseline: `e0f783b619def8c7123ec417239e32866ff72ee7`.
Branch: `feature/14-ec2-deployment`. Local main and origin/main matched after
fetch/pull; live `git ls-remote` from EC2 returned the same SHA.
Pre-existing untracked Python caches were preserved in a local stash.

## Baseline CI

[Run 36216679158](https://github.com/LVTIT/PBL4-517/actions/runs/36216679158)
queried via GitHub REST: completed/success on this exact SHA.
`repo-policy`, `backend-build`, `frontend-build`, `backend-integration`,
`python-check`: all PASS. This does not verify production deployment.

## Preflight observations (before deployment)

| Check | Actual result |
| --- | --- |
| SSH | PASS after human updated access; strict known-host verification enabled |
| OS/kernel | Ubuntu 24.04.5 LTS x86_64 / 7.0.0-1012-aws |
| Runtime | Node v24.21.0; npm 11.19.0; Git 2.43.0 |
| PostgreSQL | 16.15; 16/main online, active/running; query PASS |
| DB/roles | Only postgres/template0/template1 databases; only postgres non-system role |
| Database bind | listen_addresses=localhost; actual 127.0.0.1:5432 |
| Nginx | 1.24.0; active/enabled; nginx -t PASS |
| Active site | sites-enabled/default -> sites-available/default; root /var/www/html; try_files $uri $uri/ =404; no API proxy |
| TCP listeners | Wildcard 22/80 IPv4/IPv6; loopback DNS 53 and PostgreSQL 5432; no 443/3000/8080 |
| RAM/swap | 909 MiB total; 533 MiB available; no swap |
| Root disk | 6.8 GiB total; 3.6 GiB available |
| Deploy directory | /var/www/pbl4-517 empty, ubuntu:ubuntu, 0755 |
| Local HTTP | 200 OK |
| External Windows HTTP | 200 OK, Welcome to nginx! |
| External HTTPS | Connection failed on 443; no successful TLS handshake |
| TLS/domain | Human has no domain; no active Nginx cert directives; /etc/letsencrypt/live and /etc/nginx/ssl absent; certbot not in PATH |
| Supporting tools | snap/snapd 2.76.3+ubuntu24.04; python3 available |
| Warning | NeedDaemonReload=yes for nginx/postgresql/postgresql@16-main; no reload performed |

Unused certificates elsewhere were not searched. AWS SG rules were not read
through API. No external 3000/5432/8080 scan in this preflight. A piped SSH
script's final curl failed with malformed URL (Windows newline transport);
a separate SSH command reran it successfully (local HTTP 200).

## Read-only commands used

Via SSH to the human-supplied EC2 host, key kept outside repository:

```sh
date -u
cat /etc/os-release
uname -r
node --version
npm --version
git --version
psql --version
nginx -v
systemctl status nginx postgresql postgresql@16-main --no-pager
sudo ss -lntp
free -h
df -h
ls -ld /var/www/pbl4-517
find /var/www/pbl4-517 -maxdepth 1 -mindepth 1 -printf '%f\n'
sudo nginx -t
ls -l /etc/nginx/sites-enabled
sudo nginx -T 2>&1 | awk '/^# configuration file / || /^[[:space:]]*(listen|server_name|root|index|include|location|try_files|proxy_pass|proxy_set_header|ssl_certificate|ssl_certificate_key)[[:space:]]/'
pg_lsclusters
sudo -u postgres psql -X -d postgres -c 'SELECT version();'
sudo -u postgres psql -X -d postgres -c 'SHOW listen_addresses;'
sudo -u postgres psql -X -d postgres -c 'SELECT datname, pg_get_userbyid(datdba) FROM pg_database ORDER BY datname;'
systemctl show nginx postgresql postgresql@16-main -p Id -p NeedDaemonReload -p FragmentPath -p DropInPaths
curl --max-time 5 -I http://127.0.0.1/
git ls-remote https://github.com/LVTIT/PBL4-517.git refs/heads/main
```

External Windows curl used 8-second connect/12-second total timeouts against
the supplied EC2 IP over HTTP and HTTPS. No cookie/secret was collected.

## Deployment results (08:24–08:33 UTC)

EC2 deployed SHA exactly matches the baseline above; clean tracked source.

| Verification | Result / evidence |
| --- | --- |
| Source/env | PASS, [corrected execution](02-source-env-recovery.txt); no secrets printed |
| Dependencies/build | Both PASS, [output](03-build-migration.txt); npm audit 0 vulnerabilities; no OOM |
| Migration | All 3 committed migrations PASS; no db push/seed |
| Certbot | 5.8.0, [installation](04-certbot-install.txt) |
| TLS issuance | Staging dry-run and production issuance PASS, [output](05-tls-issuance.txt) |
| Nginx/renewal | Syntax/reload PASS; renewal dry-run and deploy hook PASS; timer enabled, [output](06-nginx-renewal.txt) |
| Browser public access | Windows Chrome with normal certificate verification: Home/Products/Login rendered, [auth report](07-browser-auth.txt) |
| Authentication | Browser register/login, /me CUSTOMER, refresh/session, profile update, logout PASS; Secure/HttpOnly/SameSite=Lax/Path=/api verified; cookie values omitted |
| Product/cart/order | Approved synthetic product, browser cart/checkout, own-order read/cancel, totals and stock changes PASS, [report](09-cart-order.txt) |
| Production settings | mode 0600 env, loopback DB, non-superuser application role, NODE_ENV=production, TRUST_PROXY=loopback, VULN_IDOR_ENABLED=false, [checks](10-final-server-checks.txt) |
| Health/listeners | Direct loopback and Nginx HTTPS health PASS while running; Express 127.0.0.1:3000, PostgreSQL 127.0.0.1:5432 |
| External network | 22/80/443 OPEN, 3000/5432/8080 timed out; HTTP 308, HTTPS root/health 200, [report](11-external-network.txt) |
| Handoff after stop | Static HTTPS 200, API 502, no 3000 listener; Nginx/DB remain active, [report](12-handoff-stopped.txt) |

Screenshots: [Home](07-browser-home.png), [empty products before initialization](07-browser-products-empty.png),
[Login](07-browser-login.png), [approved product after cancellation, before stock set to 0](09-browser-product.png).
Screenshots contain no passwords, cookies, tokens or private admin accounts.

Certificate issuer Let's Encrypt YE2; IP SAN matches the approved EC2 IP;
valid until 2026-10-03 23:28:56 UTC. Renewal hook validates Nginx before reload.
Certbot's message about hook "error output" is successful nginx -t output on
stderr; the hook and renewal completed successfully.

One ordinary test customer, one NOT FOR SALE product (final stock 0) and one
cancelled synthetic order remain. No admin account or development seed.
Customer password was generated randomly and kept in a local private temp file,
never repository/evidence. See [approved initialization](../../docs/aws/issue14-data-proposal.md).

## Recovery and limitations

[Initial command failure](01-source-env.txt): Windows text-mode subprocess
converted LF to CRLF, defeating shell option parsing. Before clone/build, this
created an empty backup directory and unused role with trailing CR. Inspected
and renamed these exact objects; no existing data removed. Binary stdin transport
fixed the issue; [recovery](02-source-env-recovery.txt) succeeded.

[Commands, actual config, scope and rollback](../../docs/aws/ec2-deployment-review.md).
No AWS SG API inspection: external timeout does not establish which firewall
blocked traffic. No OWASP exploit, admin-flow test, reboot test, systemd backend,
load test or guarantee of uninterrupted availability. Stop/start may change the
public IP and requires certificate/config review. #15–#17 remain separate.

Issue checklist assessment: source/dependencies/env/Nginx/evidence verified;
application, public access and main customer functions verified during the
temporary session only. Human must repeat runtime review with controlled
`npm start` or after #15. Do not close #14 while that acceptance remains pending.
