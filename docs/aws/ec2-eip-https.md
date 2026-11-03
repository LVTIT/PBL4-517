# HTTPS on the existing Elastic IP

Refs #14. Operational change authorized by the owner on 2026-11-03; no
application deployment or AWS resource/network change. Historical deployment
instructions remain in [the initial runbook](ec2-deployment-review.md).
[Observed results and limits](../../evidence/WEB-04/eip-20261103/README.md).

## Current configuration

This section records the 2026-11-03 HTTPS operating window. The later
[#33 control-plane audit](network-control-plane.md) initially observed EC2 Stopped;
the EIP remained associated. A subsequent user-started
[23:56 Asia/Bangkok live window](../../evidence/AWS-04/live-20261103/README.md)
verified Running, HTTP 308, trusted HTTPS and health 200. Renewal configuration
was not re-inspected in that phase. These dated observations are not a
continuous-uptime claim.

| Item | Value |
| --- | --- |
| Instance / region | `i-0ccfb2772f854e78b` / `ap-southeast-1` |
| Existing EIP / private IPv4 | `52.221.157.206` / `172.31.11.224` |
| Origin | `https://52.221.157.206/` |
| Active site | `/etc/nginx/sites-enabled/pbl4-517` → `/etc/nginx/sites-available/pbl4-517` |
| Frontend root | `/var/www/pbl4-517/website/frontend/dist` |
| API upstream | `http://127.0.0.1:3000`, existing `/api/` proxy |
| HTTP-01 webroot | `/var/www/html`, separate from the application frontend |
| Certificate name | `pbl4-517-eip` |
| Fullchain | `/etc/letsencrypt/live/pbl4-517-eip/fullchain.pem` |
| Private key path only | `/etc/letsencrypt/live/pbl4-517-eip/privkey.pem` |
| Certbot | Snap `/snap/bin/certbot`, observed version `5.9.0` |
| Renewal timer | `snap.certbot.renew.timer`, active/enabled |
| Deploy hook | `/etc/letsencrypt/renewal-hooks/deploy/pbl4-nginx`, root:root `0755` |

The existing port-80 `location ^~ /.well-known/acme-challenge/` serves that
webroot with `try_files $uri =404`. The other HTTP requests redirect with 308 to
`https://52.221.157.206$request_uri`. Both server blocks use the EIP as
`server_name`; HTTPS loads the fullchain/key above. Proxy, static routing and
TLS protocol settings were preserved. The existing hook runs:

```sh
#!/bin/sh
set -eu
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
```

## Verification and renewal

Use the existing authorized management connection. SSH from the operator's
Windows machine timed out; this repair used the instance's existing SSM Session
Manager role/agent. No SSH ingress, IAM permissions or credentials were changed.

```sh
sudo nginx -t
systemctl is-active nginx pbl4-backend
systemctl is-enabled nginx pbl4-backend
systemctl is-active snap.certbot.renew.timer
systemctl is-enabled snap.certbot.renew.timer
sudo certbot renew --dry-run --run-deploy-hooks
curl --fail --silent --show-error https://52.221.157.206/api/health
```

Check the served certificate, including IP identity and normal chain validation:

```sh
openssl s_client -brief -no_ticket -connect 52.221.157.206:443 \
  -servername 52.221.157.206 -verify_ip 52.221.157.206 \
  -verify_return_error </dev/null
```

On Windows, the observed standalone MSYS OpenSSL default trust path lacked a
usable root. Explicitly selecting the existing Git CA bundle made verification
pass; Windows Schannel curl and Python's Windows trust store also passed.
Do not disable validation or use `curl -k` as acceptance evidence.

IP certificates use the `shortlived` profile. See the
[Let's Encrypt instructions](https://letsencrypt.org/2026/03/11/shorter-certs-certbot/).
The observed certificate expires **2026-11-10 00:12:40 UTC**, or
**07:12:40 Asia/Bangkok**. This is an observation of this issuance, not a fixed
future renewal date.

This task does not stop EC2. While EC2 is stopped its renewal timer cannot run.
After starting it, check the EIP, service/timer state and certificate dates. If
renewal is due, use `sudo certbot renew --cert-name pbl4-517-eip`, then verify
trusted HTTPS again. Do not repeatedly force production issuance. Browser state
should be checked in a fresh session if an already-open session still shows the
previous certificate warning.

During this repair, ordinary Chrome's DevTools showed a trusted certificate and
TLS 1.3, while its Resources warning recorded previously allowed content with
certificate errors. Incognito was used as a diagnostic comparison. After being
asked to close/reopen Chrome, the owner confirmed ordinary Chrome was safe too.
Incognito is not required for normal use. Do not weaken certificate checks or
reissue a valid production certificate merely to clear a browser-session warning.

## Issuance performed during the repair

These are historical commands, not instructions to issue another certificate.
The existing ACME challenge directory was absent and was created root:root
`0755`. An external HTTP probe then returned 200 with the exact test body; its
test file was removed. Only after that did staging run:

```sh
sudo certbot certonly --dry-run --non-interactive \
  --preferred-profile shortlived --webroot --webroot-path /var/www/html \
  --ip-address 52.221.157.206 --cert-name pbl4-517-eip
```

Staging passed. Certbot dry-run does not save a staging certificate or install it
in Nginx. Production was requested once, with the same command without
`--dry-run`. Its actual returned paths and SAN were checked before updating
Nginx. `nginx -t` passed before reload. No upgrade, standalone authenticator,
`--force-renewal`, Certbot reinstall or application restart was used.

## Retained state and rollback

Root-only backup directory:
`/var/backups/pbl4-eip-https-20261103-090922/`.

- `nginx-pbl4-517`: original Nginx site before any modification.
- `renewal-before/`: copies of the two old renewal configurations.
- `inactive-renewal/`: the original `pbl4-517-ip.conf` and
  `pbl4-517-ip-new.conf`, moved out of the active renewal directory after the new
  certificate was serving trusted HTTPS. They still targeted old public IPs.
- `env-before.sha256`: private, server-local checksum record; final comparison
  passed. No application environment contents were copied into this repository.

Old `live/` and `archive/` certificate/key files remain untouched. No
`certbot delete` was run. The active renewal directory contains only the new
production lineage, so the normal unfiltered dry-run tests the EIP certificate
without attempting validation for IPs no longer assigned to this instance.
Its renewal configuration was generated by Certbot, not hand-edited.

If the new site fails, restore the previous configuration and validate before
reload:

```sh
sudo cp -a /var/backups/pbl4-eip-https-20261103-090922/nginx-pbl4-517 \
  /etc/nginx/sites-available/pbl4-517
sudo nginx -t && sudo systemctl reload nginx
```

That returns to the previous old-IP certificate/redirect, including its EIP
identity mismatch; it is a recovery fallback, not successful migration. Recheck
frontend/API availability. Do not release/change the EIP or delete either
certificate while investigating. Only restore inactive old renewal files if
their corresponding identifiers become valid again as part of a separately
reviewed rollback. Old-certificate cleanup remains for Team Leader confirmation.
