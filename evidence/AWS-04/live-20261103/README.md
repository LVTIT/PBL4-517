# AWS-04 live network observations — human-started EC2

Refs #33. This phase was separately authorized in chat: the user offered to start
EC2 and asked the agent to run the real network tests. It supersedes the earlier
blanket deferral **for the bounded external probes recorded here only**. Agent
did not Start/Stop/Reboot EC2, change AWS/OS/application configuration, log in via
SSH, deploy, open a lab listener or send alerts. Earlier stopped snapshots remain
historical evidence, not descriptions of the running test window.

## Preconditions and provenance

- Exact target: `i-0ccfb2772f854e78b`, `ap-southeast-1`, EIP `52.221.157.206`.
- AWS Console refreshed before probes and showed **Running** for this instance,
  same EIP/private IPv4 `172.31.11.224`. No inference from an old screenshot.
- External Windows workstation source: **`171.225.185.44`**, independently checked
  using `https://checkip.amazonaws.com`, matches the SG SSH `/32`.
- Probe window: **2026-11-03 16:56:36–16:56:45 UTC / 23:56:36–23:56:45 Asia/Bangkok**.
- Repository base: `680aee7539625b917f59d2b40c5221149c927202`; pre-test documentation
  head: `8283a2e77ce7e1a509d47d978e9e5d9f1b0fa4ec`. These are repository/audit SHAs,
  **not a claim of deployed application revision**.
- Same-window control-plane comparison after probes: the same SG still has
  exactly three inbound rules (22 from `171.225.185.44/32`, 80/443 public IPv4)
  and one all-IPv4 outbound rule. The effective default NACL still has rule 100
  IPv4 ALLOW all followed by `*` DENY in each direction. No IPv6 rule observed.
- [Exact probe source](network-probe.py), [sanitized machine-readable results](results.json).
  Execute only after confirming this instance is Running:

```powershell
python evidence/AWS-04/live-20261103/network-probe.py
```

Two TCP connection attempts per port, four-second timeout, six fixed ports only.
HTTP requests are GET-only, unauthenticated and bounded; no login/order/product
mutation, exploit or existing scanner state. Certificate validation stays enabled.
No response cookies/credentials or full page/API business data stored.

## Observed network matrix

| Port | Observations from admin source | Assessment and limit |
| --- | --- | --- |
| 22/TCP | Reachable 2/2 (32 ms, 47 ms) | PASS: TCP connectivity from allowed source; no SSH authentication/session attempted |
| 80/TCP | Reachable 2/2; HTTP `/` returns 308 to `https://52.221.157.206/` | PASS: HTTP redirect as intended |
| 443/TCP | Reachable 2/2; TLS verified; HTTPS `/` returns 200 | PASS: trusted HTTPS origin responds |
| 3000/TCP | Timeout 2/2, each 4 seconds | No external connection established from tested source; consistent with SG denial; not proven CLOSED or proof of host binding |
| 5432/TCP | Timeout 2/2, each 4 seconds | Same limit; not proven CLOSED or proof of PostgreSQL loopback binding |
| 8080/TCP | Timeout 2/2, each 4 seconds | Same limit; no public reachability observed, no lab listener created |

A timeout is **inconclusive/filtered** as to cause. It may reflect SG, NACL,
other path filtering or a host condition. Combined current SG policy and a
running/reachable web origin support the expected restricted exposure from this
source; these observations do not establish universal unreachability or actual
Linux listening addresses.

## HTTPS, health and deployment provenance

- TLS **1.3**, cipher `TLS_AES_256_GCM_SHA384`; default system trust and IP-name
  validation both succeed. Certificate SAN: IP `52.221.157.206`.
- Observed validity: `2026-11-03 08:12:41 UTC` to `2026-11-10 00:12:40 UTC`.
  Renewal timer/service configuration not inspected or altered in this phase.
- HTTPS `/`: **200**, KEVILO title. This establishes origin HTML availability,
  not a full browser/UI or application acceptance run.
- `/api/health`: **200**, `{ "data": { "status": "ok", "database": "connected" } }`.
  Backend/database health is observed through Nginx, without public DB access.
- `/api/version`: **404**. `/release.json`: **200 text/html**, same body hash as
  frontend `/`, not release JSON. Exact deployed FE/BE SHA cannot be established
  via these endpoints. Do not equate current repo main/head with deployed code.
- Runtime application profile/lab flags and current Linux loopback bindings are
  **not inspected**; no secure-profile acceptance or host configuration claim.

## Remaining verification and issue disposition

- **DEFERRED by user:** TCP 22 negative control from a second, non-admin public
  source. User replied in chat that they will test it later. No independent
  second-source execution is available in this record. Config
  proves a single source rule; the successful admin-source test alone cannot
  establish negative-source behavior.
- **NOT VERIFIED:** current host loopback bindings, exact deployed application
  revision/profile. Do not replace these gaps with old deployment evidence.
- **HUMAN REVIEW PENDING:** architecture/evidence review and team teach-back/demo
  acceptance are not inferred from the agent's reference answers or CI.

**Issue #33 remains OPEN.** External live tests above are now executed, replacing
their earlier deferral for this source/window. Remaining controls and human DoD
must still be completed; agent does not approve/merge or close the issue.
