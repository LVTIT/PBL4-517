# Monitoring reliability ? Refs #43

**PR #57 integration, 2026-10-26:** [Conflict resolution and current regression](pr57-integration-20261026/README.md)
against main `5a7abb7`. Historical results below keep their original source/date;
Ubuntu VM/reboot, real-channel and AWS acceptance remain separate gates.

**2026-10-26:** [Monitoring safety fixes and full local regression](local-20261026/README.md)
on source `82abdff`: 27 scanner/ChatOps checks PASS, plus website/API/browser
security regression. External VM/reboot, real current channel receipts and AWS
acceptance remain pending; local tests do not close Issue #43.

**Historical 2026-10-25:**

Local implementation/regression only: 12 checks cover loopback reachability,
uncertain/recovery observations, durable per-channel retries, bounded queue,
atomic writes, corrupt state and single-writer locking. Real new channel receipts,
external Ubuntu VM scheduling/reboot and EC2 hardening acceptance remain pending.

[Captured results and limits](../TEST-02/local-20261025/README.md),
[VM runbook](../../scanner/systemd/README.md).
