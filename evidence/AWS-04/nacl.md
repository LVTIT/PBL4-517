# Effective Network ACL — current Console observation

Refs #33. Collected 2026-11-03 after 16:02 UTC, `ap-southeast-1`.
[Provenance/base](README.md). **`acl-09f35ebbd208397c7`**, Default **Yes**,
VPC **`vpc-0ab08b95c1ba6251d`**, associated with **3 subnets**. The EC2 subnet
details names this ACL; the ACL's Subnet associations tab independently lists
`subnet-029c5dafae1ddbd89`, `172.31.0.0/20`, `apse1-az3 (ap-southeast-1c)`.

Read both complete rule tabs, unfiltered, one page each, **2 entries each**:

| Direction | Rule number | Family | Type / protocol | Port range | Source / destination | Action |
| --- | --- | --- | --- | --- | --- | --- |
| Inbound | 100 | IPv4 | All traffic / All | All | Source `0.0.0.0/0` | ALLOW |
| Inbound | `*` | IPv4 | All traffic / All | All | Source `0.0.0.0/0` | DENY |
| Outbound | 100 | IPv4 | All traffic / All | All | Destination `0.0.0.0/0` | ALLOW |
| Outbound | `*` | IPv4 | All traffic / All | All | Destination `0.0.0.0/0` | DENY |

No IPv6 rules are shown. VPC/subnet have no IPv6 CIDR and the ENI has no IPv6
address/prefix. **IPv6 not configured / not applicable to the current path**;
this conclusion follows evidence, not an assumption that IPv4 rules cover IPv6.

## Assessment: PASS for intended path; INFO on permissive boundary

The first matching numbered rule wins. IPv4 packets match rule 100 before `*`;
the terminal DENY therefore does not block IPv4 web requests or responses here.
The default ACL is permissive in both directions. It does **not** selectively
protect 22, 3000, 5432 or 8080; that restriction is currently supplied by the ENI
SG. NACL allow-all does not override the SG's missing ingress permission.

No configured ACL rule prevents the expected IPv4 web/SSH request or response
path. This is a configuration assessment, not a hardened custom ACL claim or
runtime PASS. Additional subnet segmentation is not implemented by this ACL.
No NACL replacement or edits are proposed as necessary for this audit.

## Response traffic and ephemeral ports

For an incoming HTTPS connection, client `temporary-port → EC2:443`; the reply
is `EC2:443 → client:temporary-port`. This stateless NACL independently checks
inbound request and outbound reply. Rule 100 allows both, including temporary
ports, without needing a new rule. For instance-initiated traffic, outbound
request and inbound response need the analogous pair of permissions.

If a future reviewed policy replaces allow-all, it must allow the relevant
response ports as well as service ports. The initiating client/OS/service chooses
its temporary range. AWS documents examples such as many Linux kernels
`32768–61000` and newer Windows `49152–65535`; these are considerations, not a
verified range for this stopped host or a universal constant. Inspect the actual
context before designing a restrictive ACL. Do not copy a single example range
and assume all clients will work.

Source: [AWS custom NACL rule order and ephemeral ports](https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html).

## Live-window recheck

After the user-started 2026-11-03 16:56 UTC live window, both complete rule tabs
were re-read in Console: still two rules each, 100 IPv4 allow-all then `*` deny,
same NACL/default/VPC. [External observations and limitations](live-20261103/README.md).
This permissive NACL does not independently explain the timeouts at 3000/5432/8080;
the attached SG lacks ingress permissions for them. No ACL change was performed.
