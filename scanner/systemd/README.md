# Scheduled external monitoring ? Refs #35, #43

Status: templates implemented; actual Ubuntu VM install/reboot and EC2 acceptance
are pending. Do not describe Docker/Windows unit checks as VM reboot evidence.
Run this on the group's external Ubuntu VM, separate from the monitored EC2.

1. Clone the reviewed source at `/opt/pbl4-517`; keep it read-only for the runtime user.
2. Create a dedicated system user/group `pbl517-monitor` with no login shell.
3. Create `/etc/pbl517-monitor.env` owned by root, mode 0600. Set `SCANNER_TARGET`
   to the authorized EC2 IP/hostname, `SCANNER_PORTS=22,80,443,3000,5432,8080`,
   and optional Telegram/Discord variables from the root `.env.example`.
   Do not put credentials into units, command lines, screenshots or Git.
4. Copy the two reviewed unit files into `/etc/systemd/system/`.
5. Run `sudo systemd-analyze verify /etc/systemd/system/pbl517-monitor.service
   /etc/systemd/system/pbl517-monitor.timer`, then `sudo systemctl daemon-reload`.
6. Run `sudo systemctl start pbl517-monitor.service` once; inspect
   `sudo journalctl -u pbl517-monitor.service --since today` and
   `/var/lib/pbl517-monitor/`. Exit 1 is degraded monitoring, not a safe result.
7. Enable scheduling with `sudo systemctl enable --now pbl517-monitor.timer`.
   Inspect `systemctl list-timers pbl517-monitor.timer`; record at least two runs.
8. With the agreed VM reboot window, reboot and verify the timer and new audit
   records resume. Record VM identity, time, target, source revision and outcome.

The timer runs 30 seconds after boot and about 60 seconds after each completion,
with small jitter. Overlap is prevented by systemd plus the state lock. Runtime
state/reports/audit are private under StateDirectory; JSON audit rotation is bounded.
The system journal uses the VM's existing retention policy; check available space.

ChatOps is optional and is not started by this timer. If running the listener
separately on the same VM, configure `TELEGRAM_ALLOWED_USER_IDS`,
`SCANNER_ALLOWED_TARGETS` (IPv4 literals only), `SCANNER_TARGET` and
`SCANNER_STATE_FILE=/var/lib/pbl517-monitor/scanner.state.json` in its private
environment. Use a runtime identity with access to that state directory; do not
make state or secrets public to solve permissions. Both chat and sender must be
authorized, including button callbacks. See the scanner README for limits.

For the EC2 port-change exercise (#36/#41), use a harmless temporary listener and
restrict its SG source to the scanner IP /32. Capture baseline, change, both real
channel receipts, rollback and final probes. Filtered after SG rollback means no
TCP connection could be established from this scanner, not confirmed service stop.
Check rules and service state separately. Never expose the real DB or backend.

Rollback: `sudo systemctl disable --now pbl517-monitor.timer`; stop any running
monitor service; preserve private state/evidence; remove only the installed units
if retiring monitoring, then daemon-reload. Do not alter the web EC2 to install
this external scheduler. No unit was installed by the current local task.
