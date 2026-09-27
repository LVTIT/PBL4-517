# Issue #14 — approved deployment and handoff

**Approved and executed 2026-09-27.** Human explicitly approved checkpoints A/B (deployment, IP TLS and renewal without contact email). Verification results are in the linked evidence. Backend was stopped after its controlled verification run; static HTTPS remains available, API returns 502 until restarted. Persistent backend service belongs to #15.
Baseline: `e0f783b619def8c7123ec417239e32866ff72ee7`.
[Live preflight/CI](../../evidence/WEB-04/README.md).
Application commands remain canonical in [website README](../../website/README.md).

## TLS decision

At preflight, HTTP served the Nginx welcome page, 443 had no listener, and no domain was supplied.
Production Secure cookies must remain enabled; HTTP cannot verify production
auth/session or CSRF-dependent checkout.

Accepted by human: IP HTTPS and automatic certificate renewal within #14.
[Let's Encrypt](https://letsencrypt.org/2026/03/11/shorter-certs-certbot/)
documents IP certificates using Certbot >=5.4, webroot and shortlived profile
(6 days). Renewal and the Nginx deploy hook must be tested. The Certbot renewal
timer is part of TLS; persistent backend service remains in #15.

Alternatives: supply a controlled domain (revise TLS commands), or defer TLS to
a separate issue and explicitly approve only a read-only HTTP preview. That
preview cannot complete auth/session DoD. No domain purchase, Elastic IP, resize,
swap or AWS policy change proposed. If the current IP changes, reissue/reconfigure.

## Server changes performed

| Path/state | Change |
| --- | --- |
| /var/www/pbl4-517 | Clone pinned baseline, install Linux dependencies, compile outputs |
| website/backend/.env inside clone | New ubuntu-owned 0600 file; random password/secret, production settings |
| PostgreSQL | New non-superuser pbl517_app_prod and owned pbl517_prod DB; committed migrations |
| /etc/nginx/sites-available/pbl4-517 | New site below |
| /etc/nginx/sites-enabled | Replace default symlink with pbl4-517; preserve original default file |
| /var/backups/pbl4-517-issue14 | Root-only Nginx backup |
| Snap-managed files | Official classic certbot snap and its renewal timer |
| /etc/letsencrypt, /var/lib/letsencrypt, /var/log/letsencrypt | Certbot account/certificate/renewal/runtime state; private, not committed |
| /var/www/html/.well-known/acme-challenge | Certbot HTTP-01 validation files |
| /etc/letsencrypt/renewal-hooks/deploy/pbl4-nginx | Root-owned executable validation/reload hook |
| systemd manager | daemon-reload for existing warnings; no backend service |

## Initial deployment commands

These are reference commands for a fresh environment, not an instruction to rerun this deployment. Run stages sequentially, stop on errors/OOM. Do not reset existing data or rerun
initialization blindly. Recheck empty directory and absent DB/role first.

```bash
set -eu
sudo install -d -m 0700 /var/backups/pbl4-517-issue14
sudo cp -a /etc/nginx /var/backups/pbl4-517-issue14/nginx
sudo systemctl daemon-reload
git clone https://github.com/LVTIT/PBL4-517.git /var/www/pbl4-517
cd /var/www/pbl4-517
git checkout --detach e0f783b619def8c7123ec417239e32866ff72ee7
test "$(git rev-parse HEAD)" = e0f783b619def8c7123ec417239e32866ff72ee7
git remote -v
git status --short
sudo -u postgres createuser --no-superuser --no-createdb --no-createrole pbl517_app_prod
sudo -u postgres createdb --owner=pbl517_app_prod pbl517_prod
python3 - <<'PY'
import os, secrets, subprocess
from pathlib import Path
os.umask(0o077)
p = Path('/var/www/pbl4-517/website/backend/.env')
if p.exists():
    raise SystemExit('Refusing to overwrite env')
password = secrets.token_hex(32)
secret = secrets.token_hex(48)
r = subprocess.run(
    ['sudo', '-n', '-u', 'postgres', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres'],
    input=f"ALTER ROLE pbl517_app_prod PASSWORD '{password}';\n",
    text=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if r.returncode:
    raise SystemExit('Password setup failed; stop without printing credentials')
with p.open('x') as f:
    f.write(f'DATABASE_URL=postgresql://pbl517_app_prod:{password}@127.0.0.1:5432/pbl517_prod?schema=public\n')
    f.write(f'SESSION_SECRET={secret}\n')
    f.write('PORT=3000\nNODE_ENV=production\nTRUST_PROXY=loopback\nVULN_IDOR_ENABLED=false\n')
print('Env created; secrets suppressed')
PY
cd website/backend
npm ci
npm run build
npm run prisma:migrate
test -f dist/server.js
cd ../frontend
npm ci
npm run build
test -f dist/index.html
```

TLS uses [official Snap installation](https://certbot.eff.org/instructions?ws=nginx&os=snap).
Human approval included ACME account registration and Let's Encrypt terms. The created
account has no email; a human-supplied contact can replace the no-email option.

```bash
sudo snap install --classic certbot
/snap/bin/certbot --version
# Verify >=5.4 before proceeding. Existing Nginx serves /var/www/html.
sudo /snap/bin/certbot certonly --dry-run --non-interactive --agree-tos \
  --register-unsafely-without-email --preferred-profile shortlived \
  --webroot --webroot-path /var/www/html --ip-address 47.129.214.70 \
  --cert-name pbl4-517-ip
# Only after successful dry-run:
sudo /snap/bin/certbot certonly --non-interactive --agree-tos \
  --register-unsafely-without-email --preferred-profile shortlived \
  --webroot --webroot-path /var/www/html --ip-address 47.129.214.70 \
  --cert-name pbl4-517-ip
```

Install this site using a literal heredoc, with no shell variable expansion:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 47.129.214.70;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files $uri =404;
    }
    location / { return 308 https://47.129.214.70$request_uri; }
}
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name 47.129.214.70;
    ssl_certificate /etc/letsencrypt/live/pbl4-517-ip/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pbl4-517-ip/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    root /var/www/pbl4-517/website/frontend/dist;
    index index.html;
    location = /api { return 308 /api/; }
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location / { try_files $uri $uri/ /index.html; }
}
```

Enable the new site; unlink only the default enabled symlink. `sudo nginx -t`
must PASS before `sudo systemctl reload nginx`. On failure restore default
enabled link/remove new enabled link without reloading. Renewal hook content:

```sh
#!/bin/sh
set -eu
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
```

Verify `sudo /snap/bin/certbot renew --dry-run --run-deploy-hooks` and
`systemctl list-timers --all` for the renewal timer.

Start `npm start` in `/var/www/pbl4-517/website/backend` in a controlled foreground
SSH session: **temporary process for #14; persistent service belongs to #15**.
Use another session for loopback health and Nginx HTTPS checks; verify external
Windows/browser access, SPA routes and production cookies. No `curl -k` as TLS
success evidence. Stop that process gracefully after testing and report downtime.

## Production data and remaining scope

Human separately approved [minimal verification data](issue14-data-proposal.md).
One customer with a private random password, one NOT FOR SALE synthetic product
(final stock 0), and one cancelled test order remain. No demo seed or admin account.
Chrome verified registration/login, refresh/session, profile, logout, product,
cart, checkout and own-order cancellation. Admin flow was not tested. Do not run
local integration suite against production. #16 owns deeper tests and reboot
verification; #17 complete deployment handbook.

## Execution details and current handoff

Both installs/builds and three migrations passed; no OOM. Certbot 5.8.0 was
installed. Certificate SAN matches the EC2 IP, issuer Let's Encrypt YE2, expiration
2026-10-03 23:28:56 UTC. Renewal dry-run and deploy hook passed; renewal timer enabled.
Certbot labels nginx -t's successful stderr as hook "error output"; hook exit was
successful, not a failed renewal.

The first Windows Python subprocess used text mode, converting script LF to CRLF.
This failed before clone/build and created only an empty backup directory and
unused role with trailing CR. These exact names were inspected and renamed;
no existing database/data was deleted. Subsequent SSH scripts used binary stdin
(`input=script.encode()`), then decoded captured stdout/stderr. The corrected
source/env stage succeeded. See evidence 01/02; do not repeat the failed invocation.

The controlled foreground `npm start` session was stopped with SIGINT after all
verification. HTTPS static root is currently 200; `/api/health` currently 502,
with no listener on 3000. This is deliberate scope handoff, not a running service.
To repeat human review, use SSH and run the foreground command above, keep the
session open during checks, then stop it. Do not infer reboot/SSH-disconnect
persistence. #15 must provide that before continuous availability can be claimed.

## Basic rollback

Stop only the #14 backend via SIGINT. Remove new enabled-site symlink, restore
default link, run nginx -t, reload only on PASS: welcome page returns. Original
default file remains intact; backup supports recovery if needed.
Preserve DB, clone, env and certificate material privately for diagnosis. No
automatic DROP DATABASE, migration reset or recursive deletion. If rolling TLS
back, disable its new renewal hook/timer only after confirming no other cert uses
them. Cleanup/uninstall is a separate decision.

A/B approvals and execution are complete; checkpoint C requires latest PR CI and human review. No automatic merge, Issue closure or #15 implementation.
