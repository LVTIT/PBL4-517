# Attached Security Group — current Console observation

Refs #33. Collected 2026-11-03, starting 16:02 UTC, in `ap-southeast-1`.
Provenance and base SHA: [audit index](README.md).

EC2 Networking lists exactly one primary ENI and one attached SG:
`eni-00488b028c979c5da` → **`sg-0c0ebd38764b1df74` (`launch-wizard-1`)**,
VPC `vpc-0ab08b95c1ba6251d`. SG description:
`launch-wizard-1 created 2026-09-21T09:08:31.575Z`.
SG details shows **3 inbound / 1 outbound permission entries**. Read both tabs;
no filters applied, one page. All rule descriptions and Name fields are `–`.

## Complete inbound matrix

| Rule ID | Family | Protocol | Destination port | Source | Description |
| --- | --- | --- | --- | --- | --- |
| `sgr-0f3d64042fccd37c3` | IPv4 | TCP | 443 | `0.0.0.0/0` | None |
| `sgr-0d9d1ff2bf39ae7b7` | IPv4 | TCP | 80 | `0.0.0.0/0` | None |
| `sgr-0c58efa55b9ff94a3` | IPv4 | TCP | 22 | `117.3.54.230/32` | None |

## Complete outbound matrix

| Rule ID | Family | Protocol | Port range | Destination | Description |
| --- | --- | --- | --- | --- | --- |
| `sgr-0ed6c9247e745eb16` | IPv4 | All | All | `0.0.0.0/0` | None |

## Assessment

- **PASS (configuration):** 80/443 allow public IPv4 as intended. TCP 22 is
  restricted to one IPv4 `/32`; no Internet-wide SSH rule.
- **PASS (configuration):** no inbound permission covers 3000, 5432 or 8080.
  Checked the complete attached SG rule set, including broad all-port/range
  rules; none exist. SG is allow-only, with implicit denial for unmatched ingress.
- **PASS (configuration):** no IPv6 inbound/outbound rules, including `::/0`.
  The primary ENI and instance show no IPv6 address/prefix.
- **INFO:** unrestricted IPv4 egress. It permits instance-initiated connections
  and is not an inbound permission. SG tracks allowed flows and permits their
  response traffic. Restricting egress would require dependency review; not
  requested or performed here.
- **WARNING / confirmation pending:** the authorized operator for
  `117.3.54.230/32` is not established by a CIDR alone. Historical AWS-03 #12
  describes this source as old and records `171.225.185.22/32` at its own
  observation date. Current control plane now shows `117.3.54.230/32`; neither
  historical value establishes today's administrator IP. Team Leader must
  confirm ownership/current use before claiming admin-source acceptance.
- **DEFERRED:** external reachability and actual Linux binding. Loopback binding
  in prior deployment evidence does not excuse a broad SG or prove current runtime.

## Conditional remediation proposal — not applied

| Item | Proposal if the SSH source is confirmed obsolete |
| --- | --- |
| Current | TCP 22 from `117.3.54.230/32` |
| Desired | Only verified authorized administrator source(s), normally `/32` |
| Risk | Wrong CIDR can lock out SSH; adding a source expands administrative access |
| Change | Team Leader reviews the exact replacement IP and access/recovery plan; in a separately authorized window, add verified `/32`, test it, then remove obsolete source |
| Rollback | Retain exact prior rule evidence and authorized recovery access; restore the previous rule only if needed and approved for recovery, then investigate |

No rule changes, connectivity tests or SSH were performed in this audit.
