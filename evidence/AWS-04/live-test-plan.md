# Live verification plan and current coverage

Refs #33. Initially **DEFERRED — EC2 intentionally stopped** during the
control-plane audit. The user subsequently authorized external tests and started
EC2. [Executed 2026-11-03 live observations](live-20261103/README.md) replace the
blanket deferral for this tested source/window. Agent never starts/stops EC2.
Configuration evidence is not runtime acceptance; remaining coverage is below.

## Authorized operating-window procedure

Team Leader schedules/authorizes the running window and confirms the instance,
EIP, exact deployed revision and secure application profile. Re-read control-plane
configuration at that time and compare with this audit before testing. A human
starting EC2 does not by itself authorize deployment, SG/NACL edits or lab mode.
Use only the group's target from an external machine; record timestamps, source
public IPs and command/results. No alert delivery or scanner baseline mutation is
required by this plan. Do not open 8080 or run a listener to make a test pass.

| Port | Service | Expected SG | Expected runtime / evidence to collect | Live verified now |
| --- | --- | --- | --- | --- |
| 22/TCP | SSH | Admin `/32`; observed `171.225.185.44/32`, matching workstation public IP | TCP reachable from admin; no reachability from separately authorized non-admin source | Admin source PASS 2/2; non-admin source DEFERRED by user, will test later |
| 80/TCP | Nginx HTTP | IPv4 public | HTTP redirects to EIP HTTPS; ACME webroot is an intentional exception | PASS: TCP 2/2, HTTP 308 |
| 443/TCP | Nginx HTTPS | IPv4 public | Trusted certificate matches origin; website and `/api/health` respond | PASS: TCP 2/2, verified TLS, website/health 200 |
| 3000/TCP | Express | No public rule | No external connection; separately authorized host inspection for loopback binding | Timeout 2/2 observed; binding NOT VERIFIED |
| 5432/TCP | PostgreSQL | No public rule | No external connection; separately authorized host inspection for loopback binding | Timeout 2/2 observed; binding NOT VERIFIED |
| 8080/TCP | Controlled lab | No public rule | No external connection; no lab listener expected | Timeout 2/2 observed; no listener created |

Use bounded connection attempts only during that future window. Record timeout
as **inconclusive/filtered**, refusal as **refused**, and successful handshake as
**reachable**. Timeout alone does not identify SG, NACL, OS firewall, path or
listener as the cause. Negative external results need the running-instance
precondition and current SG/NACL evidence; loopback claims additionally need
host evidence. Unexpected exposure is a finding, not permission to change AWS.

For SSH, a single `/32` rule proves source restriction in configuration but not
ownership or successful authorized access. No need to expose credentials or log
in simply to establish TCP reachability; any future SSH host inspection requires
its own authorized scope. IPv6 is not configured in this snapshot; if it appears
later, expand the live matrix and re-audit IPv6 routing and policy first.

Keep #33 **OPEN** until required live evidence, review and all issue DoD are met.
No checklist item proving human understanding/demo may be inferred from this plan.
