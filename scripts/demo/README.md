# Demo bảo mật local

Refs #68, Related to #44. Tái sử dụng [attacker probes](../attacker/README.md).
Chạy `dev.ps1 setup` theo [website README](../../website/README.md#local-nhanh-tren-windows)
một lần để build, tạo DB lab, migration, fixture và cài Chromium cho XSS.

## IDOR trước và sau phòng thủ

```powershell
.\dev.ps1 demo -Mode idor
.\dev.ps1 probe -Scenario idor -Expect vulnerable
.\dev.ps1 secure
.\dev.ps1 probe -Scenario idor -Expect secure
```

Mong đợi `EXPLOIT_CONFIRMED` rồi `DEFENSE_VERIFIED`. Probe kiểm tra chủ đơn vẫn đọc
được, attacker khác owner và đúng mã lỗi; outage/sai CSRF không tính là defense.
JSON ở `.local/reports/security/`.

Browser lab: <http://localhost:5174> (API loopback 3001); web thường dùng
<http://127.0.0.1:5173> để khác cookie host. Không mở hai app trên cùng hostname
trong cùng browser profile. Owner/attacker/admin và order ID ở
`.local/private/lab-fixtures.json`; không đưa mật khẩu vào slide/evidence chia sẻ.
Dùng hai browser contexts cho owner/attacker mở cùng `/orders/<orderId>`.

## Các bài demo

| Mode | Scenario probe | Nội dung |
| --- | --- | --- |
| `idor` | `idor` | Đọc đơn người khác |
| `idor` | `idor-update`, `idor-cancel` | Sửa/hủy đơn; kiểm tra stock |
| `sqli` | `sqli` | Search payload trước/sau parameterization |
| `xss` | `xss` | Review lưu sẵn; Chromium kiểm tra marker vô hại |
| `auth` | `auth` | 12 lần sai; secure rate limit từ lần 11 |

Thay mode/scenario trong chuỗi bốn lệnh trên. Mỗi `demo`/`secure` restart lab để
áp dụng cờ và làm mới rate-limit window. Auth làm cuối. Sau vulnerable update/cancel,
khi không ai sửa fixture, dùng `.\dev.ps1 reset-order` trước pha secure.
Reset chỉ phục hồi đơn đã xác minh; giữ review XSS để so sánh. Kết thúc dùng
`dev.ps1 secure` hoặc `dev.ps1 down`.

## Dữ liệu và cấu hình

DB `kevilo_demo_lab` và role riêng cùng container website nhưng không chung dữ liệu.
Prepare dùng admin trong `.local/private/database.env`; PostgreSQL cài riêng cần
kết nối có quyền cấp role/DB lần đầu. Role chạy lab không có SUPERUSER/CREATEDB/CREATEROLE.
Credential ở `.local/private/lab.env`; prepare lại giữ fixture, không reset đơn.
Tên DB cần segment `lab`; BE/FE bind loopback; mỗi mode chỉ bật một cờ.
Không thay `.env` website. Provisioning bị ngắt: kiểm tra role/DB/cấu hình riêng tư,
không tự xóa tên đang tồn tại. Chỉ chuẩn bị lại lab sau build:

```powershell
.\scripts\demo\run.ps1 -Action prepare
```

Demo dùng nhánh lab/phòng thủ đã có: query scoping, parameterized query, React escaping,
rate limit. Local PASS không là AWS acceptance. Scanner TCP không tự phát hiện HTTP
attack. Evidence ghi revision/ngày/môi trường/giới hạn; dirty build không là clean
release. EC2 theo runbook attacker và human deployment gate.
