# IDOR demo scripts — PBL4-517

Refs #24. Three existing scripts cover cross-user order **read, update and cancel**.
They do not test all OWASP categories. The default origin is now
**https://13.251.128.130** (EC2 public IP confirmed by the user on 2026-10-19).
`--url` overrides it when the address changes; never append `/api` or use public port 3000.

This follow-up adds authenticated checks against the deployed **secure baseline**
at the user's request. The original vulnerable → exploit → fix lab in Issue #24
remains localhost-only. Keep `VULN_IDOR_ENABLED=false` on EC2.

## Chạy ngay trong workspace hiện tại

Bản cập nhật nằm trực tiếp trên nhánh `feature/51-kevilo-ui` tại `D:\PBL4-517`.
Môi trường `.venv` đã được chuẩn bị trên máy này (không commit). Trong PowerShell:

```powershell
cd D:\PBL4-517
.\.venv\Scripts\python.exe scripts/attacker/exploit_idor.py --id ORDER_UUID
.\.venv\Scripts\python.exe scripts/attacker/exploit_idor_update.py --id ORDER_UUID
.\.venv\Scripts\python.exe scripts/attacker/exploit_idor_cancel.py --id ORDER_UUID
```

Thay `ORDER_UUID` bằng UUID đơn thử của khách hàng A trên website deploy; chạy từng
lệnh, nhập email/mật khẩu của khách hàng B khi được hỏi. Không cần chạy FE/BE local.
Các thao tác sửa/hủy là request thật nếu server có lỗi phân quyền; chỉ dùng đơn giả.
Máy khác cần tự cài dependency theo mục Prepare once.

## Prepare once

- Python 3 and the existing `requests` dependency: `python -m pip install requests`.
- On the website, create two dedicated **CUSTOMER** test accounts A and B with private passwords.
  Do not use the public development seed credentials on EC2.
- A creates a synthetic order. Copy its full UUID from `/orders/<UUID>`.
  Use a disposable **PENDING** order for update/cancel. Verify that A can view it.
- Run from the repository root on the laptop. FE/BE local are unnecessary for EC2 checks.

The scripts prompt for B's email and a hidden password (or accept `--email`).
They never auto-register accounts and do not accept passwords in command-line arguments.
Every request has a timeout, verifies TLS and refuses redirects. Login failure,
an administrator session or selecting B's own order stops before the test operation.

## Run each demo separately

Replace `ORDER_UUID` with A's test-order UUID. Passwords are entered privately at each run.

```powershell
python scripts/attacker/exploit_idor.py --id ORDER_UUID
python scripts/attacker/exploit_idor_update.py --id ORDER_UUID
python scripts/attacker/exploit_idor_cancel.py --id ORDER_UUID
```

Optional overrides:

```powershell
python scripts/attacker/exploit_idor.py --url https://13.251.128.130 --email customer-b@example.com --id ORDER_UUID
python scripts/attacker/exploit_idor_update.py --id ORDER_UUID --address "Dia chi thu nghiem PBL4"
```

Update/cancel are actual requests, not dry runs. If authorization is broken they
will modify/cancel the selected order; use only the prepared synthetic order.
After each test, A checks the address/status. A can cancel the test order normally
after the demo to restore stock if it remains PENDING.

| Result | Meaning | Exit code |
| --- | --- | --- |
| `PASS` with `403 FORBIDDEN` | This cross-user request was denied | 0 |
| `FAIL` with HTTP 200 and order data | Cross-user request succeeded; inspect the test order | 1 |
| `INCONCLUSIVE` | Login/TLS/network error, CSRF rejection, missing order, invalid state or unexpected response | 2 |

`403 CSRF_INVALID` is **not** an IDOR pass. Output excludes passwords, tokens,
cookies and order PII. A single PASS does not establish that the whole application is secure.

## Local vulnerable lab

Local targeting is now explicit; the old default order UUID and hard-coded credentials
have been removed. Create/prepare the accounts beforehand using the website's
[canonical setup](../../website/README.md), then run:

```powershell
python scripts/attacker/exploit_idor.py --url http://127.0.0.1:3000 --id ORDER_UUID
```

Use the same `--url` for update/cancel. A lab with `VULN_IDOR_ENABLED=true` should
yield `FAIL` (the deliberately vulnerable request succeeded); the secure retest
should yield `PASS`. Restore the local flag to false after the lab. Historical
evidence in [OWASP-01](../../evidence/OWASP-01/README.md) retains the old CLI/output.

## Scanner and Telegram already running on Ninh's machine

The scanner already takes a host argument; no source IP replacement is necessary.
On Telegram, send the explicit remote target to the running bot:

```text
/scan 13.251.128.130 22,80,443,3000,5432,8080
```

Do not start a second listener for the same bot. The existing quick buttons and
bare `/scan` still scan **127.0.0.1 on Ninh's machine**. Local edits here do not
update his running process. For a laptop-only scan without sending alerts:

```powershell
python scanner/scan.py 13.251.128.130 --ports 22,80,443,3000,5432,8080 --timeout 3 --no-alert
```

Full scanner instructions: [scanner/README.md](../../scanner/README.md).

## Script regression tests

```powershell
python -m unittest discover -s scripts/attacker/tests -v
```

Tests use a fake HTTP session, not EC2 or Telegram. Authenticated production checks
still require the user's prepared accounts/order; source checks are not live IDOR evidence.
