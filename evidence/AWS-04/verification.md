# Verification record

Refs #33. Documentation/evidence-only change; no application, scanner, alert,
workflow, database or AWS configuration source changed.

- Base SHA: `680aee7539625b917f59d2b40c5221149c927202`, freshly updated from
  `origin/main`; clean working tree before creating `feature/33-vpc-sg-nacl-review`.
- Main CI at collection time: [41662659098](https://github.com/LVTIT/PBL4-517/actions/runs/41662659098),
  conclusion success on that exact base. This is not feature-branch CI evidence.
- PR #60 checked on GitHub: OPEN, `mergedAt: null`; no changes to #34/#60.
- Windows / Python 3.12; commands/results for this change are recorded below.
- Mermaid manually checked: paired diagram/subgraph boundaries, quoted labels,
  defined node references and valid directed/dotted edge forms. AWS scopes are
  containers/policies, not an invented chain of network appliances. No visual
  renderer result is claimed.
- Local Markdown targets and CIDR containment checked independently by Python.
- Sanitization: no account number/ARN, email, browser bookmarks, cookies, token,
  private key or unrelated resource metadata included in the new audit records.

## Local checks

All task files staged before policy inspection; policy reads index blobs.

| Command / check | Result |
| --- | --- |
| `git diff --check` and `git diff --cached --check` | PASS, no whitespace errors |
| `python scripts/ci/repo_policy.py` | PASS: 524 index entries, 0 violations |
| `python -m unittest discover -s scripts/ci/tests -v` | PASS: 5 tests |
| Python check of changed Markdown link targets and balanced fences | PASS: 96 local targets |
| Python `ipaddress` containment | PASS: `172.31.11.224` in subnet `/20`, subnet in VPC `/16` |
| Audit-file metadata hygiene check | PASS: no full account number, AWS ARN or access-key identifier in new audit/network documents |

The checks apply to this documentation change; no application runtime source was
modified. No full application tests run locally for this docs-only change; all
five hosted CI jobs remain required. Final commit SHA is supplied by the PR,
not fabricated within the commit's own content.

## Hosted CI

Latest PR head/run and all five job conclusions will be recorded on the delivery
PR and in the final report, avoiding a commit that refers to its own SHA.
No feature-branch CI success is asserted before that run completes.

## AWS operating boundaries

AWS Console read-only inspection only, with EC2 Stopped at the beginning and
end of collection. No Start/Stop/Reboot, SSH, port probe, deployment, ALB/resource
creation, IAM/security/routing mutation, certificate change or alert send.
Collection occurred within **16:02–16:13 UTC / 23:02–23:13 Asia/Bangkok on
2026-11-03**. Final instance-summary screenshot and accessibility text showed
Stopped, same instance/EIP/private IP. No live test was executed.
