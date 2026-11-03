# VPC, subnet, route table and Internet Gateway

Refs #33. Current AWS Console observations on 2026-11-03 after 16:02 UTC;
region/base/provenance: [index](README.md).

## VPC details

| Field | Observed |
| --- | --- |
| VPC | `vpc-0ab08b95c1ba6251d`, Available |
| Default VPC | **Yes** (not a custom VPC) |
| IPv4 CIDR | `172.31.0.0/16` |
| DNS resolution / DNS hostnames | Enabled / Enabled |
| IPv6 CIDR / IPv6 pool | None shown |
| Main route table | `rtb-0b1f06b4e04d1d90c` |
| Main NACL | `acl-09f35ebbd208397c7` |

The VPC is the project instance's logical AWS network. `/16` fixes the first
16 address bits, covering `172.31.0.0`–`172.31.255.255`. The instance private
IPv4 `172.31.11.224` lies inside it. DNS settings enable AWS DNS resolution and
hostnames; they do not grant Internet access or permit an application port.

## Subnet record

Read the subnet list filtered by exact ID and its details.

| Field | Observed |
| --- | --- |
| Subnet | `subnet-029c5dafae1ddbd89`, Available |
| VPC | `vpc-0ab08b95c1ba6251d` |
| IPv4 CIDR | `172.31.0.0/20` |
| AZ / AZ ID | `ap-southeast-1c` / `apse1-az3` |
| Available IPv4 count | `4090` at collection time (not a capacity guarantee) |
| Default subnet | Yes |
| Auto-assign public IPv4 | Yes |
| IPv6 CIDR / auto-assign IPv6 | None shown / No |
| Effective route table shown | `rtb-0b1f06b4e04d1d90c` |
| Effective NACL shown | `acl-09f35ebbd208397c7` |

The `/20` subnet covers `172.31.0.0`–`172.31.15.255`, including the instance IP,
and occupies one AZ within the larger VPC. Auto-assign IPv4 affects new interface
address assignment; the existing EC2 uses its separately associated EIP. This
setting or the presence of an EIP alone does not prove a public subnet.

## Effective route table — verified

`rtb-0b1f06b4e04d1d90c` details: VPC `vpc-0ab08b95c1ba6251d`, **Main: Yes**,
no edge associations. Subnet associations tab: **0 explicit associations**;
`subnet-029c5dafae1ddbd89` / `172.31.0.0/20` is explicitly listed under
**Subnets without explicit associations**, which use the main table implicitly.
This agrees with the route table ID in the subnet details.

Routes tab, IP version **Both**, exactly two routes:

| Destination | Target | Status | Propagated | Origin |
| --- | --- | --- | --- | --- |
| `172.31.0.0/16` | `local` | Active | No | Create Route Table |
| `0.0.0.0/0` | `igw-0c78d0d200956fbcb` | Active | No | Create Route |

No IPv6 route is present. The local `/16` route directs VPC traffic within the
VPC; the less-specific default route directs other IPv4 destinations to the IGW.
A route table chooses forwarding, not port permission. SG/NACL still apply.

## Internet Gateway and public-subnet conclusion — verified

Internet gateways list filtered to exact route target
**`igw-0c78d0d200956fbcb`** shows **State: Attached**, VPC
**`vpc-0ab08b95c1ba6251d`**. Thus the relation is complete:

```text
EC2 i-0ccfb2772f854e78b / primary ENI eni-00488b028c979c5da
  -> subnet-029c5dafae1ddbd89 (172.31.0.0/20, ap-southeast-1c)
  -> implicit main rtb-0b1f06b4e04d1d90c
  -> active 0.0.0.0/0 -> igw-0c78d0d200956fbcb
  -> attached to the same vpc-0ab08b95c1ba6251d (172.31.0.0/16)
```

**PASS: public IPv4 subnet**, based on the effective route and matching IGW
attachment, not the EIP alone. The IGW supplies Internet routing and IPv4
public/private address translation for the associated EIP; the guest uses its
private IP. Public routing does not override the ENI SG/subnet NACL, start the
stopped instance or establish HTTP/TLS/listener health. No IPv6 CIDR or route is
configured in the observed VPC/subnet/table.

AWS references: [Internet gateways](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html),
[subnet route table associations](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-route-tables.html).
