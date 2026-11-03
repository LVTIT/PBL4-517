# Deferred live verification — no probes executed

Refs #33. **DEFERRED — EC2 intentionally stopped** during the control-plane audit.
Configuration evidence is not runtime acceptance. Do not start EC2 for this phase.

## Future operating window

Team Leader schedules/authorizes the running window and confirms the instance,
EIP, exact deployed revision and secure application profile. Re-read control-plane
configuration at that time and compare with this audit before testing. A human
starting EC2 does not by itself authorize deployment, SG/NACL edits or lab mode.
Use only the group's target from an external machine; record timestamps, source
public IPs and command/results. No alert delivery or scanner baseline mutation is
required by this plan. Do not open 8080 or run a listener to make a test pass.

| Port | Service | Expected SG | Expected runtime / evidence to collect | Live verified now |
| --- | --- | --- | --- | --- |
| 22/TCP | SSH | Admin `/32`; follow-up observed `171.225.185.44/32`, matching workstation public IP | TCP reachable from confirmed admin source; no reachability from a separately authorized non-admin source; record both source IPs | NO — DEFERRED |
| 80/TCP | Nginx HTTP | IPv4 public | HTTP request returns expected redirect to EIP HTTPS; ACME webroot is an intentional exception to general redirect | NO — DEFERRED |
| 443/TCP | Nginx HTTPS | IPv4 public | Trusted certificate matches current origin, website and `/api/health` respond as expected; no certificate bypass | NO — DEFERRED |
| 3000/TCP | Express | No public rule | External TCP connection not established; separately authorized host inspection confirms `127.0.0.1:3000` binding and service health | NO — DEFERRED |
| 5432/TCP | PostgreSQL | No public rule | External TCP connection not established; separately authorized host inspection confirms loopback binding | NO — DEFERRED |
| 8080/TCP | Controlled lab | No public rule | External TCP connection not established; no lab listener expected | NO — DEFERRED |

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
