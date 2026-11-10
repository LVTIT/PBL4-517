# ChatOps copy/buttons and demo walkthrough — 2026-11-10

Related to #68. Branch `feature/68-simple-local-demo`, uncommitted working tree.
Environment: Windows PowerShell, Python 3.12, local backend `127.0.0.1:3000`,
frontend `127.0.0.1:5173`, PostgreSQL container `pbl517-db`. The user explicitly
authorized using the existing local `.env` credentials to operate the bots and
send real Telegram/Discord messages. No token, chat ID, cookie or manifest value
is reproduced here.

## Changed behavior

- Alert/ChatOps copy is concise Vietnamese: no all-caps banner, horizontal rule
  or decorative emoji; severity uses `[CRITICAL]`, `[HIGH]`, `[MEDIUM]`; the
  "Không suy ra…" limitation statements remain.
- `/scan` parses `Cổng đang mở (N): [...]`; the previous output rendered as
  `3): [3000, 5173, 55432]`.
- Exit code 1 caused only by pending alert delivery is no longer reported as
  uncertain ports. Filtered ports are still reported as uncertain.
- Failed scans show the last `[-]` scanner error instead of the full raw stdout.
- Discord webhook execution adds `with_components=true&wait=true`, preserves an
  existing `thread_id` and disables mentions. Incoming webhooks otherwise ignore
  link buttons.
- Telegram startup validates the token with `getMe`; polling exits with a clear
  message on HTTP 409 (another process using the same token).
- Demo CLI keeps interactive questions, prints accounts/URLs/requests, asks for a
  custom PATCH address and confirmation before PATCH/cancel, and never requires
  reading or copying `.local/private/lab-fixtures.json`.

## Local checks

| Command | Result |
| --- | --- |
| `python -m unittest discover -s scanner/tests` | PASS, 55 tests |
| `python -m unittest discover -s scripts/demo/tests` | PASS, 5 tests |
| `python -m unittest discover -s scripts/attacker/tests` | PASS, 8 tests |
| `python -m unittest discover -s scripts/dev/tests` | PASS, 5 tests |
| `python scripts/demo/cli.py idor --non-interactive` | `EXPLOIT_CONFIRMED`, `passed: True`; report `.local/reports/security/idor-vulnerable.json` |
| `python scanner/scan.py 127.0.0.1 --ports 3000,80 --state-file .local/runtime/ux-verify.state.json --no-banner` | `INITIAL_SCAN`, open 3000, filtered 80, exit 1; real alerts sent |

`.\dev bot` started the listener; `.\dev status` reported the bot process running.

## Real channel observations

Telegram group (`PBL4-517 Alerts`, bot `pbl4_517_sec_bot`):

- `Ping`, `Baseline`, `Trợ giúp`, `Báo cáo`, `Quét lại` and `Quét web` buttons
  responded. `Quét web` ran `/scan 127.0.0.1 80,443,8080`.
- Scan summary showed `Cổng đang mở` without the stray `3):` fragment and showed
  `Timeout/filtered` only when non-empty. Failed-scan text was not retested with
  a real failure.
- `/status` labels separate retained baseline from the latest observation:
  `Cổng đang mở trong baseline` and `Timeout/filtered lần quét gần nhất`, with
  posture rendered as `F · Mức nguy hiểm cao (critical)`.
- `/report` delivered `latest.html` and `latest.md`; the new caption lists both
  filenames.

Discord channel `#scanner` (webhook `PBL4 Security Monitor`):

- New embeds rendered at 01:13 and 01:14 local server time:
  `Đã lưu baseline · 127.0.0.1` and `Kết quả quét chưa đầy đủ · 127.0.0.1`.
  They showed the new field labels (`Mục tiêu`, `Đánh giá`, `Cổng đang mở`,
  `Cổng chưa xác định`, `Mã sự kiện`) and the footer limitation text.
- Both messages exposed two link buttons with accessible role `link`:
  `AWS Security Group` and `OWASP A05`.

## Limits

- Targets were loopback only. 5432/8080 intermittently became filtered during
  repeated local scans; that is uncertain, not proof the ports are closed.
- The `Quét DB` action was not clicked live; it shares the same dispatch handler
  and is covered by `test_all_action_buttons_dispatch_to_existing_commands`.
- Receipts were observed in the authorized desktop browser session. Message IDs
  and screenshots are not stored here because the sidebars contain unrelated
  personal chats.
- No AWS, deployment, commit, PR, hosted CI, human review or issue closure is
  claimed. Local PASS is not production acceptance.
