# AWS-04 teach-back

Refs #33. Agent-written explanation; **does not attest that team members have
understood, demonstrated or approved it**. Actual IDs: [audit](README.md),
[routing](vpc-subnet-route.md), [SG](security-group.md).

1. **VPC vs subnet:** this default VPC contains `172.31.0.0/16`; the EC2 subnet
   is the smaller `172.31.0.0/20` range within it, in one AZ (`ap-southeast-1c`).
2. **Why an EIP is insufficient:** an address mapping cannot replace an effective
   route to an attached IGW. Both policy layers and a running service also matter.
3. **Default route:** `0.0.0.0/0 → igw-0c78d0d200956fbcb` sends IPv4 traffic not
   matched by a more specific route toward the IGW. VPC `/16 → local` wins for
   VPC destinations. Neither route authorizes a TCP port.
4. **IGW:** connects the VPC with the Internet and translates the EIP/private IPv4
   mapping. Here it is Attached to the same VPC as the subnet/instance.
5. **EIP/ENI/private IP:** allocation `eipalloc-0154d583fc5944012` is associated
   through `eipassoc-0f6a54f29df00371c` with primary ENI `eni-00488b028c979c5da`,
   private `172.31.11.224`, instance `i-0ccfb2772f854e78b`. Guest networking uses
   the private IPv4; the EIP remains associated while stopped.
6. **SG position:** `sg-0c0ebd38764b1df74` applies to that ENI; the NACL applies
   at the subnet boundary. These are policy scopes, not additional proxy servers.
7. **Stateful SG:** allowed inbound HTTPS connections can send responses without
   a separate outbound client-port rule. Likewise tracked responses to allowed
   outbound connections do not require a new inbound service rule.
8. **Stateless NACL:** it independently evaluates packets crossing the subnet
   boundary in both directions; an allowed request alone does not allow a reply.
9. **Ephemeral ports:** client temporary source port → server 443, then server
   reply → that client port. NACL must allow the appropriate response direction.
   Client/OS/service context determines the range; no universal range is claimed.
10. **SG deny:** no explicit DENY. Applicable attached SG permissions combine;
    unmatched ingress is implicitly denied. This ENI lists only one SG.
11. **NACL rule order:** ascending rule number; the first matching ALLOW or DENY
    decides. The final `*` denies unmatched packets. IPv4/IPv6 are separate.
12. **Why private backend/database:** public 3000/5432 increases attack surface,
    exposes internal protocols and can bypass Nginx TLS/routing protections;
    application authentication is not a replacement for network restrictions.
13. **Loopback is independent:** `127.0.0.1` binding helps at the host, but a future
    bind change could expose a service if SG were broad. Keep both layers limited;
    this audit proves SG policy, not current host binding while stopped.
14. **Stopped scans:** no response may simply mean the instance is stopped.
    It cannot establish firewall correctness, listener state or HTTPS health.
15. **Public subnet proof:** subnet details plus implicit main association,
    active IGW default route and the IGW's matching VPC attachment establish it.
16. **SG allows 443, NACL denies:** packets are blocked by the NACL despite SG.
17. **NACL allows, SG does not:** packets are blocked by the ENI SG despite NACL.
18. **Inputs for #34:** actual VPC/subnet/AZ/CIDR, route/IGW, ENI/EIP mapping,
    effective SG/NACL and IPv6 absence. ALB design/resources are outside #33.
19. **Lab 8080:** #36 MON-02 / #41 SEC-05 require their own controlled window,
    source restrictions and rollback. This audit neither opens it nor runs a listener.
20. **Why #33 stays OPEN:** control-plane configuration and the later admin-source
    live observations do not fulfill the remaining non-admin SSH negative control,
    unverified host/deployment facts or human review/understanding. A documentation
    merge does not establish issue completion.

AWS sources: [SG stateful behavior](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html),
[NACL order and ephemeral ports](https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html),
[IGW and public subnets](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html).
