# AWS-04 — read-only control-plane audit

Refs #33. Collection started **2026-11-03 16:02 UTC / 23:02 Asia/Bangkok**.
Collection completed by **16:13 UTC / 23:13 Asia/Bangkok**, with EC2 still Stopped.
SSH-source follow-up started **16:40 UTC / 23:40 Asia/Bangkok** the same day,
after the user reported changing SSH to their current IP. [Updated SG evidence](security-group.md)
supersedes only the original source warning; other resources retain their
initial snapshot timestamps.
Base: `680aee7539625b917f59d2b40c5221149c927202`; branch
`feature/33-vpc-sg-nacl-review`, created from freshly fast-forwarded `main`.

Source: authenticated AWS Console in Chrome, region `ap-southeast-1`, read by
Computer Use accessibility text and screenshots. This is a sanitized transcription
of current Console observations, not a CLI export. Account identity, unrelated
browser information and credentials are omitted. Resource IDs are retained to
prove relationships. Historical AWS-02/AWS-03/WEB-04 reports are not new evidence.

## Instance, primary ENI and EIP — verified

| Field | Console observation |
| --- | --- |
| Instance / name | `i-0ccfb2772f854e78b` / `pbl4-517-web` |
| State | **Stopped**; user initiated shutdown `2026-11-03 09:50:19 GMT` |
| Region / AZ / AZ ID | `ap-southeast-1` / `ap-southeast-1c` / `apse1-az3` |
| VPC | `vpc-0ab08b95c1ba6251d` |
| Subnet | `subnet-029c5dafae1ddbd89` |
| Private IPv4 | `172.31.11.224` |
| Elastic/public IPv4 | `52.221.157.206`; no auto-assigned public address |
| Primary ENI | `eni-00488b028c979c5da`, device/card index `0/0`, attached |
| ENI security groups | Only `sg-0c0ebd38764b1df74` (`launch-wizard-1`) |
| IPv6 on instance/ENI | None shown; no IPv6 prefixes shown |
| EIP allocation | `eipalloc-0154d583fc5944012` |
| EIP association | `eipassoc-0f6a54f29df00371c` |
| EIP scope / pool / border group | VPC / Amazon / `ap-southeast-1` |
| EIP associated instance / ENI / private IP | Same instance / ENI above / `172.31.11.224` |

Observed pages: EC2 Instance details (summary and Networking), and Elastic IP
details for `52.221.157.206`. EIP details independently confirms allocation,
association and instance/ENI/private-IP mapping while the instance is stopped.

## Collection boundaries

No agent AWS mutations, EC2 start/stop/reboot, SSH, application deployment, resource
creation, lab listener, scanner, external port probe or alert send. Runtime
verification is **DEFERRED — EC2 intentionally stopped**. No runtime PASS is
inferred from network configuration or historical service checks.
The user separately edited the SSH source between snapshots. This is explicitly
attributed to the human, not omitted from the change history or claimed as an
agent remediation. Follow-up reads do not authorize further AWS changes.

## Evidence index

- [VPC, subnet, effective routes and matching IGW](vpc-subnet-route.md)
- [Complete attached SG matrices and SSH-source follow-up](security-group.md)
- [Complete NACL matrices, association and ephemeral ports](nacl.md)
- [Architecture diagram and SG vs NACL comparison](../../docs/aws/network-control-plane.md)
- [Deferred live matrix](live-test-plan.md)
- [Twenty teach-back answers](teach-back.md) — agent reference, human acceptance pending
- [Local verification](verification.md)

Text evidence was chosen instead of committing screenshots containing account
identity/browser chrome. Console screenshots were inspected during collection;
no edited/synthetic screenshot is presented as an AWS artifact. These Markdown
records are transcriptions, not raw AWS API responses or immutable audit logs.

## Findings and disposition

| Class | Finding | Evidence / next action |
| --- | --- | --- |
| PASS | Expected instance, EIP allocation/association, primary ENI and private IPv4 match current control plane | Instance Networking + EIP details above |
| PASS | Default VPC/subnet, AZ/CIDR, implicit main association, active IGW route and matching attachment verified | [Routing](vpc-subnet-route.md) |
| PASS | SG public web only; restricted SSH `/32`; no rule covering 3000/5432/8080 | [Complete SG](security-group.md) |
| PASS | Effective NACL association and every inbound/outbound rule reviewed; IPv6 absence checked across layers | [NACL](nacl.md) |
| INFO | Default VPC/NACL, IPv4 allow-all NACL and unrestricted SG egress | Configuration permits intended response traffic; does not add selective subnet hardening |
| PASS | User's SSH-source update independently verified: `171.225.185.44/32` matches workstation public IPv4; old source absent | Same SSH rule ID; [current matrix and historical warning](security-group.md); actual access remains deferred |
| DEFERRED | Runtime reachability, current host bindings, HTTP redirect/TLS/application health | [Future test plan](live-test-plan.md); EC2 intentionally stopped |

No observed configuration FAIL requiring remediation in this phase. The initial
SSH-source warning is resolved for the current configuration after the human edit;
successful SSH access is still not claimed. Agent inspection remains read-only.
PR #60 is OPEN/unmerged at initial audit time; no ALB is represented in the
current path and no ALB resource was created. This phase did not inventory ALBs.

**CONTROL-PLANE REVIEW COMPLETE / LIVE VERIFICATION DEFERRED / ISSUE REMAINS OPEN.**
All requested network relationships/rule directions were reviewed. Human review,
team understanding/demo and the issue's live DoD remain
pending. Required CI must pass on the latest PR head before reporting
`READY FOR HUMAN REVIEW — CONTROL PLANE PHASE`. No issue checklist or human
acceptance item was changed by this task.
